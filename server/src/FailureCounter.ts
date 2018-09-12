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

  async getFailedReceivers (mailing: Mailing): Promise<FailedReceiver[]> {
    const receivers = await this.mailingRepository.getReceivers(mailing.id);
    // Получаем статистику для всех адресов из рассылки
    const statsList = await Promise.all(receivers.map(receiver =>
      this.statsRepository.getByEmail(receiver.email)
    ));
    return statsList.filter(stats => stats && stats.lastStatus).map(stats => ({
      email: stats!.email,
      status: stats!.lastStatus!
    }));
  }
}
