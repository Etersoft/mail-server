import { MailingRepository } from '../MailingRepository';
import { Request, Response } from 'express';
import { success, error } from '../utils/response';
import { catchPromise } from '../utils/catchPromise';
import { serveCsv } from '../utils/serveCsv';


export function getReceivers (mailingRepository: MailingRepository) {
  return catchPromise(async function (req: Request, res: Response) {
    const id = Number(req.params.id);
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;
    const csv = req.query.format === 'csv';

    if (!(id > 0)) {
      res.status(400).json(error('Invalid ID'));
      return;
    }

    const receivers = await mailingRepository.getReceivers(id, 0, limit || -1);

    if (csv) {
      await serveCsv(res, receivers.map(receiver => [receiver.email]), 'receivers.csv');
      return;
    }

    const total = await mailingRepository.getReceiverCount(id);
    const list = receivers.map(receiver => ({
      email: receiver.email,
      name: receiver.name,
      periodicDate: receiver.periodicDate
    }));
    res.json(success({
      list, total
    }));
  });
}
