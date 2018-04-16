import { PromiseRedisClient } from './createRedisClient';
import { AddressStatsRepository } from './AddressStatsRepository';
import { AddressStatsProperties, AddressStats } from './AddressStats';
import { BaseRedisRepository } from './BaseRedisRepository';
import { RedisConnectionPool } from './RedisConnectionPool';


export interface RedisAddressStatsRepositoryConfig {
  addressStatsKeyPrefix: string;
}

const defaultConfig: RedisAddressStatsRepositoryConfig = {
  addressStatsKeyPrefix: 'ADDRESS_STATS_'
};

export class RedisAddressStatsRepository
extends BaseRedisRepository<AddressStats, string>
implements AddressStatsRepository {
  constructor (
    redisConnectionPool: RedisConnectionPool,
    protected readonly config: RedisAddressStatsRepositoryConfig = defaultConfig
  ) {
    super(redisConnectionPool);
  }

  create (properties: AddressStatsProperties): Promise<AddressStats> {
    return this.redisConnectionPool.runWithConnection(async redisClient => {
      const jsonString = this.serializeEntity(properties);
      await redisClient.set(this.getCommonDataKey(properties.email), jsonString);
      return new AddressStats(properties);
    });
  }

  getByEmail (email: string): Promise<AddressStats | null> {
    return this.redisConnectionPool.runWithConnection(async redisClient => {
      return this.getByKey(email, redisClient);
    });
  }

  update (stats: AddressStats): Promise<void> {
    return this.redisConnectionPool.runWithConnection(async redisClient => {
      const jsonString = this.serializeEntity(stats);
      await redisClient.setAsync(this.getCommonDataKey(stats.email), jsonString);
    });
  }


  protected async getByKey (email: string, redisClient: PromiseRedisClient) {
    const jsonString = await redisClient.getAsync(this.getCommonDataKey(email));
    return this.parseAddressStats(jsonString);
  }

  protected getCommonDataKey (email: string): string {
    return this.config.addressStatsKeyPrefix + email;
  }

  protected serializeEntity (properties: AddressStatsProperties): string {
    return JSON.stringify({
      email: properties.email,
      lastSendDate: properties.lastSendDate.toISOString(),
      lastStatus: properties.lastStatus,
      lastStatusDate: properties.lastStatusDate && properties.lastStatusDate.toISOString(),
      sentCount: properties.sentCount,
      temporaryFailureCount: properties.temporaryFailureCount
    });
  }

  private parseAddressStats (jsonString: string | null): AddressStats | null {
    if (!jsonString) { return null; }
    const object = JSON.parse(jsonString);
    return new AddressStats({
      email: object.email,
      lastSendDate: new Date(object.lastSendDate),
      lastStatus: object.lastStatus,
      lastStatusDate: object.lastStatusDate && new Date(object.lastStatusDate),
      sentCount: object.sentCount,
      temporaryFailureCount: object.temporaryFailureCount
    });
  }
}
