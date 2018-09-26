import { createClient, RedisClient, Multi, ClientOpts } from 'redis';
import { promisifyAll } from 'bluebird';


export interface PromiseMulti extends Multi {
  execAsync (): Promise<string[]>;
}

export interface PromiseRedisClient extends RedisClient {
  delAsync (key: string): Promise<void>;
  flushdbAsync (): Promise<void>;
  getAsync (key: string): Promise<string>;
  hgetAsync (key: string, field: string): Promise<string>;
  hsetAsync (key: string, field: string, value: string): Promise<void>;
  keysAsync (pattern: string): Promise<string[]>;
  incrAsync (key: string): Promise<number>;
  llenAsync (key: string): Promise<number>;
  lrangeAsync (key: string, from: number, to: number): Promise<string[]>;
  multi (): PromiseMulti;
  mgetAsync (keys: string[]): Promise<string[]>;
  rpushAsync (key: string, items: string[]): Promise<void>;
  setAsync (key: string, value: string): Promise<void>;
  unwatchAsync (): Promise<void>;
  watchAsync (keys: string[]): Promise<void>;
}

promisifyAll(RedisClient.prototype);
promisifyAll(Multi.prototype);

export function createRedisClient (config: any): Promise<PromiseRedisClient> {
  return new Promise<PromiseRedisClient>((resolve, reject) => {
    const client = createClient(config);
    client.once('error', reject);
    client.once('ready', () => resolve(client as PromiseRedisClient));
  });
}
