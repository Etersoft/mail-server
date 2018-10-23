import { MailingRepository } from '../MailingRepository';
import { Request, Response } from 'express';
import { success, error } from '../utils/response';
import { catchPromise } from '../utils/catchPromise';
import { FailureCounter } from '../FailureCounter';
import { serveCsv } from '../utils/serveCsv';


export function getFailedReceivers (
  mailingRepository: MailingRepository, failureCounter: FailureCounter
) {
  return catchPromise(async function (req: Request, res: Response) {
    const id = Number(req.params.id);
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;
    const csv = req.query.format === 'csv';

    if (!(id > 0)) {
      res.status(400).json(error('Invalid ID'));
      return;
    }

    const mailing = await mailingRepository.getById(id);

    if (!mailing) {
      res.status(404).json(error('Mailing not found'));
      return;
    }

    let list = await failureCounter.getFailedReceivers(mailing);
    const total = list.length;
    if (limit) {
      list = list.slice(0, limit);
    }

    if (csv) {
      await serveCsv(res, list.map(receiver => [
        receiver.email, receiver.spam ? 'spam' : receiver.status
      ]), 'failed-receivers.csv');
      return;
    }

    res.json(success({
      list, total
    }));
  });
}
