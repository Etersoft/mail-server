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
