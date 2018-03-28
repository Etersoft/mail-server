import { MailingRepository } from '../MailingRepository';
import { Request, Response } from 'express';
import { success } from '../utils/response';
import { Mailing, MailingState } from '../Mailing';
import { jsonSchemaMiddleware } from '../middleware/jsonSchemaMiddleware';
import { catchPromise } from '../utils/catchPromise';


export function addMailing (mailingRepository: MailingRepository) {
  const handler = async function (req: Request, res: Response) {
    const properties = {
      name: req.body.name,
      sentCount: 0,
      state: MailingState.NEW
    };
    const receivers = req.body.receivers.map((receiver: any) => ({
      email: receiver.email,
      name: receiver.name
    }));
    const mailing = await mailingRepository.create(properties, receivers);
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
    name: {
      type: 'string',
      minLength: 1
    },
    receivers: {
      type: 'array',
      minItems: 1,
      uniqueItems: true,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          email: {
            format: 'email',
            type: 'string'
          },
          name: {
            type: 'string',
            minLength: 1
          }
        },
        required: [
          'email'
        ]
      }
    }
  },
  required: [
    'name',
    'receivers'
  ]
};
