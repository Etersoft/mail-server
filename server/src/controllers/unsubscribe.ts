import { MailingRepository } from '../MailingRepository';
import { Request, Response } from 'express';
import { error, success } from '../utils/response';
import { jsonSchemaMiddleware } from '../middleware/jsonSchemaMiddleware';
import { catchPromise } from '../utils/catchPromise';
import { Logger } from '../Logger';
import { SubscriptionRequestRepository } from '../SubscriptionRequestRepository';


export function unsubscribe (
  subscriptionRepository: SubscriptionRequestRepository, 
  mailingRepository: MailingRepository, logger: Logger
) {
  const handler = async function (req: Request, res: Response) {
    const mailingId = req.params.mailingId;
    const mailing = await mailingRepository.getById(mailingId);

    if (!mailing) {
      res.status(404).json(error('Mailing not found'));
      return;
    }

    let receiverToUnsubscribe;
    for await (const receiver of mailing.getReceiversStream()) {
      if (receiver.email === req.body.email) {
        receiverToUnsubscribe = receiver;
        break;
      }
    }

    if (!receiverToUnsubscribe) {
      logger.verbose(`No email ${req.body.email} in mailing #${mailingId}`);
      // если человек не подписан - попробуем удалить запрос на подписку
      const subscriptionRequest = await subscriptionRepository.get({
        email: req.body.email,
        mailingId
      });
      if (!subscriptionRequest) {
        res.status(400).json(error('Not subscribed.'));
        return;
      }
      if (subscriptionRequest.code !== req.body.code) {
        res.status(400).json(error('Code mismatch.'));
        return;
      }

      logger.info(
        `Removed subscription request: mailing #${mailingId}, email ${req.body.email}`
      );
      await subscriptionRepository.remove(subscriptionRequest);
      res.json(success());
      return;
    }

    if (receiverToUnsubscribe.code !== req.body.code) {
      res.status(400).json(error('Code mismatch.'));
      return;
    }

    const removed = await mailing.removeReceiver(receiverToUnsubscribe);

    if (!removed) {
      res.status(500).json(error('Cannot remove receiver. Internal error.'));
      return;
    }

    logger.info(`Unsubscribed: mailing #${mailing.id}, email ${req.body.email}`);

    res.json(success());
  };
  return [jsonSchemaMiddleware(requestBodyJsonSchema), catchPromise(handler)];
}

// tslint:disable:object-literal-sort-keys
const requestBodyJsonSchema = {
  $id: 'http://example.com/example.json',
  type: 'object',
  definitions: {},
  $schema: 'http://json-schema.org/draft-07/schema#',
  additionalProperties: false,
  properties: {
    email: {
      type: 'string',
      format: 'email'
    },
    code: {
      type: 'string'
    }
  },
  required: [
    'email', 'code'
  ]
};
