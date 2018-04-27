import { MailingRepository } from '../MailingRepository';
import { Request, Response } from 'express';
import { success, error } from '../utils/response';
import { catchPromise } from '../utils/catchPromise';
import { jsonSchemaMiddleware } from '../middleware/jsonSchemaMiddleware';
import { MailingState, Mailing } from '../Mailing';
import { MailingStateManager } from 'src/MailingStateManager';
import { Logger } from '../Logger';


export function updateMailing (
  mailingRepository: MailingRepository, stateManager: MailingStateManager, logger: Logger
) {
  const handler = async function (req: Request, res: Response) {
    const id = Number(req.params.id);

    if (!(id > 0)) {
      res.status(400).json(error('Invalid ID'));
      return;
    }

    const mailing = await mailingRepository.updateInTransaction(id, mailing => {
      if (typeof req.body.html === 'string') {
        mailing.html = req.body.html;
        logger.verbose(`#${mailing.id}: updating HTML content`);
      }

      const fields = ['name', 'replyTo', 'subject'] as (keyof Mailing)[];

      for (const field of fields) {
        if (req.body[field] !== undefined) {
          mailing[field] = req.body[field];
          logger.verbose(
            `#${mailing.id}: updating ${field} ${mailing[field]} -> ${req.body[field]}`
          );
        }
      }
    });

    if (!mailing) {
      res.status(404).json(error('Mailing not found'));
      return;
    }

    if (req.body.receivers) {
      mailingRepository.setReceivers(mailing.id, req.body.receivers);
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
    html: {
      type: 'string',
      minLength: 1
    },
    name: {
      type: 'string',
      minLength: 1
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
      minLength: 1,
    }
  }
};
