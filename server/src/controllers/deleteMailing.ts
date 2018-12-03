import { MailingRepository } from '../MailingRepository';
import { Request, Response } from 'express';
import { error, success } from '../utils/response';
import { catchPromise } from '../utils/catchPromise';
import { MailingState } from '../MailingState';
import { Logger } from '../Logger';


export function deleteMailing (mailingRepository: MailingRepository, logger: Logger) {
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

    if (mailing.state === MailingState.RUNNING) {
      res.status(400).json(error('Cannot delete a running mailing'));
      return;
    }

    await mailingRepository.remove(mailing);
    logger.info(`Deleted mailing #${mailing.id}`);
    res.json(success());
  });
}
