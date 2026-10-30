import { MailingRepository } from '../MailingRepository';
import { Request, Response } from 'express';
import { success } from '../utils/response';
import { catchPromise } from '../utils/catchPromise';


export function getMailings (mailingRepository: MailingRepository) {
  return catchPromise(async function (req: Request, res: Response) {
    const mailings = await mailingRepository.getAll();
    const list = mailings.map(mailing => ({
      id: mailing.id,
      autoResumeAt: mailing.autoResumeAt ?
        new Date(mailing.autoResumeAt).toISOString() : undefined,
      listId: mailing.listId,
      listUnsubscribe: mailing.listUnsubscribe,
      name: mailing.name,
      openForSubscription: mailing.openForSubscription,
      from: mailing.from,
      replyTo: mailing.replyTo,
      sentCount: mailing.sentCount,
      state: mailing.state,
      undeliveredCount: mailing.undeliveredCount
    }));
    res.json(success(list));
  });
}
