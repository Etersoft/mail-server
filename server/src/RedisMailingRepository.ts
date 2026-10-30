import { Mailing, MailingProperties } from './Mailing';
import { MailingState } from './MailingState';
import { Receiver, ReceiverProperties } from './Receiver';
import { MailingRepository } from './MailingRepository';
import { BaseRedisRepository } from './BaseRedisRepository';
import { RedisClient, RedisConnectionPool } from './RedisConnectionPool';


export interface RedisMailingRepositoryConfig {
  commonDataKeyPrefix: string;
  excludedReceiversKeyPrefix: string;
  idCounterKey: string;
  receiversListKeyPrefix: string;
}

const defaultConfig: RedisMailingRepositoryConfig = {
  commonDataKeyPrefix: 'MAILING_COMMON_DATA_',
  excludedReceiversKeyPrefix: 'MAILING_EXCLUDED_RECEIVERS_',
  idCounterKey: 'MAILING_ID_COUNTER',
  receiversListKeyPrefix: 'MAILING_RECEIVER_LIST_'
};

// Формат ключей и данных используется также в mail-sorter
// (src/services/RedisRepositories.js): при изменении поправить и там
export class RedisMailingRepository
extends BaseRedisRepository<Mailing, MailingProperties, number>
implements MailingRepository {
  private listIdMailingCache = new Map<string, Mailing>();

  constructor (
    redisConnectionPool: RedisConnectionPool,
    config: Partial<RedisMailingRepositoryConfig> = {}
  ) {
    super(redisConnectionPool);
    this.config = { ...defaultConfig, ...config };
  }

  protected readonly config: RedisMailingRepositoryConfig;

  addReceiver (mailingId: number, receiver: Receiver) {
    return this.redisConnectionPool.runWithConnection(async redisClient => {
      const key = this.getReceiversListKey(mailingId);
      const item = this.serializeReceiver(receiver);
      await redisClient.rPush(key, [item]);
    });
  }

  async create (properties: MailingProperties, receivers: ReceiverProperties[]): Promise<Mailing> {
    // Сохраняется всегда: отсутствие поля означает рассылку, созданную до настройки
    properties = { ...properties, listUnsubscribe: properties.listUnsubscribe || false };
    const data = {
      creationDate: properties.creationDate,
      html: properties.html,
      listUnsubscribe: properties.listUnsubscribe,
      name: properties.name,
      openForSubscription: properties.openForSubscription,
      from: properties.from,
      position: 0,
      replyTo: properties.replyTo,
      sentCount: 0,
      state: MailingState.NEW,
      subject: properties.subject,
      undeliveredCount: 0
    };
    const jsonString = this.serializeEntity(data);
    const jsonReceiversList = receivers.map(r => this.serializeReceiver(r));

    return this.redisConnectionPool.runWithConnection(async redisClient => {
      const id = await this.getNextId(redisClient);

      // Создаём общие данные и список рассылки единой транзакцией
      const multi = redisClient.multi();
      multi.set(this.getRedisKey(id), jsonString);
      // RPUSH без значений — ошибка Redis (бывает, если все адреса отброшены фильтром)
      if (jsonReceiversList.length) {
        multi.rPush(this.getReceiversListKey(id), jsonReceiversList);
      }
      await multi.exec();

      const receiversList = receivers.map(props => new Receiver(
        props.email, props.name
      ));
      return new Mailing(id, properties, this, receiversList);
    });
  }

  async getAll (): Promise<Mailing[]> {
    return this.redisConnectionPool.runWithConnection(async redisClient => {
      const maxId = Number(await redisClient.get(this.config.idCounterKey));
      const keys = await redisClient.keys(this.config.commonDataKeyPrefix + '*');
      // Иначе mget выбросит ошибку
      if (!keys.length) {
        return [];
      }
      const ids = keys.map(key => Number(key.replace(this.config.commonDataKeyPrefix, '')));
      const data = await redisClient.mGet(keys);

      return data.map((jsonString, index) => {
        return this.parseEntity(jsonString as string | null, ids[index]);
      }).filter(object =>
        object !== null && object.id <= maxId
      ) as Mailing[];
    });
  }

  async getById (id: number): Promise<Mailing | null> {
    return this.redisConnectionPool.runWithConnection(async redisClient => {
      return this.getByKey(id, redisClient);
    });
  }

  async getByListId (listId: string): Promise<Mailing | null> {
    const mailings = await this.getAll();
    for (const mailing of mailings) {
      if (mailing.listId === listId) {
        return mailing;
      }
    }

    return null;
  }

  async getReceivers (id: number, start: number = 0, stop: number = -1): Promise<Receiver[]> {
    return this.redisConnectionPool.runWithConnection(async redisClient => {
      const key = this.config.receiversListKeyPrefix + id;
      // Вычитаем 1 из stop из-за поведения Redis, которое не совпадает с JS.
      // См. https://redis.io/commands/lrange
      // В JS stop не включительный
      const data = await redisClient.lRange(key, start, stop > 0 ? stop - 1 : stop);

      return data.map(jsonString => this.parseReceiver(jsonString));
    });
  }

  async getExcludedEmails (id: number): Promise<string[]> {
    return this.redisConnectionPool.runWithConnection(async redisClient => {
      return redisClient.sMembers(this.getExcludedReceiversKey(id));
    });
  }

  async getReceiverCount (id: number): Promise<number> {
    return this.redisConnectionPool.runWithConnection(async redisClient => {
      const key = this.config.receiversListKeyPrefix + id;
      return await redisClient.lLen(key);
    });
  }

  async remove (mailing: Mailing): Promise<void> {
    return this.redisConnectionPool.runWithConnection(async redisClient => {
      const key = this.getRedisKey(mailing.id);
      const receiversListKey = this.getReceiversListKey(mailing.id);
      const multi = redisClient.multi();
      multi.del(key);
      multi.del(receiversListKey);
      multi.del(this.getExcludedReceiversKey(mailing.id));
      await multi.exec();
    });
  }

  /**
   * Получатель, на которого указывает position рассылки, или null, если
   * список пройден до конца
   */
  async getNextReceiver (id: number): Promise<Receiver | null> {
    const mailingKey = this.getRedisKey(id);
    const listKey = this.getReceiversListKey(id);
    let receiver: Receiver | null = null;
    await this.genericTransaction(
      [mailingKey, listKey],
      async redisClient => {
        const mailing = await this.getByKey(id, redisClient);
        if (!mailing) {
          return false;
        }
        const [json] = await redisClient.lRange(listKey, mailing.position, mailing.position);
        receiver = json ? this.parseReceiver(json) : null;
        return true;
      },
      // Команда нужна, чтобы EXEC проверил WATCH: position и список прочитаны согласованно
      multi => {
        multi.exists(mailingKey);
      }
    );
    return receiver;
  }

  /**
   * Отмечает получателя обработанным: сдвигает position за него и, если письмо
   * отправлено, увеличивает sentCount. Если получателя за это время удалили из
   * списка, на его месте уже следующий, и position не меняется.
   */
  async advancePosition (id: number, receiver: Receiver, sent: boolean) {
    const mailingKey = this.getRedisKey(id);
    const listKey = this.getReceiversListKey(id);
    let mailing: Mailing | null;
    return this.genericTransaction(
      [mailingKey, listKey],
      async redisClient => {
        mailing = await this.getByKey(id, redisClient);
        if (!mailing) {
          return false;
        }
        const [json] = await redisClient.lRange(listKey, mailing.position, mailing.position);
        if (json && this.parseReceiver(json).email === receiver.email) {
          mailing.position++;
        }
        if (sent) {
          mailing.sentCount++;
        }
        return true;
      },
      multi => {
        multi.set(mailingKey, this.serializeEntity(mailing!));
        return mailing;
      }
    );
  }

  /**
   * Удаляет получателя. Если он стоял до position, position уменьшается, иначе
   * сдвиг списка пропустил бы следующего получателя. Адрес, исключённый из-за
   * ошибок доставки (excluded), запоминается для отчёта об ошибках.
   */
  async removeReceiver (id: number, receiver: Receiver, excluded = false) {
    const mailingKey = this.getRedisKey(id);
    const listKey = this.getReceiversListKey(id);
    const json = this.serializeReceiver(receiver);
    let mailing: Mailing | null;
    let removedBeforePosition = 0;
    const removed = await this.genericTransaction(
      [mailingKey, listKey],
      async redisClient => {
        const list = await redisClient.lRange(listKey, 0, -1);
        if (!list.includes(json)) {
          return false;
        }
        mailing = await this.getByKey(id, redisClient);
        removedBeforePosition = mailing ?
          list.slice(0, mailing.position).filter(item => item === json).length : 0;
        return true;
      },
      multi => {
        multi.lRem(listKey, 0, json);
        if (excluded) {
          multi.sAdd(this.getExcludedReceiversKey(id), receiver.email);
        }
        if (mailing && removedBeforePosition) {
          mailing.position -= removedBeforePosition;
          multi.set(mailingKey, this.serializeEntity(mailing));
        }
        return true;
      }
    );
    return Boolean(removed);
  }

  async setReceivers (id: number, receivers: Receiver[]): Promise<void> {
    return this.redisConnectionPool.runWithConnection(async redisClient => {
      const jsonReceiversList = receivers.map(r => this.serializeReceiver(r));
      const key = this.getReceiversListKey(id);

      const multi = redisClient.multi();
      multi.del(key);
      if (jsonReceiversList.length) {
        multi.rPush(key, jsonReceiversList);
      }
      await multi.exec();
    });
  }


  protected extractKey () {
    return 1;
  }

  protected async getByKey (id: number, client: RedisClient): Promise<Mailing | null> {
    const json = await client.get(this.getRedisKey(id));
    return this.parseEntity(json, id);
  }

  protected getRedisKey (id: number): string {
    return this.config.commonDataKeyPrefix + id;
  }

  protected parseEntity (jsonString: string | null, id: number): Mailing | null {
    if (!jsonString) { return null; }
    const object = JSON.parse(jsonString);
    if (Number.isInteger(object.creationDate)) {
      object.creationDate = new Date(object.creationDate * 1000);
    }
    return new Mailing(id, object, this);
  }

  protected serializeEntity (properties: MailingProperties): string {
    return JSON.stringify({
      autoResumeAt: properties.autoResumeAt,
      creationDate: properties.creationDate ?
        Math.floor(properties.creationDate.getTime() / 1000) : undefined,
      extraData: properties.extraData,
      html: properties.html,
      listId: properties.listId,
      listUnsubscribe: properties.listUnsubscribe,
      name: properties.name,
      openForSubscription: properties.openForSubscription,
      from: properties.from,
      position: properties.position,
      replyTo: properties.replyTo,
      sentCount: properties.sentCount,
      state: properties.state,
      subject: properties.subject,
      undeliveredCount: properties.undeliveredCount
    });
  }


  private getExcludedReceiversKey (id: number): string {
    return this.config.excludedReceiversKeyPrefix + id;
  }

  private getReceiversListKey (id: number): string {
    return this.config.receiversListKeyPrefix + id;
  }

  private async getNextId (client: RedisClient): Promise<number> {
    return client.incr(this.config.idCounterKey);
  }

  private parseReceiver (jsonString: string): Receiver {
    const object = JSON.parse(jsonString);
    return new Receiver(
      object.email, object.name, object.code, object.periodicDate, object.extraData
    );
  }

  private serializeReceiver (receiver: ReceiverProperties): string {
    return JSON.stringify({
      code: receiver.code,
      email: receiver.email,
      name: receiver.name,
      periodicDate: receiver.periodicDate,
      extraData: receiver.extraData
    });
  }
}
