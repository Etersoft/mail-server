// tslint:disable:no-shadowed-variable
import { assert, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import 'mocha';
import { spy } from 'sinon';
import { sleep, getTestingRedisConnectionPool, lock } from './testing-utils';
import { RedisMailingRepository } from '../src/RedisMailingRepository';
import { MailingState } from '../src/Mailing';


use(chaiAsPromised);

const testHtml = '<h1>Test</h1>';
const testName = 'test';
const testReceiver = 'non-existent-address@etersoft.ru';
const testSubject = 'test';

describe('RedisMailingRepository', () => {
  describe('#updateInTransaction', () => {
    let mailingId: number;
    let redisConnectionPoolOne, redisConnectionPoolTwo;
    let repositoryOne: RedisMailingRepository, repositoryTwo: RedisMailingRepository;
    after(async () => {
      await redisConnectionPoolOne.close();
      await redisConnectionPoolTwo.close();
    });

    before(async () => {
      redisConnectionPoolOne = await getTestingRedisConnectionPool();
      redisConnectionPoolTwo = await getTestingRedisConnectionPool();
      [repositoryOne, repositoryTwo] = [
        new RedisMailingRepository(redisConnectionPoolOne),
        new RedisMailingRepository(redisConnectionPoolTwo)
      ];
    });

    beforeEach(async () => {
      const mailing = await repositoryOne.create({
        headers: {},
        html: testHtml,
        name: testName,
        sentCount: 0,
        state: MailingState.NEW,
        subject: testSubject,
        undeliveredCount: 0
      }, [{
        email: testReceiver
      }]);
      mailingId = mailing.id;
    });

    it('should correctly change different counters by different connections', async () => {
      const iterations = 5;
      await Promise.all([
        (async () => {
          for (let i = 0; i < iterations; i++) {
            await repositoryOne.updateInTransaction(mailingId, async mailing => {
              mailing.sentCount++;
            });
          }
        })(),
        (async () => {
          for (let i = 0; i < iterations; i++) {
            await repositoryTwo.updateInTransaction(mailingId, async mailing => {
              mailing.undeliveredCount++;
            });
          }
        })()
      ]);

      const mailing = await repositoryOne.getById(mailingId);

      assert.equal(mailing.sentCount, iterations);
      assert.equal(mailing.undeliveredCount, iterations);
    });
  });
});
