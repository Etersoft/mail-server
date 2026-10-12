import { MailingRepository } from '../MailingRepository';
import { Request, Response } from 'express';
import { success, error } from '../utils/response';
import { jsonSchemaMiddleware } from '../middleware/jsonSchemaMiddleware';
import { catchPromise } from '../utils/catchPromise';
import { Logger } from '../Logger';
import { MailingExecutor } from '../MailingExecutor';


export function sendTestEmail (
  mailingRepository: MailingRepository, executor: MailingExecutor, logger: Logger
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

    await executor.sendTestEmail(mailing, req.body.email);

    res.json(success());
  };
  return [jsonSchemaMiddleware(requestBodyJsonSchema), catchPromise(handler)];
}

const requestBodyJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    email: {
      format: 'email',
      type: 'string'
    }
  },
  required: [
    'email'
  ]
};
