import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  createFakeLogger, getTestingRedisConnectionPool, redisSkip, sleep
} from './testing-utils';
import { RedisConnectionPool } from '../src/RedisConnectionPool';
import { RedisMailingRepository } from '../src/RedisMailingRepository';
import { RedisAddressStatsRepository } from '../src/RedisAddressStatsRepository';
import { MailingExecutor } from '../src/MailingExecutor';
import { MailingStateManager } from '../src/MailingStateManager';
import { MailingState } from '../src/MailingState';
import { Mailing } from '../src/Mailing';


const testHtml = '<h1>Test</h1>';
const testName = 'test';
const testReceiver = 'non-existent-address@etersoft.ru';
const testSubject = 'test';

describe('MailingStateManager', { skip: redisSkip }, () => {
  let redisConnectionPool: RedisConnectionPool;
  let mailing: Mailing;
  let mailingRepository: RedisMailingRepository;
  let addressStatsRepository: RedisAddressStatsRepository;
  let executor: MailingExecutor;
  let stateManager: MailingStateManager;
  const fakeConfig = {
    server: {
      maxEmailsWithoutPause: 5,
      pauseDuration: 10
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
    stateManager = new MailingStateManager(
      executor,
      logger,
      mailingRepository,
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

  describe('#changeState', () => {
    afterEach(() => {
      mock.restoreAll();
    });

    it('should return false when changing to the same state', async () => {
      const result = await stateManager.changeState(mailing, MailingState.FINISHED);
      assert.equal(result, false);
    });

    it('should start execution when the state changes to RUNNING', async () => {
      const startExecution = mock.method(executor, 'startExecution', async () => {});
      const result = await stateManager.changeState(mailing, MailingState.RUNNING);
      assert.equal(startExecution.mock.callCount(), 1);
      assert.equal(startExecution.mock.calls[0].arguments[0], mailing);
      assert.equal(result, true);
    });

    it('should paused execution when the state changes to PAUSED', async () => {
      mailing.state = MailingState.RUNNING;
      const pauseExecution = mock.method(executor, 'pauseExecution', async () => {});
      const result = await stateManager.changeState(mailing, MailingState.PAUSED);
      assert.equal(pauseExecution.mock.callCount(), 1);
      assert.equal(pauseExecution.mock.calls[0].arguments[0], mailing);
      assert.equal(result, true);
    });
  });

  describe('#initialize', () => {
    afterEach(() => {
      mock.restoreAll();
    });

    it('should paused all running mailing', async () => {
      mailing.state = MailingState.RUNNING;
      const getAll = mock.method(mailingRepository, 'getAll', async () => [mailing]);
      const updateInTransaction = mock.method(
        mailingRepository, 'updateInTransaction', async () => null
      );
      await stateManager.initialize();
      assert.equal(getAll.mock.callCount(), 1);
      assert.equal(updateInTransaction.mock.callCount(), 1);
      assert.equal(updateInTransaction.mock.calls[0].arguments[0], mailing.id);
    });

    it('should resume running mailings', async () => {
      await mailingRepository.updateInTransaction(mailing.id, m => {
        m.state = MailingState.RUNNING;
      });
      const startExecution = mock.method(executor, 'startExecution', async () => {});
      await stateManager.initialize();
      const resumed = startExecution.mock.calls.map(call => (call.arguments[0] as Mailing).id);
      assert.ok(resumed.includes(mailing.id));
      assert.equal((await mailingRepository.getById(mailing.id))!.state, MailingState.PAUSED);
    });

    it('should resume auto-paused mailings at the saved time', async () => {
      await mailingRepository.updateInTransaction(mailing.id, m => {
        m.state = MailingState.PAUSED;
        m.autoResumeAt = Date.now() + 200;
      });
      const startExecution = mock.method(executor, 'startExecution', async () => {});
      const startedWith = () => startExecution.mock.calls
        .map(call => (call.arguments[0] as Mailing).id)
        .filter(id => id === mailing.id);
      await stateManager.initialize();
      assert.deepEqual(startedWith(), []);
      await sleep(500);
      assert.deepEqual(startedWith(), [mailing.id]);
      assert.equal((await mailingRepository.getById(mailing.id))!.autoResumeAt, undefined);
    });

    it('should not resume mailings paused by hand', async () => {
      await mailingRepository.updateInTransaction(mailing.id, m => {
        m.state = MailingState.PAUSED;
      });
      const startExecution = mock.method(executor, 'startExecution', async () => {});
      await stateManager.initialize();
      await sleep(100);
      const started = startExecution.mock.calls.map(call => (call.arguments[0] as Mailing).id);
      assert.ok(!started.includes(mailing.id));
    });

    it('should not work if no mailings is running', async () => {
      const getAll = mock.method(mailingRepository, 'getAll', async () => [mailing]);
      const updateInTransaction = mock.method(
        mailingRepository, 'updateInTransaction', async () => null
      );
      await stateManager.initialize();
      assert.equal(getAll.mock.callCount(), 1);
      assert.equal(updateInTransaction.mock.callCount(), 0);
    });
  });
});
