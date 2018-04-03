import { MailingRepository } from '../MailingRepository';
import { Request, Response } from 'express';
import { success, error } from '../utils/response';
import { catchPromise } from '../utils/catchPromise';
import { jsonSchemaMiddleware } from '../middleware/jsonSchemaMiddleware';
import { MailSender } from '../MailSender';
import { MailingState, Mailing } from '../Mailing';
import { MailingExecutor } from 'src/MailingExecutor';
import { MailingStateManager } from 'src/MailingStateManager';


export function updateMailing (
  mailingRepository: MailingRepository, stateManager: MailingStateManager
) {
  const handler = async function (req: Request, res: Response) {
    const id = Number(req.params.id);

    if (!(id > 0)) {
      res.status(400).json(error('Invalid ID'));
      return;
    }

    const mailing = await mailingRepository.getById(id);
    if (!mailing) {
      res.status(404).json(error('Mailing not found'));
      return;
    }

    if (typeof req.body.html === 'string') {
      mailing.html = req.body.html;
    }

    if (typeof req.body.name === 'string') {
      mailing.name = req.body.name;
    }

    await mailingRepository.update(mailing);

    if (req.body.state !== mailing.state) {
      const toState = (typeof req.body.state === 'string') ?
                      MailingState[req.body.state.toUpperCase()] : req.body.state;
      const validChange = await stateManager.changeState(mailing, toState);
      if (!validChange) {
        res.status(400).json(error('Invalid state transition'));
        return;
      }
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
    state: {
      type: ['integer', 'string']
    },
    name: {
      type: 'string',
      minLength: 1
    },
    html: {
      type: 'string',
      minLength: 1
    }
  }
};
