import { MailingRepository } from '../MailingRepository';
import { Request, Response } from 'express';
import { error, success } from '../utils/response';
import { jsonSchemaMiddleware } from '../middleware/jsonSchemaMiddleware';
import { catchPromise } from '../utils/catchPromise';
import { Logger } from '../Logger';
import { SubscriptionRequestRepository } from '../SubscriptionRequestRepository';
import * as uuid from 'uuid/v4';
import { MailSender } from '../MailSender';
import { Template } from '../templates/Template';
import { Mailing } from '../Mailing';
import { SubscriptionRequest } from '../SubscriptionRequest';
import { Email } from '../Email';
import { Receiver } from '../Receiver';


export interface SubscribeTemplateContext {
  mailing: Mailing;
  name?: string;
  subscriptionRequest: SubscriptionRequest;
}

export interface SubscriptionConfig {
  replyTo?: string;
  subject: string;
}

export function requestSubscription (
  subscriptionRepository: SubscriptionRequestRepository, 
  mailingRepository: MailingRepository, logger: Logger,
  sender: MailSender, subscribeTemplate: Template<SubscribeTemplateContext>,
  config: SubscriptionConfig
) {
  const handler = async function (req: Request, res: Response) {
    const mailingId = req.params.mailingId;
    const mailing = await mailingRepository.getById(mailingId);

    if (!mailing) {
      res.status(404).json(error('Mailing not found'));
      return;
    }

    if (!mailing.openForSubscription) {
      res.status(400).json(error('Mailing is closed for subscription.'));
      return;
    }

    if (await mailing.hasReceiver(req.body.email)) {
      res.status(400).json(error('Already subscribed.'));
      return;
    }

    let code = uuid();

    logger.info(
      `Requested subscription: mailing #${mailingId}, ${req.body.email}, date: ${
        req.body.periodicDate
      }`
    );

    let subscriptionRequest = await subscriptionRepository.get({
      email: req.body.email,
      mailingId
    });

    if (subscriptionRequest) {
      // если есть существующий запрос - то используем код из него
      // всё остальное перезапишем с нуля
      code = subscriptionRequest.code;
    }

    subscriptionRequest = await subscriptionRepository.create({
      email: req.body.email,
      mailingId,
      periodicDate: req.body.periodicDate,
      code
    });

    const mailText = subscribeTemplate.render({
      mailing,
      name: req.body.name,
      subscriptionRequest
    });
    const email = new Email({
      html: mailText,
      receivers: [new Receiver(req.body.email, req.body.name)],
      replyTo: config.replyTo,
      subject: config.subject
    });
    try {
      await sender.sendEmail(email);
    } catch (error) {
      logger.warn('Caught send error, rolling back subscription request...');
      await subscriptionRepository.remove(subscriptionRequest);
      throw error;
    }

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
    name: {
      type: 'string'
    },
    periodicDate: {
      type: 'integer',
      min: 1,
      max: 31
    }
  },
  required: [
    'email'
  ]
};
