import { after, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  createFakeLogger, getTestingRedisConnectionPool, redisSkip, sleep
} from './testing-utils';
import { RedisConnectionPool } from '../src/RedisConnectionPool';
import { RedisMailingRepository } from '../src/RedisMailingRepository';
import { RedisSubscriptionRequestRepository } from '../src/RedisSubscriptionRequestRepository';
import { MailingState } from '../src/MailingState';
import { Email } from '../src/Email';
import { SubscriptionRequest } from '../src/SubscriptionRequest';
import {
  requestSubscription, SubscribeTemplateContext
} from '../src/controllers/requestSubscription';
import { subscribe } from '../src/controllers/subscribe';
import { unsubscribe } from '../src/controllers/unsubscribe';
import { unsubscribeFromAll } from '../src/controllers/unsubscribeFromAll';


const testHtml = '<h1>Test</h1>';
const testName = 'test';
const testReceiver = 'non-existent-address@etersoft.ru';
const testReceiver2 = 'non-existent-address2@etersoft.ru';
const testSubject = 'test';
const ttl = 1; // seconds

interface FakeRequest {
  body: Record<string, unknown>;
  params: Record<string, unknown>;
}

type Controller = (req: FakeRequest, res: FakeResponse) => Promise<void>;

function createFakeResponse () {
  const res = {
    status: mock.fn((code: number): FakeResponse => {
      void code;
      return res;
    }),
    json: mock.fn((body: any): FakeResponse => {
      void body;
      return res;
    })
  };
  return res;
}

type FakeResponse = ReturnType<typeof createFakeResponse>;

function createFakeRequest (properties: FakeRequest): FakeRequest {
  return properties;
}

function toController (handlers: unknown[]): Controller {
  return handlers[1] as Controller;
}

describe('subscription', { skip: redisSkip }, () => {
  let redisConnectionPool: RedisConnectionPool;
  let mailingRepository: RedisMailingRepository;
  let subscriptionRepository: RedisSubscriptionRequestRepository;
  let requestSubscriptionController: Controller;
  let subscribeController: Controller;
  // Не используется в тестах, но создаётся, как и раньше
  let unsubscribeController: Controller;
  const logger = createFakeLogger();
  let mailingId: number;
  let res: FakeResponse;
  let sender: { sendEmail: ReturnType<typeof mock.fn<(email: Email) => Promise<void>>> };
  let template: {
    render: ReturnType<typeof mock.fn<(context: SubscribeTemplateContext) => string>>
  };
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
      sendEmail: mock.fn(async (email: Email) => {
        void email;
      })
    };
    template = {
      render: mock.fn((context: SubscribeTemplateContext) =>
        context.mailing.name + ':' + context.name + ':' + context.subscriptionRequest.code
      )
    };
    mailingId = mailing.id;
    res = createFakeResponse();
    requestSubscriptionController = toController(requestSubscription(
      subscriptionRepository, mailingRepository, logger,
      sender, template, subscribeConfig
    ));
    subscribeController = toController(
      subscribe(subscriptionRepository, mailingRepository, logger)
    );
    unsubscribeController = toController(
      unsubscribe(subscriptionRepository, mailingRepository, logger)
    );
    void unsubscribeController;
  });

  describe('#requestSubscription', () => {
    const defaultBody = {
      email: testReceiver2,
      name: '456',
      periodicDate: '1'
    };

    it('should add an entry to SubscriptionRequestRepository', async () => {
      const req = createFakeRequest({
        body: defaultBody,
        params: { mailingId }
      });
      await requestSubscriptionController(req, res);
      const request = await subscriptionRepository.get({
        email: testReceiver2,
        mailingId
      });
      assert.ok(res.json.mock.calls[0].arguments[0].success);
      assert.equal(request?.email, defaultBody.email);
      assert.equal(request?.periodicDate, defaultBody.periodicDate);
    });

    it('should send an email on successful creation of subscription request', async () => {
      const req = createFakeRequest({
        body: defaultBody,
        params: { mailingId }
      });
      await requestSubscriptionController(req, res);
      assert.equal(sender.sendEmail.mock.callCount(), 1);
    });

    it('should support cron schedules', async () => {
      const req = createFakeRequest({
        body: {
          ...defaultBody,
          schedule: '* * *'
        },
        params: { mailingId }
      });
      await requestSubscriptionController(req, res);
      assert.ok(res.json.mock.calls[0].arguments[0].success);
    });

    it('should return error on invalid cron schedules', async () => {
      const req = createFakeRequest({
        body: {
          ...defaultBody,
          schedule: '* * * *'
        },
        params: { mailingId }
      });
      await requestSubscriptionController(req, res);
      assert.equal(res.status.mock.calls[0].arguments[0], 400);
      assert.equal(res.json.mock.calls[0].arguments[0].code, 'INVALID_SCHEDULE');
      assert.ok(res.json.mock.calls[0].arguments[0].error);
    });

    it('should correctly render email template', async () => {
      const req = createFakeRequest({
        body: defaultBody,
        params: { mailingId }
      });
      await requestSubscriptionController(req, res);
      const request = await subscriptionRepository.get({
        email: testReceiver2,
        mailingId
      });
      assert.equal(
        sender.sendEmail.mock.calls[0].arguments[0].html,
        `${testName}:${defaultBody.name}:${request?.code}`
      );
    });

    it('should not send an email on missing mailing', async () => {
      const req = createFakeRequest({
        body: defaultBody,
        params: { mailingId: -1 }
      });
      await requestSubscriptionController(req, res);
      assert.equal(sender.sendEmail.mock.callCount(), 0);
    });

    it('should not send an email on failed creation of subscription request', async () => {
      const old = subscriptionRepository.create;
      subscriptionRepository.create = () => {
        throw new Error('TEST ERROR. THIS IS OK IF YOU SEE IT');
      };

      const req = createFakeRequest({
        body: defaultBody,
        params: { mailingId }
      });
      try {
        await requestSubscriptionController(req, res);
      } catch {
        // ошибка здесь ожидаема
      } finally {
        subscriptionRepository.create = old;
        assert.equal(sender.sendEmail.mock.callCount(), 0);
      }
    });

    it('should return 404 for non-existent mailing', async () => {
      const req = createFakeRequest({
        body: defaultBody,
        params: {
          mailingId: -1
        }
      });
      await requestSubscriptionController(req, res);
      assert.ok(res.status.mock.calls.some(call => call.arguments[0] === 404));
      assert.equal(res.json.mock.calls[0].arguments[0].code, 'NOT_FOUND');
      assert.ok(!res.json.mock.calls[0].arguments[0].success);
    });

    it('should expire subscription requests after TTL', async () => {
      const req = createFakeRequest({
        body: defaultBody,
        params: { mailingId }
      });
      await requestSubscriptionController(req, res);
      await sleep(ttl * 1100 * 1.1);
      const request = await subscriptionRepository.get({
        email: testReceiver2,
        mailingId
      });
      assert.ok(!request);
    });

    it('should save names', async () => {
      const req = createFakeRequest({
        body: {
          ...defaultBody,
          name: 'test'
        },
        params: { mailingId }
      });
      await requestSubscriptionController(req, res);
      const request = await subscriptionRepository.get({
        email: testReceiver2,
        mailingId
      });
      assert.equal(request?.name, 'test');
    });
  });

  describe('#subscribe', () => {
    const defaultBody = {
      email: testReceiver2,
      code: '123'
    };
    let subscriptionRequest: SubscriptionRequest;

    beforeEach(async () => {
      subscriptionRequest = await subscriptionRepository.create({
        code: defaultBody.code,
        email: testReceiver2,
        mailingId,
        periodicDate: '1',
        name: 'test'
      });
    });

    it('should return success on subscription', async () => {
      const req = createFakeRequest({
        body: defaultBody,
        params: { mailingId }
      });
      await subscribeController(req, res);
      assert.ok(res.json.mock.calls[0].arguments[0].success);
    });

    it('should remove entry from SubscriptionRequestRepository on subscription', async () => {
      const req = createFakeRequest({
        body: defaultBody,
        params: { mailingId }
      });
      await subscribeController(req, res);
      const request = await subscriptionRepository.get({
        email: testReceiver2,
        mailingId
      });
      assert.ok(!request);
    });

    it('should add user to mailing on subscription', async () => {
      const req = createFakeRequest({
        body: defaultBody,
        params: { mailingId }
      });
      let receivers = await mailingRepository.getReceivers(mailingId);
      assert.ok(!receivers.map(r => r.email).includes(testReceiver2));
      await subscribeController(req, res);
      receivers = await mailingRepository.getReceivers(mailingId);
      assert.ok(receivers.map(r => r.email).includes(testReceiver2));
    });

    it('should not subscribe with missing subscription request', async () => {
      const req = createFakeRequest({
        body: defaultBody,
        params: { mailingId }
      });
      await subscriptionRepository.remove(subscriptionRequest);
      await subscribeController(req, res);
      const receivers = await mailingRepository.getReceivers(mailingId);
      assert.ok(!receivers.map(r => r.email).includes(testReceiver2));
      assert.ok(res.status.mock.calls.some(call => call.arguments[0] === 400));
      assert.ok(!res.json.mock.calls[0].arguments[0].success);
    });

    it('should not subscribe with code mismatch', async () => {
      const req = createFakeRequest({
        body: {
          ...defaultBody,
          code: '123456'
        },
        params: { mailingId }
      });
      await subscribeController(req, res);
      const receivers = await mailingRepository.getReceivers(mailingId);
      assert.ok(!receivers.map(r => r.email).includes(testReceiver2));
      assert.ok(res.status.mock.calls.some(call => call.arguments[0] === 400));
      assert.ok(!res.json.mock.calls[0].arguments[0].success);
    });

    it('should preserve names from request', async () => {
      const req = createFakeRequest({
        body: defaultBody,
        params: { mailingId }
      });
      await subscribeController(req, res);
      const receivers = await mailingRepository.getReceivers(mailingId);
      assert.equal(receivers.filter(r => r.email === testReceiver2)[0].name, 'test');
    });
  });

  describe('update subscription', () => {
    it('should work', async () => {
      await subscriptionRepository.create({
        code: '123',
        email: testReceiver2,
        mailingId,
        name: 'test',
        periodicDate: '1'
      });
      let req = createFakeRequest({
        body: {
          code: '123',
          email: testReceiver2
        },
        params: { mailingId }
      });
      await subscribeController(req, res);

      await subscriptionRepository.create({
        code: '123',
        email: testReceiver2,
        mailingId,
        name: 'test 2',
        periodicDate: '2'
      });
      req = createFakeRequest({
        body: {
          code: '123',
          email: testReceiver2
        },
        params: { mailingId }
      });
      await subscribeController(req, res);

      const mailing = await mailingRepository.getById(mailingId);
      assert.ok(mailing);
      for (const receiver of await mailing.getReceivers()) {
        if (receiver.email === testReceiver2) {
          assert.equal(receiver.periodicDate, '2');
          assert.equal(receiver.name, 'test 2');
          return;
        }
      }
    });
  });

  describe('#unsubscribeFromAll', () => {
    async function createWith (listUnsubscribe: boolean) {
      const mailing = await mailingRepository.create({
        html: testHtml,
        listUnsubscribe,
        name: testName,
        subject: testSubject,
        undeliveredCount: 0
      }, [{ email: testReceiver2 }]);
      return mailing.id;
    }

    async function hasReceiver (id: number) {
      const mailing = await mailingRepository.getById(id);
      return Boolean(await mailing!.getReceiverByEmail(testReceiver2));
    }

    async function unsubscribeAll (body: Record<string, unknown>) {
      const controller = toController(unsubscribeFromAll(mailingRepository, logger));
      await controller(createFakeRequest({ body, params: {} }), res);
    }

    it('should remove the address from every mailing', async () => {
      const ids = [await createWith(false), await createWith(true)];
      await unsubscribeAll({ email: testReceiver2 });
      for (const id of ids) {
        assert.equal(await hasReceiver(id), false);
      }
    });

    it('should remove only from mailings with List-Unsubscribe when asked', async () => {
      const [without, withHeader] = [await createWith(false), await createWith(true)];
      await unsubscribeAll({ email: testReceiver2, listUnsubscribe: true });
      assert.equal(await hasReceiver(without), true);
      assert.equal(await hasReceiver(withHeader), false);
    });
  });
});
