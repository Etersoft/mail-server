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
extends BaseRedisRepository<AddressStats, AddressStatsProperties, string>
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
      await redisClient.setAsync(this.getRedisKey(this.extractKey(properties)), jsonString);
      return new AddressStats(properties);
    });
  }  

  getByEmail (email: string): Promise<AddressStats | null> {
    return this.get(email);
  }


  protected extractKey (props: AddressStatsProperties): string {
    return props.email;
  }

  protected getRedisKey (email: string): string {
    return this.config.addressStatsKeyPrefix + email;
  }

  protected serializeEntity (properties: AddressStatsProperties): string {
    return JSON.stringify({
      diagnosticCode: properties.diagnosticCode,
      email: properties.email,
      lastSendDate: properties.lastSendDate && properties.lastSendDate.toISOString(),
      lastStatus: properties.lastStatus,
      lastStatusDate: properties.lastStatusDate && properties.lastStatusDate.toISOString(),
      sentCount: properties.sentCount,
      spam: properties.spam,
      temporaryFailureCount: properties.temporaryFailureCount
    });
  }

  protected parseEntity (jsonString: string | null): AddressStats | null {
    if (!jsonString) { return null; }
    const object = JSON.parse(jsonString);
    return new AddressStats({
      diagnosticCode: object.diagnosticCode,
      email: object.email,
      lastSendDate: object.lastSendDate && new Date(object.lastSendDate),
      lastStatus: object.lastStatus,
      lastStatusDate: object.lastStatusDate && new Date(object.lastStatusDate),
      sentCount: object.sentCount,
      spam: Boolean(object.spam),
      temporaryFailureCount: object.temporaryFailureCount
    });
  }
}
