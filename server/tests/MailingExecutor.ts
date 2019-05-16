import 'mocha';
import { assert } from 'chai';
import { getTestingRedisConnectionPool } from './testing-utils';
import { RedisMailingRepository } from '../src/RedisMailingRepository';
import { RedisAddressStatsRepository } from '../src/RedisAddressStatsRepository';
import { MailingExecutor } from '../src/MailingExecutor';
import { createFakeLogger, sleep } from './testing-utils';
import { MailingState } from '../src/MailingState';
import * as sinon from 'sinon';


const testHtml = '<h1>Test</h1>';
const testName = 'test';
const testReceiver = 'non-existent-address@etersoft.ru';
const testSubject = 'test';

describe('MailingExecutor', () => {
  let redisConnectionPool;
  let mailing;
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
    sendEmail: sinon.stub()
  }
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
      mailer.sendEmail.resetHistory();
    });

    after(() => {
      mailer.sendEmail.resetHistory();
    });

    it('should send test email', async () => {
      const testAddress = 'address@example.com';
      await executor.sendTestEmail(mailing, testAddress);
      assert.isTrue(mailer.sendEmail.calledOnce);
    });
  });

  describe('#startExecution', () => {

    afterEach(() => {
      mailer.sendEmail.resetHistory();
    });

    it('shold start the mailing and send one mail', async () => {
      const fakeEventEmit = sinon.stub(executor, 'emit');
      const fakeUpadates = sinon.stub(addressStatsRepository, 'updateInTransaction');

      await executor.startExecution(mailing);
      await sleep(1000);
      
      mailing = await mailingRepository.getById(mailing.id);
      assert.equal(mailing.sentCount, 1);
      assert.isOk(mailer.sendEmail.calledOnce);
      assert.isOk(fakeUpadates.calledOnce);
      const args = fakeEventEmit.getCalls()[2].args;
      assert.deepEqual(['finished', mailing.id ], args);
      fakeEventEmit.restore();

    });

    it('shoud stop execution when error in email template', async () => {
      sinon.stub(mailing, 'getHtmlForReceiver').rejects();
      await executor.startExecution(mailing);
      await sleep(1000);
      assert.isNotOk(mailer.sendEmail.called);
      mailing.getHtmlForReceiver.restore();
    })
  });
});

