import { MailingRepository } from '../MailingRepository';
import { Request, Response } from 'express';
import { success, error } from '../utils/response';
import { catchPromise } from '../utils/catchPromise';


export function getReceivers (mailingRepository: MailingRepository) {
  return catchPromise(async function (req: Request, res: Response) {
    const id = Number(req.params.id);
    
    if (!(id > 0)) {
      res.status(400).json(error('Invalid ID'));
      return;
    }

    const receivers = await mailingRepository.getReceivers(id);
    const list = receivers.map(receiver => ({
      email: receiver.email
    }));
    res.json(success(list));
  });
}
