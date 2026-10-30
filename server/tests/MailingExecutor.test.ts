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
import { Email } from '../src/Email';
import { Receiver } from '../src/Receiver';
import { once } from 'node:events';


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
      },
      sendRetryDelays: [0.01, 0.01]
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

  describe('List-Unsubscribe', () => {
    const header = '<mailto:noreply+unsubscribe@etersoft.ru>';

    before(() => {
      fakeConfig.server.mail.listUnsubscribe = header;
    });

    after(() => {
      fakeConfig.server.mail.listUnsubscribe = '';
    });

    afterEach(() => {
      mailer.sendEmail.mock.resetCalls();
    });

    async function sentHeaders (testMailing: Mailing) {
      await executor.sendTestEmail(testMailing, 'address@example.com');
      const [email] = mailer.sendEmail.mock.calls[0].arguments as unknown as [Email];
      return email.headers;
    }

    it('should not add the header by default', async () => {
      assert.equal(mailing.listUnsubscribe, false);
      assert.equal((await sentHeaders(mailing))['List-Unsubscribe'], undefined);
    });

    it('should add the header to mailings with listUnsubscribe', async () => {
      const updated = await mailingRepository.updateInTransaction(mailing.id, m => {
        m.listUnsubscribe = true;
      });
      assert.equal((await sentHeaders(updated!))['List-Unsubscribe'], header);
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

  describe('receiver list changes', () => {
    const sentTo: string[] = [];

    async function createMailing (receivers: { email: string, periodicDate?: string }[]) {
      return mailingRepository.create({
        html: testHtml,
        name: testName,
        subject: testSubject,
        undeliveredCount: 0
      }, receivers);
    }

    function onSend (handler: (email: string) => Promise<void> | void) {
      mailer.sendEmail.mock.mockImplementation((async (email: Email) => {
        sentTo.push(email.receivers[0].email);
        await handler(email.receivers[0].email);
      }) as any);
    }

    afterEach(() => {
      sentTo.length = 0;
      mailer.sendEmail.mock.mockImplementation(async () => {});
      mailer.sendEmail.mock.resetCalls();
    });

    it('should not skip anyone when a sent receiver is removed during the mailing', async () => {
      const emails = ['a@example.com', 'b@example.com', 'c@example.com', 'd@example.com'];
      const testMailing = await createMailing(emails.map(email => ({ email })));
      // Так mail-sorter исключает адрес с ошибкой доставки во время рассылки
      onSend(async email => {
        if (email === 'b@example.com') {
          await mailingRepository.removeReceiver(testMailing.id, new Receiver('a@example.com'));
        }
      });
      const finished = once(executor, 'finished');
      await executor.startExecution(testMailing);
      await finished;

      assert.deepEqual(sentTo, emails);
      const updated = await mailingRepository.getById(testMailing.id);
      assert.equal(updated!.sentCount, 4);
      assert.equal(updated!.position, 3);
    });

    it('should not skip the next receiver when the current one is removed', async () => {
      const emails = ['a@example.com', 'b@example.com', 'c@example.com'];
      const testMailing = await createMailing(emails.map(email => ({ email })));
      onSend(async email => {
        if (email === 'b@example.com') {
          await mailingRepository.removeReceiver(testMailing.id, new Receiver('b@example.com'));
        }
      });
      const finished = once(executor, 'finished');
      await executor.startExecution(testMailing);
      await finished;

      assert.deepEqual(sentTo, emails);
    });

    it('should resume after a pause without resending to anyone', async () => {
      // День месяца, отличный от сегодняшнего: этот получатель будет пропущен
      const otherDay = String(new Date().getDate() % 28 + 1);
      const testMailing = await createMailing([
        { email: 'skipped@example.com', periodicDate: otherDay },
        { email: 'y@example.com' },
        { email: 'z@example.com' }
      ]);
      onSend(email => {
        if (email === 'y@example.com') {
          (executor as any).executionStates.get(testMailing.id).stopping = true;
        }
      });
      const paused = once(executor, 'paused');
      await executor.startExecution(testMailing);
      await paused;

      let updated = await mailingRepository.getById(testMailing.id);
      assert.equal(updated!.position, 2);
      assert.equal(updated!.sentCount, 1);

      onSend(() => {});
      const finished = once(executor, 'finished');
      await executor.startExecution(updated!);
      await finished;

      assert.deepEqual(sentTo, ['y@example.com', 'z@example.com']);
      updated = await mailingRepository.getById(testMailing.id);
      assert.equal(updated!.sentCount, 2);
    });

    describe('SMTP errors', () => {
      const emails = ['a@example.com', 'b@example.com', 'c@example.com'];

      function smtpError (responseCode: number | undefined, command: string, response = '') {
        return Object.assign(new Error(response || 'Connection closed'), {
          command, response, responseCode
        });
      }

      // Ждёт завершения рассылки: 'finished' или 'error' (тогда возвращает ошибку)
      async function run (testMailing: Mailing) {
        const ended = new Promise<Error | null>(resolve => {
          const onFinished = () => done(null);
          const onError = (id: number, error: Error) => done(error);
          function done (error: Error | null) {
            executor.off('finished', onFinished);
            executor.off('error', onError);
            resolve(error);
          }
          executor.on('finished', onFinished);
          executor.on('error', onError);
        });
        await executor.startExecution(testMailing);
        return ended;
      }

      it('should record a rejected receiver and go on', async () => {
        const testMailing = await createMailing(emails.map(email => ({ email })));
        onSend(email => {
          if (email === 'b@example.com') {
            throw smtpError(550, 'RCPT TO', '550 5.1.1 <b@example.com>: User unknown');
          }
        });
        assert.equal(await run(testMailing), null);

        assert.deepEqual(sentTo, emails);
        const updated = await mailingRepository.getById(testMailing.id);
        assert.equal(updated!.sentCount, 2);
        assert.equal(updated!.position, 3);
        assert.equal(updated!.undeliveredCount, 1);
        const stats = await addressStatsRepository.getByEmail('b@example.com');
        assert.equal(stats!.lastStatus, '5.1.1');
        assert.match(stats!.diagnosticCode!, /User unknown/);
      });

      it('should retry a temporary error', async () => {
        const testMailing = await createMailing(emails.map(email => ({ email })));
        let failures = 2;
        onSend(email => {
          if (email === 'a@example.com' && failures-- > 0) {
            throw smtpError(451, 'RCPT TO', '451 4.7.1 Greylisted');
          }
        });
        assert.equal(await run(testMailing), null);

        assert.deepEqual(sentTo, ['a@example.com', 'a@example.com', ...emails]);
        const updated = await mailingRepository.getById(testMailing.id);
        assert.equal(updated!.sentCount, 3);
      });

      it('should stop when temporary errors persist', async () => {
        const testMailing = await createMailing(emails.map(email => ({ email })));
        onSend(() => {
          throw smtpError(undefined, 'CONN');
        });
        const error = await run(testMailing);
        assert.ok(error);

        // Первая попытка и два повтора
        assert.equal(sentTo.length, 3);
        const updated = await mailingRepository.getById(testMailing.id);
        assert.equal(updated!.position, 0);
      });

      it('should stop without blaming the receiver when the letter is rejected', async () => {
        const testMailing = await createMailing(emails.map(email => ({ email })));
        onSend(() => {
          throw smtpError(554, 'DATA', '554 5.7.1 Message rejected as spam');
        });
        const error = await run(testMailing);
        assert.ok(error);

        assert.deepEqual(sentTo, ['a@example.com']);
        const updated = await mailingRepository.getById(testMailing.id);
        assert.equal(updated!.position, 0);
        assert.equal(updated!.undeliveredCount, 0);
        const stats = await addressStatsRepository.getByEmail('a@example.com');
        assert.equal(stats?.lastStatus, undefined);
      });
    });
  });
});
