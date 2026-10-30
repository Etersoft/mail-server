import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeLogger, getTestingRedisConnectionPool, redisSkip } from './testing-utils';
import { RedisConnectionPool } from '../src/RedisConnectionPool';
import { RedisMailingRepository } from '../src/RedisMailingRepository';
import { RedisAddressStatsRepository } from '../src/RedisAddressStatsRepository';
import { FailureCounter } from '../src/FailureCounter';
import { unsubscribeFromAll } from '../src/controllers/unsubscribeFromAll';
import { createRetryMailing } from '../src/controllers/createRetryMailing';


const bounced = 'failure-counter-bounced@example.com';
const failed = 'failure-counter-failed@example.com';
const unsubscribed = 'failure-counter-unsubscribed@example.com';

async function call (handlers: unknown, body: Record<string, unknown>) {
  let result: any;
  const res = {
    json (data: any) {
      result = data;
      return res;
    },
    status () {
      return res;
    }
  };
  await (handlers as any[])[1]({ body, params: {} }, res);
  return result;
}

describe('FailureCounter', { skip: redisSkip }, () => {
  let redisConnectionPool: RedisConnectionPool;
  let mailingRepository: RedisMailingRepository;
  let statsRepository: RedisAddressStatsRepository;
  let failureCounter: FailureCounter;
  const logger = createFakeLogger();

  before(async () => {
    redisConnectionPool = await getTestingRedisConnectionPool();
    mailingRepository = new RedisMailingRepository(redisConnectionPool);
    statsRepository = new RedisAddressStatsRepository(redisConnectionPool);
    failureCounter = new FailureCounter(mailingRepository, statsRepository);
  });

  after(async () => {
    await redisConnectionPool.close();
  });

  it('should keep addresses excluded for delivery errors in the report', async () => {
    const mailing = await mailingRepository.create({
      creationDate: new Date(Date.now() - 1000),
      html: '<p>Test</p>',
      name: 'test',
      subject: 'test',
      undeliveredCount: 0
    }, [{ email: bounced }, { email: failed }, { email: unsubscribed }]);
    for (const email of [bounced, failed, unsubscribed]) {
      await statsRepository.create({
        email,
        lastStatus: email === unsubscribed ? undefined : '5.1.1',
        lastStatusDate: new Date()
      });
    }

    // mail-sorter: недоставляемый адрес и письмо с просьбой отписаться
    await call(unsubscribeFromAll(mailingRepository, logger), { email: bounced });
    await call(unsubscribeFromAll(mailingRepository, logger), {
      email: unsubscribed, listUnsubscribe: true
    });

    const report = await failureCounter.getFailedReceivers((await mailingRepository.getById(
      mailing.id
    ))!);
    assert.deepEqual(report.map(r => [r.email, Boolean(r.excluded)]), [
      [failed, false], [bounced, true]
    ]);

    const config = { server: { mail: { listIdDomain: 'example.com' } } };
    const retry = await call(createRetryMailing(
      config, mailingRepository, logger, failureCounter
    ), { sourceId: mailing.id });
    const receivers = await mailingRepository.getReceivers(retry.data.id);
    assert.deepEqual(receivers.map(r => r.email), [failed]);

    await mailingRepository.remove(mailing);
    assert.deepEqual(await mailingRepository.getExcludedEmails(mailing.id), []);
  });
});
