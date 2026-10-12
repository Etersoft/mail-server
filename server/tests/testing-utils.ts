import { mock } from 'node:test';
import { Logger } from '../src/Logger';
import { RedisConnectionPoolImpl } from '../src/RedisConnectionPool';


// Тестовая база Redis задаётся только явно: тесты очищают её (FLUSHDB).
// Например: TEST_REDIS_URL=redis://127.0.0.1:16379/1 npm test
export const TEST_REDIS_URL = process.env.TEST_REDIS_URL;

// Для describe(..., { skip: redisSkip }): пропуск тестов без TEST_REDIS_URL
export const redisSkip = TEST_REDIS_URL ? false : 'TEST_REDIS_URL is not set';

export function createFakeLogger () {
  return {
    debug: mock.fn(),
    error: mock.fn(),
    info: mock.fn(),
    silly: mock.fn(),
    verbose: mock.fn(),
    warn: mock.fn()
  } as unknown as Logger;
}

export async function getTestingRedisConnectionPool () {
  if (!TEST_REDIS_URL) {
    throw new Error('TEST_REDIS_URL is not set');
  }
  const pool = new RedisConnectionPoolImpl({ url: TEST_REDIS_URL }, { max: 5, min: 1 });
  await pool.runWithConnection(client => client.flushDb());
  return pool;
}

export interface LockObject {
  unlock (): void;
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
