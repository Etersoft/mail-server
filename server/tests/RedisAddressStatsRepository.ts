// tslint:disable:no-shadowed-variable
import { RedisAddressStatsRepository } from '../src/RedisAddressStatsRepository';
import { assert, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import 'mocha';
import { AddressStats } from '../src/AddressStats';
import { createRedisClient } from '../src/createRedisClient';
import { spy } from 'sinon';
import { sleep, getTestingRedisConnection } from './testing-utils';


use(chaiAsPromised);

const testEmail = 'test-email-address@etersoft.ru';
const nonExistentEmail = 'test-non-existent@etersoft.ru';

describe('RedisAddressStatsRepository', () => {
  describe('#updateInTransaction', () => {
    let redisOne, redisTwo, repositoryOne, repositoryTwo;
    after(() => {
      redisOne.quit();
      redisTwo.quit();
    });

    before(async () => {
      [redisOne, redisTwo] = await Promise.all([
        getTestingRedisConnection(), getTestingRedisConnection()
      ]);
      [repositoryOne, repositoryTwo] = [
        new RedisAddressStatsRepository(redisOne), new RedisAddressStatsRepository(redisTwo)
      ];
    });

    beforeEach(async () => {
      await repositoryOne.create({
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

    it('should repeat transaction after modification in same connection', async () => {
      const stats = await repositoryOne.getByEmail(testEmail);
      const transactionCallback = spy();
      const promise = repositoryOne.updateInTransaction(testEmail, async (stats: AddressStats) => {
        await sleep(250);
        stats.sentCount += 1;
        transactionCallback();
      });
      stats.lastSendDate = new Date(2017, 0);
      await repositoryOne.update(stats);
      await promise;
      // Проверяем, что сценарий транзакции выполнился дважды из-за изменения lastSendDate
      assert.isTrue(transactionCallback.calledTwice);
    });

    it('should repeat transaction after modification in other connection', async () => {
      const stats = await repositoryTwo.getByEmail(testEmail);
      const transactionCallback = spy();
      const promise = repositoryOne.updateInTransaction(testEmail, async (stats: AddressStats) => {
        await sleep(250);
        stats.sentCount += 1;
        transactionCallback();
      });
      stats.lastSendDate = new Date(2017, 0);
      await repositoryTwo.update(stats);
      await promise;
      // Проверяем, что сценарий транзакции выполнился дважды из-за изменения lastSendDate
      assert.isTrue(transactionCallback.calledTwice);
    });

    it('should increment twice when two increments are made in different connections', async () => {
      await Promise.all([
        repositoryOne.updateInTransaction(testEmail, async (stats: AddressStats) => {
          await sleep(250);
          stats.sentCount += 1;
        }),
        repositoryTwo.updateInTransaction(testEmail, async (stats: AddressStats) => {
          await sleep(250);
          stats.sentCount += 1;
        })
      ]);
      const stats = await repositoryOne.getByEmail(testEmail);
      assert.equal(stats.sentCount, 2);
    });
  });
});