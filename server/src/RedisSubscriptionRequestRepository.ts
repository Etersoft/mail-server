import { BaseRedisRepository } from './BaseRedisRepository';
import { RedisConnectionPool } from './RedisConnectionPool';
import { SubscriptionRequest, SubscriptionRequestProperties } from './SubscriptionRequest';
import { SubscriptionRequestRepository } from './SubscriptionRequestRepository';


export class RedisSubscriptionRequestRepository
extends BaseRedisRepository<SubscriptionRequest, SubscriptionRequestProperties, {
  email: string, mailingId: number
}>
implements SubscriptionRequestRepository {
  constructor (
    redisConnectionPool: RedisConnectionPool,
    protected readonly ttl: number,
    protected readonly prefix: string = 'SUBSCRIPTION_REQUEST_'
  ) {
    super(redisConnectionPool);
  }

  create (properties: SubscriptionRequestProperties): Promise<SubscriptionRequest> {
    return this.redisConnectionPool.runWithConnection(async redisClient => {
      const jsonString = this.serializeEntity(properties);
      await redisClient.setAsync(
        this.getRedisKey(this.extractKey(properties)), jsonString,
        'EX', this.ttl
      );
      return new SubscriptionRequest(properties);
    });
  }  

  
  protected extractKey (props: SubscriptionRequestProperties) {
    return props;
  }

  protected getRedisKey (key: { email: string, mailingId: number }) {
    return this.prefix + key.mailingId + '_' + key.email;
  }

  protected parseEntity (jsonString: string | null): SubscriptionRequest | null {
    if (!jsonString) { return null; }
    const object = JSON.parse(jsonString);
    return new SubscriptionRequest({
      email: object.email,
      mailingId: object.mailingId,
      code: object.code,
      periodicDate: object.periodicDate
    });
  }

  protected serializeEntity (properties: SubscriptionRequestProperties): string {
    return JSON.stringify({
      email: properties.email,
      mailingId: properties.mailingId,
      code: properties.code,
      periodicDate: properties.periodicDate
    });
  }
}
