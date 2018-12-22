import { MailingRepository } from '../MailingRepository';
import { Request, Response } from 'express';
import { error, success } from '../utils/response';
import { jsonSchemaMiddleware } from '../middleware/jsonSchemaMiddleware';
import { catchPromise } from '../utils/catchPromise';
import { Logger } from '../Logger';
import { SubscriptionRequestRepository } from '../SubscriptionRequestRepository';
import { Receiver } from '../Receiver';


export function subscribe (
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

    const request = await subscriptionRepository.get({
      email: req.body.email,
      mailingId
    });

    if (!request) {
      res.status(400).json(error('No subscription request found.'));
      return;
    }

    if (request.code !== req.body.code) {
      res.status(400).json(error('Code mismatch.'));
      logger.info(
        `Subscription attempt: code mismatch. Email ${request.email}, code ${req.body.code}`
      );
      return;
    }

    // if receiver exists - remove it first
    for await (const receiver of mailing.getReceiversStream()) {
      if (receiver.email === request.email) {
        await mailing.removeReceiver(receiver);
        break;
      }
    }

    await mailing.addReceiver(new Receiver(
      request.email, request.name, request.code, request.periodicDate
    ));
    await subscriptionRepository.remove(request);

    logger.info(`Subscribed to mailing #${mailing.id}. Email ${request.email}`);

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
