import { PromiseRedisClient } from './createRedisClient';
import { Mailing, MailingProperties, MailingState } from './Mailing';
import { Receiver, ReceiverProperties } from './Receiver';
import { MailingRepository } from './MailingRepository';
import { BaseRedisRepository } from './BaseRedisRepository';
import { RedisConnectionPool } from './RedisConnectionPool';
import * as moment from 'moment';


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

export class RedisMailingRepository
extends BaseRedisRepository<Mailing, MailingProperties, number>
implements MailingRepository {
  private listIdMailingCache = new Map<string, Mailing>();

  constructor (
    redisConnectionPool: RedisConnectionPool,
    protected readonly config: RedisMailingRepositoryConfig = defaultConfig
  ) {
    super(redisConnectionPool);
  }

  addReceiver (mailingId: number, receiver: Receiver) {
    return this.redisConnectionPool.runWithConnection(async redisClient => {
      const key = this.getReceiversListKey(mailingId);
      const item = this.serializeReceiver(receiver);
      await redisClient.rpushAsync(key, [item]);
    });
  }

  async create (properties: MailingProperties, receivers: ReceiverProperties[]): Promise<Mailing> {
    const data = {
      creationDate: properties.creationDate,
      html: properties.html,
      name: properties.name,
      openForSubscription: properties.openForSubscription,
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
      multi.rpush(this.getReceiversListKey(id), jsonReceiversList);
      await multi.execAsync();

      const receiversList = receivers.map(props => new Receiver(
        props.email, props.name
      ));
      return new Mailing(id, properties, this, receiversList);
    });
  }

  async getAll (): Promise<Mailing[]> {
    return this.redisConnectionPool.runWithConnection(async redisClient => {
      const maxId = Number(await redisClient.getAsync(this.config.idCounterKey));
      const keys = await redisClient.keysAsync(this.config.commonDataKeyPrefix + '*');
      // Иначе mget выбросит ошибку
      if (!keys.length) {
        return [];
      }
      const ids = keys.map(key => Number(key.replace(this.config.commonDataKeyPrefix, '')));
      const data = await redisClient.mgetAsync(keys);

      return data.map((jsonString, index) => {
        return this.parseEntity(jsonString, ids[index]);
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
      const data = await redisClient.lrangeAsync(key, start, stop > 0 ? stop - 1 : stop);

      return data.map(jsonString => {
        const object = JSON.parse(jsonString);
        return new Receiver(object.email, object.name, object.code, object.periodicDate);
      });
    });
  }

  async getReceiverCount (id: number): Promise<number> {
    return this.redisConnectionPool.runWithConnection(async redisClient => {
      const key = this.config.receiversListKeyPrefix + id;
      return await redisClient.llenAsync(key);
    });
  }

  async remove (mailing: Mailing): Promise<void> {
    return this.redisConnectionPool.runWithConnection(async redisClient => {
      const key = this.getRedisKey(mailing.id);
      const receiversListKey = this.getReceiversListKey(mailing.id);
      const multi = redisClient.multi();
      multi.del(key);
      multi.del(receiversListKey);
      await multi.execAsync();
    });
  }

  async removeReceiver (id: number, receiver: Receiver) {
    return this.redisConnectionPool.runWithConnection(async redisClient => {
      const key = this.getReceiversListKey(id);
      const json = this.serializeReceiver(receiver);
      return Boolean(await redisClient.lremAsync(key, 0, json));
    });
  }

  async setReceivers (id: number, receivers: Receiver[]): Promise<void> {
    return this.redisConnectionPool.runWithConnection(async redisClient => {
      const jsonReceiversList = receivers.map(r => this.serializeReceiver(r));
      const key = this.getReceiversListKey(id);

      const multi = redisClient.multi();
      multi.del(key);
      if (jsonReceiversList.length) {
        multi.rpush(key, jsonReceiversList);
      }
      await multi.execAsync();
    });
  }


  protected extractKey () {
    return 1;
  }

  protected async getByKey (id: number, client: PromiseRedisClient): Promise<Mailing | null> {
    const json = await client.getAsync(this.getRedisKey(id));
    return this.parseEntity(json, id);
  }

  protected getRedisKey (id: number): string {
    return this.config.commonDataKeyPrefix + id;
  }

  protected parseEntity (jsonString: string | null, id: number): Mailing | null {
    if (!jsonString) { return null; }
    const object = JSON.parse(jsonString);
    if (Number.isInteger(object.creationDate)) {
      object.creationDate = moment.unix(object.creationDate);
    }
    return new Mailing(id, object, this);
  }

  protected serializeEntity (properties: MailingProperties): string {
    return JSON.stringify({
      creationDate: properties.creationDate ? properties.creationDate.unix() : undefined,
      html: properties.html,
      listId: properties.listId,
      name: properties.name,
      openForSubscription: properties.openForSubscription,
      replyTo: properties.replyTo,
      sentCount: properties.sentCount,
      state: properties.state,
      subject: properties.subject,
      undeliveredCount: properties.undeliveredCount
    });
  }


  private getReceiversListKey (id: number): string {
    return this.config.receiversListKeyPrefix + id;
  }

  private async getNextId (client: PromiseRedisClient): Promise<number> {
    return client.incrAsync(this.config.idCounterKey);
  }

  private serializeReceiver (receiver: ReceiverProperties): string {
    return JSON.stringify({
      code: receiver.code,
      email: receiver.email,
      name: receiver.name,
      periodicDate: receiver.periodicDate
    });
  }
}
