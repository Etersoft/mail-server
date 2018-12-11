// tslint:disable:no-shadowed-variable
import { assert, use } from 'chai';
import 'mocha';
import { spy } from 'sinon';
import { sleep, getTestingRedisConnectionPool, lock } from './testing-utils';
import { RedisMailingRepository } from '../src/RedisMailingRepository';
import { RedisSubscriptionRequestRepository } from '../src/RedisSubscriptionRequestRepository';
import { MailingState } from '../src/MailingState';
import { Receiver } from '../src/Receiver';
import { requestSubscription, SubscribeTemplateContext } from '../src/controllers/requestSubscription';
import { subscribe } from '../src/controllers/subscribe';
import { unsubscribe } from '../src/controllers/unsubscribe';
import { createFakeLogger } from './testing-utils';
import { mockReq, mockRes } from 'sinon-express-mock';


const testHtml = '<h1>Test</h1>';
const testName = 'test';
const testReceiver = 'non-existent-address@etersoft.ru';
const testReceiver2 = 'non-existent-address2@etersoft.ru';
const testSubject = 'test';
const ttl = 1; // seconds

describe('subscription', () => {
  let redisConnectionPool;
  let mailingRepository: RedisMailingRepository;
  let subscriptionRepository: RedisSubscriptionRequestRepository;
  let requestSubscriptionController;
  let subscribeController;
  let unsubscribeController;
  let logger = createFakeLogger();
  let mailingId;
  let res;
  let sender;
  let template;
  const subscribeConfig = { replyTo: 'test@etersoft.ru', subject: '123' };
  after(async () => {
    await redisConnectionPool.close();
  });

  before(async () => {
    redisConnectionPool = await getTestingRedisConnectionPool();
    mailingRepository = new RedisMailingRepository(redisConnectionPool);
    subscriptionRepository = new RedisSubscriptionRequestRepository(redisConnectionPool, ttl);
  });

  beforeEach(async () => {
    const mailing = await mailingRepository.create({
      html: testHtml,
      name: testName,
      openForSubscription: true,
      sentCount: 0,
      state: MailingState.NEW,
      subject: testSubject,
      undeliveredCount: 0
    }, [{
      email: testReceiver,
      code: '123'
    }]);
    sender = {
      sendEmail: spy()
    };
    template = {
      render: spy((context: SubscribeTemplateContext) =>
        context.mailing.name + ':' + context.name + ':' + context.subscriptionRequest.code
      )
    };
    mailingId = mailing.id;
    res = mockRes();
    requestSubscriptionController = requestSubscription(
      subscriptionRepository, mailingRepository, logger,
      sender, template, subscribeConfig
    )[1];
    subscribeController = subscribe(subscriptionRepository, mailingRepository, logger)[1];
    unsubscribeController = unsubscribe(subscriptionRepository, mailingRepository, logger)[1];
  });

  describe('#requestSubscription', () => {
    const defaultBody = {
      email: testReceiver2,
      name: '456',
      periodicDate: '1'
    };

    it('should add an entry to SubscriptionRequestRepository', async () => {
      const req = mockReq({
        body: defaultBody,
        params: { mailingId }
      });
      await requestSubscriptionController(req, res);
      const request = await subscriptionRepository.get({
        email: testReceiver2,
        mailingId
      });
      assert.isOk(res.json.getCall(0).args[0].success);
      assert.equal(request.email, defaultBody.email);
      assert.equal(request.periodicDate, defaultBody.periodicDate);
    });

    it('should send an email on successful creation of subscription request', async () => {
      const req = mockReq({
        body: defaultBody,
        params: { mailingId }
      });
      await requestSubscriptionController(req, res);
      assert.isOk(sender.sendEmail.calledOnce);
    });

    it('should support cron schedules', async () => {
      const req = mockReq({
        body: {
          ...defaultBody,
          schedule: '* * *'
        },
        params: { mailingId }
      });
      await requestSubscriptionController(req, res);
      assert.isOk(res.json.getCall(0).args[0].success);
    });

    it('should return error on invalid cron schedules', async () => {
      const req = mockReq({
        body: {
          ...defaultBody,
          schedule: '* * * *'
        },
        params: { mailingId }
      });
      await requestSubscriptionController(req, res);
      assert.equal(res.status.getCall(0).args[0], 400);
      assert.isOk(res.json.getCall(0).args[0].error);
    });

    it('should correctly render email template', async () => {
      const req = mockReq({
        body: defaultBody,
        params: { mailingId }
      });
      await requestSubscriptionController(req, res);
      const request = await subscriptionRepository.get({
        email: testReceiver2,
        mailingId
      });
      assert.equal(
        sender.sendEmail.getCall(0).args[0].html,
        `${testName}:${defaultBody.name}:${request.code}`
      );
    });

    it('should not send an email on missing mailing', async () => {
      const req = mockReq({
        body: defaultBody,
        params: { mailingId: -1 }
      });
      await requestSubscriptionController(req, res);
      assert.isNotOk(sender.sendEmail.called);
    });

    it('should not send an email on failed creation of subscription request', async () => {
      const old = subscriptionRepository.create;
      subscriptionRepository.create = () => {
        throw new Error('TEST ERROR. THIS IS OK IF YOU SEE IT');
      };

      const req = mockReq({
        body: defaultBody,
        params: { mailingId }
      });
      try {
        await requestSubscriptionController(req, res);
      } catch (e) {
      } finally {
        subscriptionRepository.create = old;
        assert.isNotOk(sender.sendEmail.called);
      }
    });

    it('should return 404 for non-existent mailing', async () => {
      const req = mockReq({
        body: defaultBody,
        params: {
          mailingId: -1
        }
      });
      await requestSubscriptionController(req, res);
      assert.isOk(res.status.calledWith(404));
      assert.isNotOk(res.json.getCall(0).args[0].success);
    });

    it('should expire subscription requests after TTL', async () => {
      const req = mockReq({
        body: defaultBody,
        params: { mailingId }
      });
      await requestSubscriptionController(req, res);
      await sleep(ttl * 1100 * 1.1);
      const request = await subscriptionRepository.get({
        email: testReceiver2,
        mailingId
      });
      assert.isNotOk(request);
    });
  });

  describe('#subscribe', () => {
    const defaultBody = {
      email: testReceiver2,
      code: '123'
    };
    let subscriptionRequest;

    beforeEach(async () => {
      subscriptionRequest = await subscriptionRepository.create({
        code: defaultBody.code,
        email: testReceiver2,
        mailingId,
        periodicDate: '1'
      });
    });

    it('should return success on subscription', async () => {
      const req = mockReq({
        body: defaultBody,
        params: { mailingId }
      });
      await subscribeController(req, res);
      assert.isOk(res.json.getCall(0).args[0].success);
    });

    it('should remove entry from SubscriptionRequestRepository on subscription', async () => {
      const req = mockReq({
        body: defaultBody,
        params: { mailingId }
      });
      await subscribeController(req, res);
      const request = await subscriptionRepository.get({
        email: testReceiver2,
        mailingId
      });
      assert.isNotOk(request);
    });

    it('should add user to mailing on subscription', async () => {
      const req = mockReq({
        body: defaultBody,
        params: { mailingId }
      });
      let receivers = await mailingRepository.getReceivers(mailingId);
      assert.notInclude(receivers.map(r => r.email), testReceiver2);
      await subscribeController(req, res);
      receivers = await mailingRepository.getReceivers(mailingId);
      assert.include(receivers.map(r => r.email), testReceiver2);
    });

    it('should not subscribe with missing subscription request', async () => {
      const req = mockReq({
        body: defaultBody,
        params: { mailingId }
      });
      await subscriptionRepository.remove(subscriptionRequest);
      await subscribeController(req, res);
      const receivers = await mailingRepository.getReceivers(mailingId);
      assert.notInclude(receivers.map(r => r.email), testReceiver2);
      assert.isOk(res.status.calledWith(400));
      assert.isNotOk(res.json.getCall(0).args[0].success);
    });

    it('should not subscribe with code mismatch', async () => {
      const req = mockReq({
        body: {
          ...defaultBody,
          code: '123456'
        },
        params: { mailingId }
      });
      await subscribeController(req, res);
      const receivers = await mailingRepository.getReceivers(mailingId);
      assert.notInclude(receivers.map(r => r.email), testReceiver2);
      assert.isOk(res.status.calledWith(400));
      assert.isNotOk(res.json.getCall(0).args[0].success);
    });
  });
});
