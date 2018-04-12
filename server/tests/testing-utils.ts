import { createRedisClient, PromiseRedisClient } from '../src/createRedisClient';
import { readConfig } from '../src/readConfig';


const config = readConfig();

export function getTestingRedisConnection () {
  return new Promise<PromiseRedisClient>(resolve => {
    const client = createRedisClient(Object.assign({}, config.server.redis, {
      db: config.server.redis.testingDb
    }));
    client.on('ready', async () => {
      await client.flushdbAsync();
      resolve(client);
    });
  });
}

export function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
