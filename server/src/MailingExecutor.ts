import { Headers, Mailing, MailingState } from './Mailing';
import { MailSender } from './MailSender';
import { Receiver } from './/Receiver';
import { Email } from './Email';
import { EventEmitter } from 'events';
import { MailingRepository } from 'src/MailingRepository';
import { Logger } from './Logger';
import { AddressStatsRepository } from './AddressStatsRepository';


export class MailingExecutor extends EventEmitter {
  private executionStates: Map<number, MailingExecutionState> = new Map();

  constructor (
    private mailer: MailSender,
    private mailingRepository: MailingRepository,
    private addressStatsRepository: AddressStatsRepository,
    private logger: Logger
  ) {
    super();
  }

  async pauseExecution (mailing: Mailing): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (mailing.state !== MailingState.RUNNING || !this.executionStates.has(mailing.id)) {
        this.logger.warn(
          `#${mailing.id}: call to MailingExecutor.pauseExecution while not running`
        );
        resolve();
        return;
      }
      this.logger.verbose(`#${mailing.id}: stop requested`);
      this.once(MailingExecutorEvents.MAILING_PAUSED, resolve);
      const state = this.executionStates.get(mailing.id);
      if (state) {
        state.stopping = true;
      }
    });
  }

  async startExecution (mailing: Mailing): Promise<void> {
    if (mailing.state === MailingState.RUNNING) { return; }

    this.logger.debug(`#${mailing.id}: starting execution`);

    const unsentReceivers = await mailing.getUnsentReceivers();
    this.logger.debug(`#${mailing.id}: ${unsentReceivers.length} unsent receivers`);
    if (!unsentReceivers.length) {
      this.logger.warn(`#${mailing.id}: has no unsent receivers, but is not finished`);
      this.emit(MailingExecutorEvents.MAILING_FINISHED, mailing.id);
      return;
    }
    const emails = this.createEmails(mailing, unsentReceivers);

    this.executionStates.set(mailing.id, { stopping: false });
    this.emit(MailingExecutorEvents.MAILING_STARTED, mailing.id);
    // Это не ошибка - не ждём через await намеренно, пусть выполняется в фоне
    this.runMailing(mailing.id, emails).catch(error => {
      this.emit(MailingExecutorEvents.MAILING_ERROR, mailing.id, error);
    });
  }


  private createEmails (mailing: Mailing, receivers: Receiver[]) {
    return receivers.map(receiver => {
      const headers = mailing.listId ? Object.assign({
        'List-Id': mailing.listId
      }, mailing.headers) : mailing.headers;
      return new Email({
        headers: headers as Headers,
        html: mailing.html,
        receivers: [receiver],
        subject: mailing.subject
      });
    });
  }

  private isStopping (mailingId: number): boolean {
    const state = this.executionStates.get(mailingId);
    return Boolean(state && state.stopping);
  }

  private async runMailing (mailingId: number, emails: Email[]): Promise<void> {
    for (const email of emails) {
      if (this.isStopping(mailingId)) {
        this.logger.debug(`#${mailingId}: execution was stopped, exiting`);
        this.executionStates.delete(mailingId);
        this.emit(MailingExecutorEvents.MAILING_PAUSED, mailingId);
        return;
      }
      this.logger.debug(`#${mailingId}: sending email to ${email.receivers.join(',')}`);
      await this.mailer.sendEmail(email);
      this.logger.verbose(`#${mailingId}: sent to ${email.receivers.join(',')}`);
      await this.mailingRepository.updateInTransaction(mailingId, mailing => {
        mailing.sentCount++;
      });
      // TODO: думаю, что это стоит вынести в отдельный класс-наблюдатель,
      // чтобы подсчёт статистики работал по событию отправки письма
      for (const address of email.receivers) {
        await this.updateAddressStats(address.email);
      }
    }

    this.executionStates.delete(mailingId);
    this.emit(MailingExecutorEvents.MAILING_FINISHED, mailingId);
  }

  private async updateAddressStats (email: string) {
    const existingStats = await this.addressStatsRepository.updateInTransaction(
      email,
      async stats => {
        stats.lastSendDate = new Date();
        stats.sentCount++;
      }
    );
    if (!existingStats) {
      await this.addressStatsRepository.create({
        email,
        lastSendDate: new Date(),
        sentCount: 1
      });
    }
  }
}

export enum MailingExecutorEvents {
  MAILING_ERROR = 'error',
  MAILING_FINISHED = 'finished',
  MAILING_PAUSED = 'paused',
  MAILING_STARTED = 'started'
}

interface MailingExecutionState {
  stopping: boolean;
}
