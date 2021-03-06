import { MailingRepository } from '../MailingRepository';
import { Request, Response } from 'express';
import { success, error } from '../utils/response';
import { catchPromise } from '../utils/catchPromise';
import { MailingState } from '../MailingState';


export function getMailing (mailingRepository: MailingRepository) {
  return catchPromise(async function (req: Request, res: Response) {
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

    res.json(success({
      creationDate: mailing.creationDate && mailing.creationDate.unix(),
      extraData: mailing.extraData,
      html: mailing.html,
      id: mailing.id,
      listId: mailing.listId,
      name: mailing.name,
      openForSubscription: mailing.openForSubscription,
      replyTo: mailing.replyTo,
      sentCount: mailing.sentCount,
      state: req.query.stringState ? MailingState[mailing.state] : mailing.state,
      subject: mailing.subject,
      undeliveredCount: mailing.undeliveredCount
    }));
  });
}
