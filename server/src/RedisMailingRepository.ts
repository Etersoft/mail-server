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
  constructor (
    protected readonly redisClient: PromiseRedisClient,
    protected readonly config: RedisMailingRepositoryConfig = defaultConfig
  ) {}

  async create (properties: MailingProperties, receivers: ReceiverProperties[]): Promise<Mailing> {
    const data = {
      name: properties.name,
      sentCount: 0,
      state: MailingState.NEW
    };
    const jsonString = JSON.stringify(data);
    const jsonReceiversList = receivers.map(props => JSON.stringify({
      email: props.email,
      name: props.name
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
      if (!jsonString) { return null; }
      const object = JSON.parse(jsonString);
      return new Mailing(ids[index], object, this);
    }).filter(object =>
      object !== null && object.id <= maxId
    ) as Mailing[];
    // filter нужен, чтобы обработать ситуацию, когда в промежутке между
    // keysAsync() и mgetAsync() что-то удалили из редиса
    // Если данных по ключу нет, то mget вернёт null для него
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
