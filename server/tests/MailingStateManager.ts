import 'mocha';
import { assert } from 'chai';
import { getTestingRedisConnectionPool } from './testing-utils';
import { RedisMailingRepository } from '../src/RedisMailingRepository';
import { RedisAddressStatsRepository } from '../src/RedisAddressStatsRepository';
import { MailingExecutor } from '../src/MailingExecutor';
import { MailingStateManager } from '../src/MailingStateManager'
import { createFakeLogger } from './testing-utils';
import { MailingState } from '../src/MailingState';
import * as sinon from 'sinon';


const testHtml = '<h1>Test</h1>';
const testName = 'test';
const testReceiver = 'non-existent-address@etersoft.ru';
const testSubject = 'test';

describe('MailingStateManager', () => {
  let redisConnectionPool;
  let mailing;
  let mailingRepository: RedisMailingRepository;
  let addressStatsRepository: RedisAddressStatsRepository;
  let executor: MailingExecutor;
  let stateManager: MailingStateManager;
  const fakeConfig = {
    server: {
      maxEmailsWithoutPause: 5,
      pauseDuration: 10,
    }
  };
  const mailer = {
    sendEmail: sinon.stub()
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
    stateManager  = new MailingStateManager(
      executor,
      logger,
      mailingRepository,
      fakeConfig
    );
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
  describe('#changeState',  () => {
    let fakeExecutor: sinon.SinonMock;

    beforeEach(() => {
      fakeExecutor = sinon.mock(executor);
    });

    afterEach(() => {
      fakeExecutor.restore();
    });

    it('should return false when changing to the same state', async () => {
      const result = await stateManager.changeState(mailing, MailingState.FINISHED);
      assert.equal(result, false);
    });

    it('should start execution when the state changes to RUNNING', async () => {
      fakeExecutor.expects('startExecution').withArgs(mailing).once();
      const result = await stateManager.changeState(mailing, MailingState.RUNNING);
      fakeExecutor.verify();
      assert.equal(result, true);
    });

    it('should paused execution when the state changes to PAUSED', async () => {
      mailing.state = MailingState.RUNNING;
      fakeExecutor.expects('pauseExecution').withArgs(mailing).once();
      const result = await stateManager.changeState(mailing, MailingState.PAUSED);
      fakeExecutor.verify();
      assert.equal(result, true);
    });
  });

  describe('#initialize', () => {
    let fakeMailingRepository: sinon.SinonMock;

    beforeEach(() => {
      fakeMailingRepository = sinon.mock(mailingRepository);
    });

    afterEach(() => {
      fakeMailingRepository.restore();
    });
    
    it('should paused all running mailing', async () => {
      mailing.state = MailingState.RUNNING;
      fakeMailingRepository.expects('getAll').once().resolves([mailing]);
      fakeMailingRepository.expects('updateInTransaction').withArgs(mailing.id).once();
      await stateManager.initialize();
      fakeMailingRepository.verify();
    });
    
    it('should not work if no mailings is running', async () => {
      fakeMailingRepository.expects('getAll').once().resolves([mailing]);
      fakeMailingRepository.expects('updateInTransaction').never();
      await stateManager.initialize();
      fakeMailingRepository.verify();
    });
  });
});