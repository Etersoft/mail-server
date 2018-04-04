import { MailingRepository } from '../MailingRepository';
import { Request, Response } from 'express';
import { success } from '../utils/response';
import { catchPromise } from '../utils/catchPromise';


export function getMailings (mailingRepository: MailingRepository) {
  return catchPromise(async function (req: Request, res: Response) {
    const mailings = await mailingRepository.getAll();
    const list = mailings.map(mailing => ({
      id: mailing.id,
      listId: mailing.listId,
      name: mailing.name,
      sentCount: mailing.sentCount,
      state: mailing.state
    }));
    res.json(success(list));
  });
}
