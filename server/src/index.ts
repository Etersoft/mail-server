// tslint:disable:no-console
import { Express } from 'express';
import { readConfig } from './readConfig';
import { validateConfig } from './validateConfig';
import { createRedisClient } from './createRedisClient';
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


async function main () {
  const config = readConfig();
  // Будет исключение, если конфиг некорректный
  validateConfig(config);

  const redisClient = createRedisClient(config.redis);
  const mailingRepository = new RedisMailingRepository(
    redisClient, config.server.redis.prefixes
  );
  const addressStatsRepository = new RedisAddressStatsRepository(
    redisClient, config.server.redis.prefixes
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
    logger
  );
  const stateManager = new MailingStateManager(
    executor,
    logger,
    mailingRepository
  );
  await stateManager.initialize();
  const app = createExpressServer(config.server);
  setupRoutes(config, app, mailingRepository, stateManager, logger);
  const port = config.server.port;
  app.listen(port, () => {
    logger.info(`Listening on port ${port}`);
  });
  app.on('error', (error: Error) => {
    console.error(error);
    process.exit(1);
  });
}

function setupRoutes (
  config: any, app: Express, repository: MailingRepository, stateManager: MailingStateManager,
  logger: Logger
) {
  app.get('/mailings', getMailings(repository));
  app.get('/mailings/:id', getMailing(repository));
  app.post('/mailings', addMailing(config, repository, logger));
  app.put('/mailings/:id', updateMailing(repository, stateManager, logger));
  app.get('/mailings/:id/receivers', getReceivers(repository));
  app.delete('/mailings/:id', deleteMailing(repository, logger));
}

main().catch(error => {
  console.error('Fatal: ', error);
  process.exit(1);
});
