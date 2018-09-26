import { MailingRepository } from '../MailingRepository';
import { Request, Response } from 'express';
import { success, error } from '../utils/response';
import { catchPromise } from '../utils/catchPromise';
import { FailureCounter } from '../FailureCounter';
import { sleep } from '../utils/sleep';


export function getFailedReceivers (
  mailingRepository: MailingRepository, failureCounter: FailureCounter
) {
  return catchPromise(async function (req: Request, res: Response) {
    const id = Number(req.params.id);
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;

    if (!(id > 0)) {
      res.status(400).json(error('Invalid ID'));
      return;
    }

    const mailing = await mailingRepository.getById(id);
    await sleep(5000);

    if (!mailing) {
      res.status(404).json(error('Mailing not found'));
      return;
    }

    let list = await failureCounter.getFailedReceivers(mailing);
    const total = list.length;
    if (limit) {
      list = list.slice(0, limit);
    }

    res.json(success({
      list, total
    }));
  });
}
