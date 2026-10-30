import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getTestingRedisConnectionPool, redisSkip } from './testing-utils';
import { RedisConnectionPool } from '../src/RedisConnectionPool';
import { RedisMailingRepository } from '../src/RedisMailingRepository';
import { MailingState } from '../src/MailingState';
import { Receiver } from '../src/Receiver';


const testHtml = '<h1>Test</h1>';
const testName = 'test';
const testReceiver = 'non-existent-address@etersoft.ru';
const testSubject = 'test';

describe('RedisMailingRepository', { skip: redisSkip }, () => {
  let mailingId: number;
  let redisConnectionPoolOne: RedisConnectionPool;
  let redisConnectionPoolTwo: RedisConnectionPool;
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

      assert.equal(mailing?.sentCount, iterations);
      assert.equal(mailing?.undeliveredCount, iterations);
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

  describe('position', () => {
    const emails = ['a@example.com', 'b@example.com', 'c@example.com', 'd@example.com'];

    async function createAt (position: number) {
      const mailing = await repositoryOne.create({
        html: testHtml,
        name: testName,
        subject: testSubject,
        undeliveredCount: 0
      }, emails.map(email => ({ email })));
      await repositoryOne.updateInTransaction(mailing.id, m => {
        m.position = position;
      });
      return mailing.id;
    }

    async function getPosition (id: number) {
      return (await repositoryOne.getById(id))!.position;
    }

    it('should keep List-Unsubscribe for mailings saved without the option', async () => {
      assert.equal((await repositoryOne.getById(mailingId))!.listUnsubscribe, false);
      await redisConnectionPoolOne.runWithConnection(async client => {
        const key = 'MAILING_COMMON_DATA_' + mailingId;
        const data = JSON.parse((await client.get(key))!);
        delete data.listUnsubscribe;
        await client.set(key, JSON.stringify(data));
      });
      assert.equal((await repositoryOne.getById(mailingId))!.listUnsubscribe, true);
    });

    it('should continue from sentCount for mailings saved without position', async () => {
      // Так выглядят рассылки, сохранённые старой версией
      await redisConnectionPoolOne.runWithConnection(async client => {
        const key = 'MAILING_COMMON_DATA_' + mailingId;
        const data = JSON.parse((await client.get(key))!);
        delete data.position;
        data.sentCount = 1;
        await client.set(key, JSON.stringify(data));
      });
      assert.equal(await getPosition(mailingId), 1);
    });

    it('should return the receiver at position', async () => {
      const id = await createAt(2);
      assert.equal((await repositoryOne.getNextReceiver(id))!.email, 'c@example.com');
      await repositoryOne.updateInTransaction(id, m => {
        m.position = emails.length;
      });
      assert.equal(await repositoryOne.getNextReceiver(id), null);
    });

    it('should move position back when a receiver before it is removed', async () => {
      const id = await createAt(2);
      assert.ok(await repositoryTwo.removeReceiver(id, new Receiver('a@example.com')));
      assert.equal(await getPosition(id), 1);
      assert.equal((await repositoryOne.getNextReceiver(id))!.email, 'c@example.com');
    });

    it('should keep position when a receiver at or after it is removed', async () => {
      const id = await createAt(2);
      assert.ok(await repositoryTwo.removeReceiver(id, new Receiver('c@example.com')));
      assert.ok(await repositoryTwo.removeReceiver(id, new Receiver('d@example.com')));
      assert.equal(await getPosition(id), 2);
    });

    it('should advance position past the processed receiver', async () => {
      const id = await createAt(1);
      await repositoryOne.advancePosition(id, new Receiver('b@example.com'), true);
      await repositoryOne.advancePosition(id, new Receiver('c@example.com'), false);
      const mailing = await repositoryOne.getById(id);
      assert.equal(mailing!.position, 3);
      assert.equal(mailing!.sentCount, 1);
    });

    it('should not advance when the processed receiver was removed meanwhile', async () => {
      const id = await createAt(1);
      const receiver = (await repositoryOne.getNextReceiver(id))!;
      await repositoryTwo.removeReceiver(id, receiver);
      await repositoryOne.advancePosition(id, receiver, true);
      assert.equal(await getPosition(id), 1);
      assert.equal((await repositoryOne.getNextReceiver(id))!.email, 'c@example.com');
    });

    it('should advance when a receiver before it was removed meanwhile', async () => {
      const id = await createAt(1);
      const receiver = (await repositoryOne.getNextReceiver(id))!;
      await repositoryTwo.removeReceiver(id, new Receiver('a@example.com'));
      await repositoryOne.advancePosition(id, receiver, true);
      assert.equal(await getPosition(id), 1);
      assert.equal((await repositoryOne.getNextReceiver(id))!.email, 'c@example.com');
    });
  });
});
