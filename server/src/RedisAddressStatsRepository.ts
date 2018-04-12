import { PromiseRedisClient } from './createRedisClient';
import { AddressStatsRepository } from './AddressStatsRepository';
import { AddressStatsProperties, AddressStats } from './AddressStats';


export interface RedisAddressStatsRepositoryConfig {
  addressStatsKeyPrefix: string;
}

const defaultConfig: RedisAddressStatsRepositoryConfig = {
  addressStatsKeyPrefix: 'ADDRESS_STATS_'
};

export class RedisAddressStatsRepository implements AddressStatsRepository {
  constructor (
    protected readonly redisClient: PromiseRedisClient,
    protected readonly config: RedisAddressStatsRepositoryConfig = defaultConfig
  ) {}

  async create (properties: AddressStatsProperties): Promise<AddressStats> {
    const jsonString = this.serializeAddressStats(properties);
    await this.redisClient.set(this.getCommonDataKey(properties.email), jsonString);
    return new AddressStats(properties);
  }

  async getByEmail (email: string): Promise<AddressStats | null> {
    const jsonString = await this.redisClient.getAsync(this.getCommonDataKey(email));
    return this.parseAddressStats(jsonString);
  }

  async update (stats: AddressStats): Promise<void> {
    const jsonString = this.serializeAddressStats(stats);
    await this.redisClient.setAsync(this.getCommonDataKey(stats.email), jsonString);
  }

  async updateInTransaction (
    email: string, scenario: (stats: AddressStats) => Promise<void>
  ): Promise<AddressStats | null> {
    // Реализуем optimistic locking, чтобы бороться с параллельными обновлениями
    // одного и того же объекта
    while (true) {
      // Отслеживаем изменения ключа. Если он изменится с момента вызова
      // watch, всё выполнится заново.
      const key = this.getCommonDataKey(email);
      // TODO: здесь необходим connection pool для 100% корректной работы
      await this.redisClient.watchAsync([ key ]);
      const stats = await this.getByEmail(email);
      if (!stats) {
        await this.redisClient.unwatchAsync();
        return null;
      }
      await scenario(stats);
      // Пробуем обновить...
      const multi = this.redisClient.multi();
      const jsonString = this.serializeAddressStats(stats);
      multi.set(key, jsonString);
      // Если exec завершился успешно, то выходим.
      // Если нет, то начинаем заново...
      if (await multi.execAsync()) {
        return stats;
      }
    }
  }


  private getCommonDataKey (email: string): string {
    return this.config.addressStatsKeyPrefix + email;
  }

  private parseAddressStats (jsonString: string | null): AddressStats | null {
    if (!jsonString) { return null; }
    const object = JSON.parse(jsonString);
    return new AddressStats({
      email: object.email,
      lastSendDate: new Date(object.lastSendDate),
      lastStatus: object.lastStatus,
      lastStatusDate: object.lastStatusDate && new Date(object.lastStatusDate),
      sentCount: object.sentCount
    });
  }

  private serializeAddressStats (properties: AddressStatsProperties): string {
    return JSON.stringify({
      email: properties.email,
      lastSendDate: properties.lastSendDate.toISOString(),
      lastStatus: properties.lastStatus,
      lastStatusDate: properties.lastStatusDate && properties.lastStatusDate.toISOString(),
      sentCount: properties.sentCount
    });
  }
}
