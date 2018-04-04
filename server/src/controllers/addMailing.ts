import { MailingRepository } from '../MailingRepository';
import { Request, Response } from 'express';
import { success } from '../utils/response';
import { MailingState } from '../Mailing';
import { jsonSchemaMiddleware } from '../middleware/jsonSchemaMiddleware';
import { catchPromise } from '../utils/catchPromise';
import { getListId } from '../getListId';
import { Logger } from '../Logger';


export function addMailing (config: any, mailingRepository: MailingRepository, logger: Logger) {
  const handler = async function (req: Request, res: Response) {
    const properties = {
      headers: req.body.headers,
      html: req.body.html,
      name: req.body.name,
      sentCount: 0,
      state: MailingState.NEW,
      subject: req.body.subject
    };
    const receivers = req.body.receivers.map((receiver: any) => ({
      email: receiver.email
    }));

    const mailing = await mailingRepository.create(properties, receivers);
    logger.info(`Created mailing ${properties.name} with ID #${mailing.id}`);

    mailing.listId = getListId(config, mailing);
    await mailingRepository.update(mailing);
    logger.verbose(`#${mailing.id}: assigned List-Id = ${mailing.listId}`);

    res.json(success({
      id: mailing.id
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
    headers: {
      type: 'object',
      additionalProperties: true
    },
    html: {
      type: 'string',
      minLength: 1
    },
    name: {
      type: 'string',
      minLength: 1
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
            format: 'email',
            type: 'string'
          }
        },
        required: [
          'email'
        ]
      }
    }
  },
  required: [
    'html',
    'name',
    'receivers'
  ]
};
