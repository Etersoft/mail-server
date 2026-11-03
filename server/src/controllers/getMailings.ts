import { MailingRepository } from '../MailingRepository';
import { Request, Response } from 'express';
import { success } from '../utils/response';
import { catchPromise } from '../utils/catchPromise';
import { describeRetries } from './describeRetries';


export function getMailings (mailingRepository: MailingRepository) {
  return catchPromise(async function (req: Request, res: Response) {
    const mailings = await mailingRepository.getAll();
    const list = await Promise.all(mailings.map(async mailing => ({
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
      ...await describeRetries(mailingRepository, mailing.id),
      state: mailing.state,
      undeliveredCount: mailing.undeliveredCount
    })));
    res.json(success(list));
  });
}
