import { MailingRepository } from '../MailingRepository';
import { Request, Response } from 'express';
import { success, error } from '../utils/response';
import { catchPromise } from '../utils/catchPromise';
import { jsonSchemaMiddleware } from '../middleware/jsonSchemaMiddleware';
import { MailingState } from '../MailingState';
import { MailingStateManager } from '../MailingStateManager';
import { Logger } from '../Logger';
import { Receiver } from '../Receiver';
import { ReceiverListFilter } from '../ReceiverListFilter';
import { generateUniqueCode } from '../utils/codes';
import { Mailing } from '../Mailing';


export function updateMailing (
  mailingRepository: MailingRepository, stateManager: MailingStateManager, logger: Logger,
  receiverListFilter: ReceiverListFilter
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

      const fields = ['extraData', 'from', 'name', 'openForSubscription', 'replyTo', 'subject'];

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

    if (req.body.openForSubscription) {
      await assignCodes(mailing);
    }

    let rejectedReceivers;
    if (req.body.receivers) {
      const validReceivers = await receiverListFilter.getValidReceivers(req.body.receivers);
      // assign codes for unsubscribe links
      if (mailing.openForSubscription) {
        for (const receiver of validReceivers) {
          receiver.code = generateUniqueCode();
        }
      }
      await mailingRepository.setReceivers(mailing.id, validReceivers);
      rejectedReceivers = req.body.receivers.filter((r: Receiver) => 
        !validReceivers.find(vr => r.email === vr.email)
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

  // Коды присваиваются на месте: перестановка получателей сбила бы позицию,
  // с которой продолжится отправка
  async function assignCodes (mailing: Mailing) {
    const receivers = [...await mailingRepository.getReceivers(mailing.id)];
    const withoutCode = receivers.filter(receiver => !receiver.code);
    if (!withoutCode.length) {
      return;
    }
    for (const receiver of withoutCode) {
      receiver.code = generateUniqueCode();
    }
    await mailingRepository.setReceivers(mailing.id, receivers);
  }
}

export const requestBodyJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    extraData: {
      type: 'object'
    },
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
          },
          name: {
            type: 'string'
          },
          extraData: {
            type: 'object'
          }
        },
        required: ['email']
      }
    },
    from: {
      type: 'string'
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
