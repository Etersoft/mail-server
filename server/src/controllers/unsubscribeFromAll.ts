import { MailingRepository } from '../MailingRepository';
import { Request, Response } from 'express';
import { success } from '../utils/response';
import { jsonSchemaMiddleware } from '../middleware/jsonSchemaMiddleware';
import { catchPromise } from '../utils/catchPromise';
import { Logger } from '../Logger';


/**
 * Исключает адрес из всех рассылок без проверки кода. Используется
 * mail-sorter (драйвер базы "mail-server") для адресов, на которые письма
 * не доставляются, и для запросов отписки, пришедших письмом.
 * Ответ: { removed: <количество рассылок, из которых удалён адрес> }
 */
export function unsubscribeFromAll (mailingRepository: MailingRepository, logger: Logger) {
  const handler = async function (req: Request, res: Response) {
    const email: string = req.body.email;
    let removed = 0;
    for (const mailing of await mailingRepository.getAll()) {
      const receiver = await mailing.getReceiverByEmail(email);
      if (receiver && await mailing.removeReceiver(receiver)) {
        logger.info(`Unsubscribed: mailing #${mailing.id}, email ${email}`);
        removed++;
      }
    }
    res.json(success({ removed }));
  };
  return [jsonSchemaMiddleware(requestBodyJsonSchema), catchPromise(handler)];
}

const requestBodyJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    email: {
      type: 'string',
      minLength: 1
    }
  },
  required: [
    'email'
  ]
};
