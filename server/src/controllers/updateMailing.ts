import { MailingRepository } from '../MailingRepository';
import { Request, Response } from 'express';
import { success, error } from '../utils/response';
import { catchPromise } from '../utils/catchPromise';
import { jsonSchemaMiddleware } from '../middleware/jsonSchemaMiddleware';
import { MailingState, Mailing } from '../Mailing';
import { MailingStateManager } from 'src/MailingStateManager';
import { Logger } from '../Logger';
import { isEmail } from 'validator';
import { Receiver } from '../Receiver';


export function updateMailing (
  mailingRepository: MailingRepository, stateManager: MailingStateManager, logger: Logger
) {
  const handler = async function (req: Request, res: Response) {
    const id = Number(req.params.id);

    if (!(id > 0)) {
      res.status(400).json(error('Invalid ID'));
      return;
    }

    const mailing = await mailingRepository.updateInTransaction(id, mailingToUpdate => {
      if (typeof req.body.html === 'string') {
        mailingToUpdate.html = req.body.html;
        logger.verbose(`#${mailingToUpdate.id}: updating HTML content`);
      }

      const fields = ['name', 'openForSubscription', 'replyTo', 'subject'];

      for (const field of fields) {
        if (req.body[field] !== undefined) {
          logger.verbose(
            `#${mailingToUpdate.id}: updating ${field} ${
              (mailingToUpdate as any)[field]
            } -> ${req.body[field]}`
          );
          (mailingToUpdate as any)[field] = req.body[field];
        }
      }
    });

    if (!mailing) {
      res.status(404).json(error('Mailing not found'));
      return;
    }

    let rejectedReceivers;
    if (req.body.receivers) {
      const validReceivers = req.body.receivers.filter((receiver: Receiver) =>
        isEmail(receiver.email)
      );
      await mailingRepository.setReceivers(mailing.id, validReceivers);
      rejectedReceivers = req.body.receivers.filter((receiver: Receiver) =>
        !isEmail(receiver.email)
      );
      logger.verbose(`#${mailing.id}: updating receivers list`);
    }

    if (req.body.state !== undefined && req.body.state !== mailing.state) {
      const toState = (typeof req.body.state === 'string') ?
                      MailingState[req.body.state.toUpperCase()] : req.body.state;
      const validChange = await stateManager.changeState(mailing, toState);
      if (!validChange) {
        res.status(400).json(error('Invalid state transition'));
        return;
      }
    }

    logger.info(`#${mailing.id}: updated`);

    res.json(success({
      rejectedReceivers
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
    receivers: {
      type: 'array',
      minLength: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          email: {
            type: 'string'
          }
        },
        required: ['email']
      }
    },
    replyTo: {
      type: 'string'
    },
    state: {
      type: ['integer', 'string']
    },
    subject: {
      type: 'string',
      minLength: 1
    }
  }
};
