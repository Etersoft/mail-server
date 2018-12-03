import { MailingRepository } from '../MailingRepository';
import { Request, Response } from 'express';
import { error, success } from '../utils/response';
import { MailingState } from '../MailingState';
import { jsonSchemaMiddleware } from '../middleware/jsonSchemaMiddleware';
import { catchPromise } from '../utils/catchPromise';
import { getListId } from '../getListId';
import { Logger } from '../Logger';
import { isEmail } from 'validator';
import { FailureCounter } from '../FailureCounter';


export function createRetryMailing (
  config: any, mailingRepository: MailingRepository, logger: Logger,
  failureCounter: FailureCounter
) {
  const handler = async function (req: Request, res: Response) {
    const sourceId = req.body.sourceId;
    const sourceMailing = await mailingRepository.getById(sourceId);
    if (!sourceMailing) {
      res.status(404).json(error('Source mailing not found'));
      return;
    }

    const sourceFailedReceivers = await failureCounter.getFailedReceivers(sourceMailing);

    const properties = {
      html: sourceMailing.html,
      name: sourceMailing.name + ': повтор по ошибкам доставки',
      replyTo: sourceMailing.replyTo,
      sentCount: 0,
      state: MailingState.NEW,
      subject: sourceMailing.subject,
      undeliveredCount: 0
    };

    const receivers = sourceFailedReceivers.map(receiver => ({
      email: receiver.email
    }));

    const mailing = await mailingRepository.create(properties, receivers);
    logger.info(`Created retry mailing ${properties.name} with ID #${mailing.id}`);

    const listId = getListId(config, mailing);
    await mailingRepository.updateInTransaction(mailing.id, mailingToUpdate => {
      mailingToUpdate.listId = listId;
    });
    logger.verbose(`#${mailing.id}: assigned List-Id = ${listId}`);

    res.json(success({
      id: mailing.id, listId
    }));
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
    sourceId: {
      type: 'number'
    }
  },
  required: [
    'sourceId'
  ]
};
