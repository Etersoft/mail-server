// tslint:disable:no-console
import { Express } from 'express';
import { readConfig } from './readConfig';
import { validateConfig } from './validateConfig';
import { RedisMailingRepository } from './RedisMailingRepository';
import { createExpressServer } from './createExpressServer';
import { MailingRepository } from './MailingRepository';
import { MailingExecutor } from './MailingExecutor';
import { getMailings } from './controllers/getMailings';
import { getMailing } from './controllers/getMailing';
import { addMailing } from './controllers/addMailing';
import { updateMailing } from './controllers/updateMailing';
import { ConsoleMailSender } from './ConsoleMailSender';
import { Logger } from './Logger';
import { MailingStateManager } from './MailingStateManager';
import { getReceivers } from './controllers/getReceivers';
import { SmtpMailSender } from './SmtpMailSender';
import { deleteMailing } from './controllers/deleteMailing';
import { RedisAddressStatsRepository } from './RedisAddressStatsRepository';
import { RedisConnectionPoolImpl } from './RedisConnectionPool';
import { sendTestEmail } from './controllers/sendTestEmail';
import { getFailedReceivers } from './controllers/getFailedReceivers';
import { FailureCounter } from './FailureCounter';
import { ReceiverListFilter } from './ReceiverListFilter';
import { createRetryMailing } from './controllers/createRetryMailing';
import { requestSubscription, SubscribeTemplateContext } from './controllers/requestSubscription';
import { SubscriptionRequestRepository } from './SubscriptionRequestRepository';
import { MailSender } from './MailSender';
import { Template } from './templates/Template';
import { RedisSubscriptionRequestRepository } from './RedisSubscriptionRequestRepository';
import { readHandlebarsTemplate } from './templates/readTemplate';
import { subscribe } from './controllers/subscribe';
import { unsubscribe } from './controllers/unsubscribe';
import { deleteReceiver } from './controllers/deleteReceiver';


// Поддержка for await (... of asyncIterator) { ... }
if (!('asyncIterator' in Symbol as any)) {
  (Symbol as any).asyncIterator = Symbol.for('Symbol.asyncIterator');
}

async function main () {
  const config = readConfig();
  // Будет исключение, если конфиг некорректный
  validateConfig(config);

  const redisConnectionPool = new RedisConnectionPoolImpl(
    config.server.redis, config.server.redis.pool
  );
  const mailingRepository = new RedisMailingRepository(
    redisConnectionPool, config.server.redis.prefixes
  );
  const addressStatsRepository = new RedisAddressStatsRepository(
    redisConnectionPool, config.server.redis.prefixes
  );
  const subscriptionRepository = new RedisSubscriptionRequestRepository(
    redisConnectionPool, config.server.subscription.requestTTL
  );
  const failureCounter = new FailureCounter(mailingRepository, addressStatsRepository);
  const receiverListFilter = new ReceiverListFilter(addressStatsRepository);
  const logger = new Logger(config.server.logLevel);
  const sender = config.server.fakeSender ? new ConsoleMailSender() : new SmtpMailSender({
    from: config.server.mail.from,
    host: config.server.smtp.host,
    port: config.server.smtp.port
  });
  const executor = new MailingExecutor(
    sender,
    mailingRepository,
    addressStatsRepository,
    logger,
    config
  );
  const stateManager = new MailingStateManager(
    executor,
    logger,
    mailingRepository,
    config
  );
  await stateManager.initialize();
  const app = createExpressServer(config.server);
  setupRoutes(
    config, app, mailingRepository, stateManager, logger, executor, failureCounter,
    subscriptionRepository, sender, readHandlebarsTemplate('confirm-subscription.hbs'),
    receiverListFilter
  );
  const port = config.server.port;
  app.listen(port, () => {
    logger.info(`Listening on port ${port}`);
  });
  app.on('error', (error: any) => {
    console.error(error);
    process.exit(1);
  });
}

function setupRoutes (
  config: any, app: Express, repository: MailingRepository, stateManager: MailingStateManager,
  logger: Logger, executor: MailingExecutor, failureCounter: FailureCounter,
  subscriptionRepository: SubscriptionRequestRepository, sender: MailSender,
  subscribeTemplate: Template<SubscribeTemplateContext>, receiverListFilter: ReceiverListFilter
) {
  app.get('/mailings', getMailings(repository));
  app.get('/mailings/:id', getMailing(repository));
  app.post('/mailings', addMailing(config, repository, logger, receiverListFilter));
  app.post('/mailings/create-retry', createRetryMailing(
    config, repository, logger, failureCounter
  ));
  app.put('/mailings/:id', updateMailing(repository, stateManager, logger, receiverListFilter));
  app.get('/mailings/:id/receivers', getReceivers(repository));
  app.get('/mailings/:id/failed-receivers', getFailedReceivers(repository, failureCounter));
  app.post('/mailings/:id/send-test-email', sendTestEmail(repository, executor, logger));
  app.delete('/mailings/:id', deleteMailing(repository, logger));
  app.post('/mailings/:mailingId/requestSubscription', requestSubscription(
    subscriptionRepository, repository, logger, sender, subscribeTemplate,
    config.server.subscription
  ));
  app.post('/mailings/:mailingId/subscribe', subscribe(
    subscriptionRepository, repository, logger
  ));
  app.post('/mailings/:mailingId/unsubscribe', unsubscribe(
    subscriptionRepository, repository, logger
  ));
  app.delete('/mailings/:mailingId/receivers/:receiverId', deleteReceiver(
    repository, logger
  ));
}

main().catch(error => {
  console.error('Fatal: ', error);
  process.exit(1);
});
