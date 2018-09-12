import { MailingRepository } from '../MailingRepository';
import { Request, Response } from 'express';
import { success, error } from '../utils/response';
import { catchPromise } from '../utils/catchPromise';
import { AddressStatsRepository } from '../AddressStatsRepository';


export function getFailedReceivers (
  mailingRepository: MailingRepository, statsRepository: AddressStatsRepository
) {
  return catchPromise(async function (req: Request, res: Response) {
    const id = Number(req.params.id);
    const limit = req.query.limit ? parseInt(req.query.limit) : null;

    if (!(id > 0)) {
      res.status(400).json(error('Invalid ID'));
      return;
    }

    const mailing = await mailingRepository.getById(id);

    if (!mailing) {
      res.status(404).json(error('Mailing not found'));
      return;
    }

    const receivers = await mailingRepository.getReceivers(id);
    // Получаем статистику для всех адресов из рассылки
    const statsList = await Promise.all(receivers.map(receiver =>
      statsRepository.getByEmail(receiver.email)
    ));
    let list = statsList.filter(stats => stats && stats.lastStatus);
    const total = list.length;
    if (limit) {
      list = list.slice(0, limit);
    }

    const responseList = list.map(stats => ({
      email: stats!.email,
      status: stats!.lastStatus
    }));

    res.json(success({
      list: responseList,
      total
    }));
  });
}
