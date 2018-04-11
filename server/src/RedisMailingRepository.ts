import { PromiseRedisClient } from './createRedisClient';
import { Mailing, MailingProperties, MailingState } from './Mailing';
import { Receiver, ReceiverProperties } from './Receiver';
import { MailingRepository } from './MailingRepository';


export interface RedisMailingRepositoryConfig {
  commonDataKeyPrefix: string;
  idCounterKey: string;
  receiversListKeyPrefix: string;
}

const defaultConfig: RedisMailingRepositoryConfig = {
  commonDataKeyPrefix: 'MAILING_COMMON_DATA_',
  idCounterKey: 'MAILING_ID_COUNTER',
  receiversListKeyPrefix: 'MAILING_RECEIVER_LIST_'
};

export class RedisMailingRepository implements MailingRepository {
  private listIdMailingCache = new Map<string, Mailing>();

  constructor (
    protected readonly redisClient: PromiseRedisClient,
    protected readonly config: RedisMailingRepositoryConfig = defaultConfig
  ) {}

  async create (properties: MailingProperties, receivers: ReceiverProperties[]): Promise<Mailing> {
    const data = {
      headers: properties.headers,
      html: properties.html,
      name: properties.name,
      sentCount: 0,
      state: MailingState.NEW,
      subject: properties.subject,
      undeliveredCount: 0
    };
    const jsonString = this.serializeMailing(data);
    const jsonReceiversList = receivers.map(props => JSON.stringify({
      email: props.email
    }));

    const id = await this.getNextId();

    // Создаём общие данные и список рассылки единой транзакцией
    const multi = this.redisClient.multi();
    multi.set(this.getCommonDataKey(id), jsonString);
    multi.rpush(this.getReceiversListKey(id), jsonReceiversList);
    await multi.execAsync();

    const receiversList = receivers.map(props => new Receiver(
      props.email, props.name
    ));
    return new Mailing(id, properties, this, receiversList);
  }

  async getAll (): Promise<Mailing[]> {
    const maxId = Number(await this.redisClient.getAsync(this.config.idCounterKey));
    const keys = await this.redisClient.keysAsync(this.config.commonDataKeyPrefix + '*');
    // Иначе mget выбросит ошибку
    if (!keys.length) {
      return [];
    }
    const ids = keys.map(key => Number(key.replace(this.config.commonDataKeyPrefix, '')));
    const data = await this.redisClient.mgetAsync(keys);

    return data.map((jsonString, index) => {
      return this.parseMailing(jsonString, ids[index]);
    }).filter(object =>
      object !== null && object.id <= maxId
    ) as Mailing[];
    // filter нужен, чтобы обработать ситуацию, когда в промежутке между
    // keysAsync() и mgetAsync() что-то удалили из редиса
    // Если данных по ключу нет, то mget вернёт null для него
  }

  async getById (id: number): Promise<Mailing | null> {
    const jsonString = await this.redisClient.getAsync(this.getCommonDataKey(id));
    return this.parseMailing(jsonString, id);
  }

  async getByListId (listId: string): Promise<Mailing | null> {
    if (this.listIdMailingCache.has(listId)) {
      return this.listIdMailingCache.get(listId)!;
    }

    const mailings = await this.getAll();
    for (const mailing of mailings) {
      if (mailing.listId !== undefined) {
        this.listIdMailingCache.set(mailing.listId, mailing);
      }
    }

    return this.listIdMailingCache.get(listId) || null;
  }

  async getReceivers (id: number): Promise<Receiver[]> {
    const key = this.config.receiversListKeyPrefix + id;
    const data = await this.redisClient.lrangeAsync(key, 0, -1);

    return data.map(jsonString => {
      const object = JSON.parse(jsonString);
      return new Receiver(object.email, object.name);
    });
  }

  async remove (mailing: Mailing): Promise<void> {
    const key = this.getCommonDataKey(mailing.id);
    const receiversListKey = this.getReceiversListKey(mailing.id);
    const multi = this.redisClient.multi();
    multi.del(key);
    multi.del(receiversListKey);
    await multi.execAsync();
  }

  async update (mailing: Mailing): Promise<void> {
    if (!mailing.id) {
      throw new Error('Attempt to update mailing without ID');
    }

    const jsonString = this.serializeMailing(mailing);

    await this.redisClient.setAsync(this.getCommonDataKey(mailing.id), jsonString);
  }


  private getCommonDataKey (id: number): string {
    return this.config.commonDataKeyPrefix + id;
  }

  private getReceiversListKey (id: number): string {
    return this.config.receiversListKeyPrefix + id;
  }

  private async getNextId (): Promise<number> {
    return this.redisClient.incrAsync(this.config.idCounterKey);
  }

  private parseMailing (jsonString: string | null, id: number): Mailing | null {
    if (!jsonString) { return null; }
    const object = JSON.parse(jsonString);
    return new Mailing(id, object, this);
  }

  private serializeMailing (properties: MailingProperties): string {
    return JSON.stringify({
      headers: properties.headers,
      html: properties.html,
      listId: properties.listId,
      name: properties.name,
      sentCount: properties.sentCount,
      state: properties.state,
      subject: properties.subject
    });
  }
}
