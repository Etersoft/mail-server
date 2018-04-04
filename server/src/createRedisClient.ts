import { createClient, RedisClient, Multi, ClientOpts } from 'redis';
import { promisifyAll } from 'bluebird';


export interface PromiseMulti extends Multi {
  execAsync (): Promise<string[]>;
}

export interface PromiseRedisClient extends RedisClient {
  delAsync (key: string): Promise<void>;
  getAsync (key: string): Promise<string>;
  hgetAsync (key: string, field: string): Promise<string>;
  hsetAsync (key: string, field: string, value: string): Promise<void>;
  keysAsync (pattern: string): Promise<string[]>;
  incrAsync (key: string): Promise<number>;
  lrangeAsync (key: string, from: number, to: number): Promise<string[]>;
  multi (): PromiseMulti;
  mgetAsync (keys: string[]): Promise<string[]>;
  setAsync (key: string, value: string): Promise<void>;
}

export function createRedisClient (config: any): PromiseRedisClient {
  promisifyAll(RedisClient.prototype);
  promisifyAll(Multi.prototype);
  const client = createClient(config);
  return client as PromiseRedisClient;
}
