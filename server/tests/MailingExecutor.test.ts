import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  createFakeLogger, getTestingRedisConnectionPool, redisSkip, sleep
} from './testing-utils';
import { RedisConnectionPool } from '../src/RedisConnectionPool';
import { RedisMailingRepository } from '../src/RedisMailingRepository';
import { RedisAddressStatsRepository } from '../src/RedisAddressStatsRepository';
import { MailingExecutor } from '../src/MailingExecutor';
import { MailingState } from '../src/MailingState';
import { Mailing } from '../src/Mailing';


const testHtml = '<h1>Test</h1>';
const testName = 'test';
const testReceiver = 'non-existent-address@etersoft.ru';
const testSubject = 'test';

describe('MailingExecutor', { skip: redisSkip }, () => {
  let redisConnectionPool: RedisConnectionPool;
  let mailing: Mailing;
  let mailingRepository: RedisMailingRepository;
  let addressStatsRepository: RedisAddressStatsRepository;
  let executor: MailingExecutor;
  const fakeConfig = {
    server: {
      mail: {
        listUnsubscribe: ''
      }
    }
  };

  const mailer = {
    sendEmail: mock.fn(async () => {})
  };
  const logger = createFakeLogger();

  before(async () => {
    redisConnectionPool = await getTestingRedisConnectionPool();
    [mailingRepository, addressStatsRepository] = [
      new RedisMailingRepository(redisConnectionPool),
      new RedisAddressStatsRepository(redisConnectionPool)
    ];
    executor = new MailingExecutor(
      mailer,
      mailingRepository,
      addressStatsRepository,
      logger,
      fakeConfig
    );
  });

  after(async () => {
    await redisConnectionPool.close();
  });

  beforeEach(async () => {
    mailing = await mailingRepository.create({
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
  });

  describe('#sendTestEmail', () => {
    before(() => {
      mailer.sendEmail.mock.resetCalls();
    });

    after(() => {
      mailer.sendEmail.mock.resetCalls();
    });

    it('should send test email', async () => {
      const testAddress = 'address@example.com';
      await executor.sendTestEmail(mailing, testAddress);
      assert.equal(mailer.sendEmail.mock.callCount(), 1);
    });
  });

  describe('#startExecution', () => {
    afterEach(() => {
      mailer.sendEmail.mock.resetCalls();
    });

    it('shold start the mailing and send one mail', async () => {
      const fakeEventEmit = mock.method(executor, 'emit', () => true);
      const fakeUpdates = mock.method(
        addressStatsRepository, 'updateInTransaction', async () => null
      );
      try {
        await executor.startExecution(mailing);
        await sleep(1000);

        const updatedMailing = await mailingRepository.getById(mailing.id);
        assert.ok(updatedMailing);
        mailing = updatedMailing;
        assert.equal(mailing.sentCount, 1);
        assert.equal(mailer.sendEmail.mock.callCount(), 1);
        assert.equal(fakeUpdates.mock.callCount(), 1);
        const args = fakeEventEmit.mock.calls[2].arguments;
        assert.deepEqual(['finished', mailing.id], args);
      } finally {
        fakeEventEmit.mock.restore();
        fakeUpdates.mock.restore();
      }
    });

    it('shoud stop execution when error in email template', async () => {
      // MailingExecutor сообщает об ошибке рассылки событием 'error'. В работе его
      // слушает MailingStateManager; здесь его нет, а событие 'error' без слушателя
      // EventEmitter превращает в исключение ERR_UNHANDLED_ERROR.
      const errorListener = mock.fn();
      executor.on('error', errorListener);
      const templateError = new Error('template error');
      const fakeHtml = mock.method(mailing, 'getHtmlForReceiver', async () => {
        throw templateError;
      });
      try {
        await executor.startExecution(mailing);
        await sleep(1000);
        assert.equal(mailer.sendEmail.mock.callCount(), 0);
        assert.equal(errorListener.mock.callCount(), 1);
        assert.deepEqual(errorListener.mock.calls[0].arguments, [mailing.id, templateError]);
      } finally {
        fakeHtml.mock.restore();
        executor.off('error', errorListener);
      }
    });
  });
});
