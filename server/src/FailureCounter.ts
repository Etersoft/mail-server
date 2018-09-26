import { MailingRepository } from './MailingRepository';
import { AddressStatsRepository } from './AddressStatsRepository';
import { Mailing } from './Mailing';


export interface FailedReceiver {
  email: string;
  status: string;
}

export class FailureCounter {
  constructor (
    private mailingRepository: MailingRepository,
    private statsRepository: AddressStatsRepository
  ) {}

  async getFailedReceivers (mailing: Mailing, limit?: number | null): Promise<FailedReceiver[]> {
    const receivers = await this.mailingRepository.getReceivers(mailing.id);

    // Получаем статистику для всех адресов из рассылки
    const statsList = [];
    const actualLimit = limit ? Math.min(limit, receivers.length) : receivers.length;
    for (let i = 0; i < actualLimit; i++) {
      const stats = await this.statsRepository.getByEmail(receivers[i].email);
      // Если записи нет - то с этим email всё в порядке.
      // Если поле lastStatus не заполнено - то это "битая" запись.
      if (!stats || !stats.lastStatus) {
        continue;
      }
      // Если есть дата создания рассылки и рассылка создана позже записи - то не учитываем
      if (mailing.creationDate && mailing.creationDate!.isAfter(stats!.lastStatusDate)) {
        continue;
      }
      statsList.push({
        email: stats!.email,
        status: stats!.lastStatus!
      });
    }

    return statsList;
  }
}
