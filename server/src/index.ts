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
import { addMailing } from './controllers/addMailing';
import { ConsoleMailSender } from './ConsoleMailSender';


async function main () {
  const config = readConfig();
  // Будет исключение, если конфиг некорректный
  validateConfig(config);

  const redisClient = createRedisClient(config.redis);
  const repository = new RedisMailingRepository(
    redisClient, config.redis.prefixes
  );
  const executor = new MailingExecutor(new ConsoleMailSender());
  const app = createExpressServer(config.http);
  setupRoutes(app, repository, executor);
  const port = config.http.port;
  app.listen(port, () => {
    console.log(`Listening on port ${port}`);
  });
  app.on('error', (error: Error) => {
    console.error(error);
    process.exit(1);
  });
}

function setupRoutes (app: Express, repository: MailingRepository, executor: MailingExecutor) {
  app.get('/mailings', getMailings(repository));
  app.post('/mailings', addMailing(repository));
}

main().catch(error => {
  console.error('Fatal: ', error);
  process.exit(1);
});
