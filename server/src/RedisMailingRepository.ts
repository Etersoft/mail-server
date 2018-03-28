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
  idCounterKey: 'MAILING_KEY_COUNTER',
  receiversListKeyPrefix: 'MAILING_RECEIVER_LIST_'
}

export class RedisMailingRepository implements MailingRepository {
  constructor (
    protected readonly redisClient: PromiseRedisClient,
    protected readonly config: RedisMailingRepositoryConfig = defaultConfig
  ) {}

  async create (properties: MailingProperties, receivers: ReceiverProperties[]): Promise<Mailing> {
    const data = {
      name: properties.name,
      state: MailingState.NEW,
      sentCount: 0
    };
    const jsonString = JSON.stringify(data);
    const jsonReceiversList = receivers.map(properties => JSON.stringify({
      email: properties.email,
      name: properties.name
    }));

    const id = await this.getNextId();

    // Создаём общие данные и список рассылки единой транзакцией
    const multi = this.redisClient.multi();
    multi.set(this.getCommonDataKey(id), jsonString);
    multi.rpush(this.getReceiversListKey(id), jsonReceiversList);
    await multi.execAsync();

    const receiversList = receivers.map(properties => new Receiver(
      properties.email, properties.name
    ));
    return new Mailing(id, properties, this, receiversList);
  }

  async getAll (): Promise<Mailing[]> {
    const keys = await this.redisClient.keysAsync(this.config.commonDataKeyPrefix + '*');
    if (!keys.length) {
      return [];
    }
    const ids = keys.map(key => Number(key.replace(this.config.commonDataKeyPrefix, '')));   
    const data = await this.redisClient.mgetAsync(keys);

    return data.map((jsonString, index) => {
      if (!jsonString) return null;
      const object = JSON.parse(jsonString);
      return new Mailing(ids[index], object, this);
    }).filter(object => object !== null) as Mailing[];
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

  }

  async update (mailing: Mailing): Promise<void> {

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
}