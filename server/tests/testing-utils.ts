import { createRedisClient, PromiseRedisClient } from '../src/createRedisClient';
import { readConfig } from '../src/readConfig';
import { RedisConnectionPoolImpl } from '../src/RedisConnectionPool';


const config = readConfig();

export async function getTestingRedisConnectionPool () {
  const pool = new RedisConnectionPoolImpl(Object.assign({}, config.server.redis, {
    db: config.server.redis.testingDb
  }), config.server.redis.pool);
  await pool.runWithConnection(client => client.flushdbAsync());
  return pool;
}

export interface LockObject {
  unlock ();
  waitForUnlock (): Promise<void>;
}

export function lock (): LockObject {
  let locked = true;
  let unlockCallbacks: Array<() => void> = [];
  return {
    unlock: () => {
      locked = false;
      for (const callback of unlockCallbacks) {
        callback();
      }
      unlockCallbacks = [];
    },
    waitForUnlock: () => {
      return new Promise(resolve => {
        if (!locked) {
          resolve();
        } else {
          unlockCallbacks.push(resolve);
        }
      });
    }
  };
}

export function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
