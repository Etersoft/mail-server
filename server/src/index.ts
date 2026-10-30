import { readConfig } from './readConfig';
import { validateConfig } from './validateConfig';
import { RedisMailingRepository } from './RedisMailingRepository';
import { createExpressServer } from './createExpressServer';
import { setupRoutes } from './routes';
import { MailingExecutor } from './MailingExecutor';
import { ConsoleMailSender } from './ConsoleMailSender';
import { Logger } from './Logger';
import { MailingStateManager } from './MailingStateManager';
import { SmtpMailSender } from './SmtpMailSender';
import { RedisAddressStatsRepository } from './RedisAddressStatsRepository';
import { RedisConnectionPoolImpl } from './RedisConnectionPool';
import { FailureCounter } from './FailureCounter';
import { ReceiverListFilter } from './ReceiverListFilter';
import { RedisSubscriptionRequestRepository } from './RedisSubscriptionRequestRepository';
import { readHandlebarsTemplate } from './templates/readTemplate';


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
  const { host, port } = config.server;
  await new Promise<void>((resolve, reject) => {
    // host не задан — все интерфейсы
    app.listen(port, host, error => error ? reject(error) : resolve());
  });
  logger.info(`Listening on ${host || '*'}:${port}`);
}

main().catch(error => {
  console.error('Fatal: ', error);
  process.exit(1);
});
