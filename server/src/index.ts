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
    mailingRepository
  );
  await stateManager.initialize();
  const app = createExpressServer(config.server);
  setupRoutes(
    config, app, mailingRepository, stateManager, logger, executor, addressStatsRepository
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
  logger: Logger, executor: MailingExecutor, statsRepository: RedisAddressStatsRepository
) {
  app.get('/mailings', getMailings(repository));
  app.get('/mailings/:id', getMailing(repository));
  app.post('/mailings', addMailing(config, repository, logger));
  app.put('/mailings/:id', updateMailing(repository, stateManager, logger));
  app.get('/mailings/:id/receivers', getReceivers(repository));
  app.get('/mailings/:id/failed-receivers', getFailedReceivers(repository, statsRepository));
  app.post('/mailings/:id/send-test-email', sendTestEmail(repository, executor, logger));
  app.delete('/mailings/:id', deleteMailing(repository, logger));
}

main().catch(error => {
  console.error('Fatal: ', error);
  process.exit(1);
});
