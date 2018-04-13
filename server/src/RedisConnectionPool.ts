import { PromiseRedisClient, createRedisClient } from './createRedisClient';
import { createPool, Pool, Options } from 'generic-pool';


export interface RedisConnectionPool {
  close (): Promise<void>;
  runWithConnection<T> (
    scenario: (client: PromiseRedisClient) => Promise<T>
  ): Promise<T>;
}

export class RedisConnectionPoolImpl implements RedisConnectionPool {
  private pool: Pool<PromiseRedisClient>;

  constructor (
    redisConfig: any,
    poolOptions: Options
  ) {
    this.pool = createPool({
      create () {
        return createRedisClient(redisConfig);
      },
      destroy (client) {
        return new Promise(resolve => {
          client.once('end', resolve);
          client.quit();
        });
      }
    }, poolOptions);
  }

  async acquire (): Promise<PromiseRedisClient> {
    return this.pool.acquire();
  }

  async close () {
    await this.pool.drain();
    await this.pool.clear();
  }

  async release (client: PromiseRedisClient): Promise<void> {
    await this.pool.release(client);
  }
  
  async runWithConnection<T> (
    scenario: (client: PromiseRedisClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.acquire();
    const result = await scenario(client);
    await this.pool.release(client);
    return result;
  }
}
