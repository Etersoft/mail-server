import { Express } from 'express';
import { MailingRepository } from './MailingRepository';
import { MailingExecutor } from './MailingExecutor';
import { getMailings } from './controllers/getMailings';
import { getMailing } from './controllers/getMailing';
import { addMailing } from './controllers/addMailing';
import { updateMailing } from './controllers/updateMailing';
import { Logger } from './Logger';
import { MailingStateManager } from './MailingStateManager';
import { getReceivers } from './controllers/getReceivers';
import { deleteMailing } from './controllers/deleteMailing';
import { sendTestEmail } from './controllers/sendTestEmail';
import { getFailedReceivers } from './controllers/getFailedReceivers';
import { FailureCounter } from './FailureCounter';
import { ReceiverListFilter } from './ReceiverListFilter';
import { createRetryMailing } from './controllers/createRetryMailing';
import { requestSubscription, SubscribeTemplateContext } from './controllers/requestSubscription';
import { SubscriptionRequestRepository } from './SubscriptionRequestRepository';
import { MailSender } from './MailSender';
import { Template } from './templates/Template';
import { subscribe } from './controllers/subscribe';
import { unsubscribe } from './controllers/unsubscribe';
import { deleteReceiver } from './controllers/deleteReceiver';
import { unsubscribeFromAll } from './controllers/unsubscribeFromAll';


export function setupRoutes (
  config: any, app: Express, repository: MailingRepository, stateManager: MailingStateManager,
  logger: Logger, executor: MailingExecutor, failureCounter: FailureCounter,
  subscriptionRepository: SubscriptionRequestRepository, sender: MailSender,
  subscribeTemplate: Template<SubscribeTemplateContext>, receiverListFilter: ReceiverListFilter
) {
  app.get('/mailings', getMailings(repository));
  app.get('/mailings/:id', getMailing(repository));
  app.post('/mailings', addMailing(config, repository, logger, receiverListFilter));
  app.post('/mailings/unsubscribe', unsubscribeFromAll(repository, logger));
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

