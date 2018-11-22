import { readConfig } from '../src/readConfig';
import { RedisConnectionPoolImpl } from '../src/RedisConnectionPool';
import * as sinon from 'sinon';


const config = readConfig();

export function createFakeLogger () {
  return {
    debug: sinon.spy(),
    error: sinon.spy(),
    info: sinon.spy(),
    silly: sinon.spy(),
    warning: sinon.spy()
  } as any;
}

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

export function sleep (ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
