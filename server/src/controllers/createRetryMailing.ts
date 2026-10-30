import { MailingRepository } from '../MailingRepository';
import { Request, Response } from 'express';
import { error, success } from '../utils/response';
import { MailingState } from '../MailingState';
import { jsonSchemaMiddleware } from '../middleware/jsonSchemaMiddleware';
import { catchPromise } from '../utils/catchPromise';
import { getListId } from '../getListId';
import { Logger } from '../Logger';
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
      listUnsubscribe: sourceMailing.listUnsubscribe,
      name: sourceMailing.name + ': повтор по ошибкам доставки',
      from: sourceMailing.from,
      replyTo: sourceMailing.replyTo,
      sentCount: 0,
      state: MailingState.NEW,
      subject: sourceMailing.subject,
      undeliveredCount: 0
    };

    // Исключённые mail-sorter адреса не возвращаем: их отсеяли намеренно
    const receivers = sourceFailedReceivers
      .filter(receiver => !receiver.excluded)
      .map(receiver => ({ email: receiver.email }));

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

export const requestBodyJsonSchema = {
  type: 'object',
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
