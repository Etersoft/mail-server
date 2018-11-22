// tslint:disable:no-shadowed-variable
import { RedisAddressStatsRepository } from '../src/RedisAddressStatsRepository';
import { assert, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import 'mocha';
import { AddressStats } from '../src/AddressStats';
import { spy } from 'sinon';
import { getTestingRedisConnectionPool, lock } from './testing-utils';


use(chaiAsPromised);

const testEmail = 'test-email-address@etersoft.ru';
const nonExistentEmail = 'test-non-existent@etersoft.ru';
const diagnosticCode = 'smtp; 500 test 123';

describe('RedisAddressStatsRepository', () => {
  describe('#updateInTransaction', () => {
    let redisConnectionPool, repositoryOne, repositoryTwo;
    after(async () => {
      await redisConnectionPool.close();
    });

    before(async () => {
      redisConnectionPool = await getTestingRedisConnectionPool();
      [repositoryOne, repositoryTwo] = [
        new RedisAddressStatsRepository(redisConnectionPool),
        new RedisAddressStatsRepository(redisConnectionPool)
      ];
    });

    beforeEach(async () => {
      await repositoryOne.create({
        diagnosticCode,
        email: testEmail,
        lastSendDate: new Date(2018, 0),
        sentCount: 0
      });
    });

    it('should correctly find and update address stats object', async () => {
      const object = await repositoryOne.updateInTransaction(
        testEmail,
        async (stats: AddressStats) => {
          stats.sentCount += 1;
        }
      );
      assert.isNotNull(object);
      assert.equal(object.sentCount, 1);
      assert.equal(object.email, testEmail);
      assert.equal((await repositoryOne.getByEmail(testEmail)).sentCount, 1);
    });

    it('should store spam = false by default', async () => {
      const object = await repositoryOne.getByEmail(testEmail);
      assert.equal(object.spam, false);
    });

    it('should update spam flag', async () => {
      const object = await repositoryOne.updateInTransaction(
        testEmail,
        async (stats: AddressStats) => {
          stats.spam = true;
        }
      );
      assert.equal(object.spam, true);
    });

    it('should store diagnosticCode', async () => {
      const object = await repositoryOne.getByEmail(testEmail);
      assert.equal(object.diagnosticCode, diagnosticCode);
    });

    it('should update diagnosticCode', async () => {
      await repositoryOne.updateInTransaction(
        testEmail,
        async (stats: AddressStats) => {
          stats.diagnosticCode = 'test';
        }
      );
      const object = await repositoryOne.getByEmail(testEmail);
      assert.equal(object.diagnosticCode, 'test');
    });

    it('should return null for non-existent emails', async () => {
      const object = await repositoryOne.updateInTransaction(
        nonExistentEmail,
        async (stats: AddressStats) => {
          stats.sentCount += 1;
        }
      );
      assert.isNull(object);
    });

    it('should not call scenario for non-existent emails', async () => {
      const transactionCallback = spy();
      const object = await repositoryOne.updateInTransaction(
        nonExistentEmail,
        async (stats: AddressStats) => {
          transactionCallback();
        }
      );
      assert.isFalse(transactionCallback.called);
    });

    it('should repeat transaction after modification in same repository', async () => {
      const stats = await repositoryOne.getByEmail(testEmail);
      const transactionCallback = spy();
      const transactionUpdateLock = lock();
      const badUpdateLock = lock();

      const promise = repositoryOne.updateInTransaction(testEmail, async (stats: AddressStats) => {
        badUpdateLock.unlock();
        // Ждём завершения некорректного изменения...
        await transactionUpdateLock.waitForUnlock();
        stats.sentCount += 1;
        transactionCallback();
      });
      stats.lastSendDate = new Date(2017, 0);

      // Ждём начала выполнения сценария изменения...
      await badUpdateLock.waitForUnlock();
      await repositoryOne.update(stats);
      transactionUpdateLock.unlock();
      await promise;
      // Проверяем, что сценарий транзакции выполнился дважды из-за изменения lastSendDate
      assert.isTrue(transactionCallback.calledTwice);
    });

    it('should repeat transaction after modification in other repository', async () => {
      const stats = await repositoryOne.getByEmail(testEmail);
      const transactionCallback = spy();
      const transactionUpdateLock = lock();
      const badUpdateLock = lock();

      const promise = repositoryTwo.updateInTransaction(testEmail, async (stats: AddressStats) => {
        badUpdateLock.unlock();
        // Ждём завершения некорректного изменения...
        await transactionUpdateLock.waitForUnlock();
        stats.sentCount += 1;
        transactionCallback();
      });
      stats.lastSendDate = new Date(2017, 0);

      // Ждём начала выполнения сценария изменения...
      await badUpdateLock.waitForUnlock();
      await repositoryOne.update(stats);
      transactionUpdateLock.unlock();
      await promise;
      // Проверяем, что сценарий транзакции выполнился дважды из-за изменения lastSendDate
      assert.isTrue(transactionCallback.calledTwice);
    });

    it('should increment twice when two increments are made in different connections', async () => {
      await Promise.all([
        repositoryOne.updateInTransaction(testEmail, async (stats: AddressStats) => {
          stats.sentCount += 1;
        }),
        repositoryTwo.updateInTransaction(testEmail, async (stats: AddressStats) => {
          stats.sentCount += 1;
        })
      ]);
      const stats = await repositoryOne.getByEmail(testEmail);
      assert.equal(stats.sentCount, 2);
    });
  });
});
