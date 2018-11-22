// tslint:disable:no-shadowed-variable
import { assert, use } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import 'mocha';
import { getTestingRedisConnectionPool } from './testing-utils';
import { RedisMailingRepository } from '../src/RedisMailingRepository';
import { MailingState } from '../src/Mailing';
import { Receiver } from '../src/Receiver';


use(chaiAsPromised);

const testHtml = '<h1>Test</h1>';
const testName = 'test';
const testReceiver = 'non-existent-address@etersoft.ru';
const testSubject = 'test';

describe('RedisMailingRepository', () => {
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
      html: testHtml,
      name: testName,
      sentCount: 0,
      state: MailingState.NEW,
      subject: testSubject,
      undeliveredCount: 0
    }, [{
      email: testReceiver,
      code: '123'
    }]);
    mailingId = mailing.id;
  });

  describe('#updateInTransaction', () => {
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

  describe('#addReceiver', () => {
    it('should add receiver', async () => {
      const initialLength = await repositoryOne.getReceiverCount(mailingId);
      await repositoryOne.addReceiver(mailingId, new Receiver(
        'test@etersoft.ru', undefined, '456'
      ));
      const newLength = await repositoryOne.getReceiverCount(mailingId);
      assert.equal(newLength, initialLength + 1);
    });

    it('should preserve secret code', async () => {
      await repositoryOne.addReceiver(mailingId, new Receiver(
        'test@etersoft.ru', undefined, '456'
      ));
      const [, receiver] = await repositoryOne.getReceivers(mailingId);
      assert.equal(receiver.code, '456');
    });
  });

  describe('#removeReceiver', () => {
    it('should remove receiver', async () => {
      const initialLength = await repositoryOne.getReceiverCount(mailingId);
      const removed = await repositoryOne.removeReceiver(mailingId, new Receiver(
        testReceiver, undefined, '123'
      ));
      assert.equal(removed, true);
      const newLength = await repositoryOne.getReceiverCount(mailingId);
      assert.equal(newLength, initialLength - 1);
    });

    it('should not remove non-existent receiver', async () => {
      const initialLength = await repositoryOne.getReceiverCount(mailingId);
      const removed = await repositoryOne.removeReceiver(mailingId, new Receiver(
        testReceiver, undefined, '666'
      ));
      assert.equal(removed, false);
      const newLength = await repositoryOne.getReceiverCount(mailingId);
      assert.equal(newLength, initialLength);
    });
  });
});
