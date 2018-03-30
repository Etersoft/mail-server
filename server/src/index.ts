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


async function main () {
  const config = readConfig();
  // Будет исключение, если конфиг некорректный
  validateConfig(config);

  const redisClient = createRedisClient(config.redis);
  const repository = new RedisMailingRepository(
    redisClient, config.server.redis.prefixes
  );
  const logger = new Logger();
  const sender = config.server.fakeSender ? new ConsoleMailSender() : new SmtpMailSender({
    from: 'theowl@etersoft.ru',
    port: 5870
  });
  const executor = new MailingExecutor(
    sender,
    repository,
    logger
  );
  const stateManager = new MailingStateManager(
    executor,
    logger,
    repository
  );
  await stateManager.initialize();
  const app = createExpressServer(config.server);
  setupRoutes(app, repository, stateManager);
  const port = config.server.port;
  app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });
  app.on('error', (error: Error) => {
    console.error(error);
    process.exit(1);
  });
}

function setupRoutes (
  app: Express, repository: MailingRepository, stateManager: MailingStateManager
) {
  app.get('/mailings', getMailings(repository));
  app.get('/mailings/:id', getMailing(repository));
  app.post('/mailings', addMailing(repository));
  app.put('/mailings/:id', updateMailing(repository, stateManager));
  app.get('/mailings/:id/receivers', getReceivers(repository));
}

main().catch(error => {
  console.error('Fatal: ', error);
  process.exit(1);
});
