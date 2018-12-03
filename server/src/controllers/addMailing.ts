import { MailingRepository } from '../MailingRepository';
import { Request, Response } from 'express';
import { error, success } from '../utils/response';
import { MailingState } from '../MailingState';
import { jsonSchemaMiddleware } from '../middleware/jsonSchemaMiddleware';
import { catchPromise } from '../utils/catchPromise';
import { getListId } from '../getListId';
import { Logger } from '../Logger';
import { isEmail } from 'validator';
import { Receiver } from '../Receiver';
import * as moment from 'moment';


export function addMailing (config: any, mailingRepository: MailingRepository, logger: Logger) {
  const handler = async function (req: Request, res: Response) {
    let receivers: Receiver[];
    let source;
    let isClone = false;
    if (req.body.sourceId) {
      const sourceMailing = await mailingRepository.getById(req.body.sourceId);
      if (!sourceMailing) {
        res.status(404).json(error('Source mailing not found'));
        return;
      }
      source = sourceMailing;
      isClone = true;
      receivers = await mailingRepository.getReceivers(sourceMailing.id);
    } else {
      source = req.body;
      receivers = req.body.receivers;
    }

    const properties = {
      creationDate: moment(),
      html: source.html,
      name: source.name + (isClone ? ' (копия)' : ''),
      openForSubscription: source.openForSubscription,
      replyTo: source.replyTo,
      sentCount: 0,
      state: MailingState.NEW,
      subject: source.subject,
      undeliveredCount: 0
    };
    const validEmails = receivers.filter(receiver => isEmail(receiver.email));

    const mailing = await mailingRepository.create(properties, validEmails);
    logger.info(`Created mailing ${properties.name} with ID #${mailing.id}`);

    const listId = getListId(config, mailing);
    await mailingRepository.updateInTransaction(mailing.id, mailingToUpdate => {
      mailingToUpdate.listId = listId;
    });
    logger.verbose(`#${mailing.id}: assigned List-Id = ${listId}`);

    res.json(success({
      id: mailing.id,
      listId,
      rejectedReceivers: receivers.filter(receiver => !isEmail(receiver.email))
    }));
  };
  return [jsonSchemaMiddleware(requestBodyJsonSchema), catchPromise(handler)];
}

// tslint:disable:object-literal-sort-keys
const requestBodyJsonSchema = {
  oneOf: [
    {
      $id: 'http://example.com/example.json',
      type: 'object',
      definitions: {},
      $schema: 'http://json-schema.org/draft-07/schema#',
      additionalProperties: false,
      properties: {
        html: {
          type: 'string',
          minLength: 1
        },
        name: {
          type: 'string',
          minLength: 1
        },
        openForSubscription: {
          type: 'boolean'
        },
        subject: {
          type: 'string',
          minLength: 1
        },
        receivers: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              email: {
                type: 'string'
              }
            },
            required: [
              'email'
            ]
          }
        },
        replyTo: {
          type: 'string',
          minLength: 1
        }
      },
      required: [
        'html',
        'name',
        'receivers',
        'subject'
      ]
    },
    {
      $id: 'http://example.com/example.json',
      type: 'object',
      definitions: {},
      $schema: 'http://json-schema.org/draft-07/schema#',
      additionalProperties: false,
      properties: {
        sourceId: {
          type: 'integer'
        }
      },
      required: [
        'sourceId'
      ]
    }
  ]
};
