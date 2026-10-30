import { MailingRepository } from './MailingRepository';
import { AddressStatsRepository } from './AddressStatsRepository';
import { Mailing } from './Mailing';


export interface FailedReceiver {
  diagnosticCode?: string;
  email: string;
  /**
   * Адрес уже исключён из рассылки (mail-sorter, POST /mailings/unsubscribe)
   */
  excluded?: boolean;
  spam: boolean;
  status: string;
}

export class FailureCounter {
  constructor (
    private mailingRepository: MailingRepository,
    private statsRepository: AddressStatsRepository
  ) {}

  async getFailedReceivers (mailing: Mailing, limit?: number | null): Promise<FailedReceiver[]> {
    const emails = (await this.mailingRepository.getReceivers(mailing.id))
      .map(receiver => receiver.email);
    const inList = new Set(emails);
    const excluded = (await this.mailingRepository.getExcludedEmails(mailing.id))
      .filter(email => !inList.has(email));
    emails.push(...excluded);

    // Получаем статистику для всех адресов из рассылки, включая исключённые
    const statsList: FailedReceiver[] = [];
    const actualLimit = limit ? Math.min(limit, emails.length) : emails.length;
    for (let i = 0; i < actualLimit; i++) {
      const stats = await this.statsRepository.getByEmail(emails[i]);
      // Если записи нет - то с этим email всё в порядке.
      // Если поле lastStatus не заполнено - то это "битая" запись.
      if (!stats || !stats.lastStatus) {
        continue;
      }
      // Если есть дата создания рассылки и рассылка создана позже записи - то не учитываем
      if (mailing.creationDate && stats.lastStatusDate &&
          mailing.creationDate > stats.lastStatusDate) {
        continue;
      }
      statsList.push({
        diagnosticCode: stats!.diagnosticCode,
        email: stats!.email,
        ...(inList.has(emails[i]) ? {} : { excluded: true }),
        spam: stats!.spam,
        status: stats!.lastStatus!
      });
    }

    return statsList;
  }
}
