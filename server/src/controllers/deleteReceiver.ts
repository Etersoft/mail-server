import { MailingRepository } from '../MailingRepository';
import { Request, Response } from 'express';
import { error, success } from '../utils/response';
import { catchPromise } from '../utils/catchPromise';
import { MailingState } from '../MailingState';
import { Logger } from '../Logger';


export function deleteReceiver (mailingRepository: MailingRepository, logger: Logger) {
  return catchPromise(async function (req: Request, res: Response) {
    const mailingId = Number(req.params.mailingId);
    const receiverId = req.params.receiverId;

    if (!(mailingId > 0)) {
      res.status(400).json(error('Invalid mailing ID'));
      return;
    }

    const mailing = await mailingRepository.getById(mailingId);

    if (!mailing) {
      res.status(404).json(error('Mailing not found'));
      return;
    }

    if (mailing.state === MailingState.RUNNING) {
      res.status(400).json(error('Cannot delete a receiver from running mailing'));
      return;
    }

    const receiver = await mailing.getReceiverByEmail(receiverId);

    if (!receiver) {
      res.status(404).json(error('Receiver not found'));
      return;
    }

    await mailing.removeReceiver(receiver);

    logger.info(`Deleted receiver ${receiverId} from mailing #${mailing.id}`);
    res.json(success());
  });
}
