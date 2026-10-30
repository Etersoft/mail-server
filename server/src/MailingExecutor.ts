import { Mailing } from './Mailing';
import { MailingState } from './MailingState';
import { MailSender } from './MailSender';
import { Receiver } from './Receiver';
import { Email, Headers } from './Email';
import { EventEmitter } from 'events';
import { MailingRepository } from './MailingRepository';
import { Logger } from './Logger';
import { AddressStatsRepository } from './AddressStatsRepository';
import { isEmail } from 'validator';


export class MailingExecutor extends EventEmitter {
  private executionStates: Map<number, MailingExecutionState> = new Map();

  constructor (
    private mailer: MailSender,
    private mailingRepository: MailingRepository,
    private addressStatsRepository: AddressStatsRepository,
    private logger: Logger,
    private config: any
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

  async sendTestEmail (mailing: Mailing, address: string) {
    const email = await this.createEmail(mailing, new Receiver(address));
    await this.mailer.sendEmail(email);
    this.logger.verbose(`#${mailing.id}: sent test email to ${address}`);
  }

  async startExecution (mailing: Mailing): Promise<void> {
    if (mailing.state === MailingState.RUNNING) { return; }

    if (mailing.state === MailingState.FINISHED) {
      this.logger.verbose(`#${mailing.id}: reset sentCount and position`);
      mailing = await this.mailingRepository.updateInTransaction(mailing.id, mailingToUpdate => {
        mailingToUpdate.position = 0;
        mailingToUpdate.sentCount = 0;
      }) || mailing;
    }

    const { value: receiver } = await this.getActualReceiverStream(mailing).next();
    if (!receiver) {
      this.logger.debug(`#${mailing.id}: no receivers to send emails to, ignoring start request`);
      return;
    }

    this.logger.debug(`#${mailing.id}: starting execution`);

    this.executionStates.set(mailing.id, { stopping: false });
    this.emit(MailingExecutorEvents.MAILING_STARTED, mailing.id);
    // Это не ошибка - не ждём через await намеренно, пусть выполняется в фоне
    this.runMailing(mailing).catch(error => {
      this.emit(MailingExecutorEvents.MAILING_ERROR, mailing.id, error);
    });
  }

  private async *getActualReceiverStream (mailing: Mailing) {
    const startedAt = new Date();
    for await (const receiver of mailing.getUnsentReceiversStream()) {
      if (this.checkReceiver(mailing, receiver, startedAt)) {
        yield receiver;
      }
    }
  }

  private checkReceiver (mailing: Mailing, receiver: Receiver, startedAt: Date) {
    if (!isEmail(receiver.email) || receiver.email[0] === '-') {
      this.logger.warn(`#${mailing.id}: dropping non-email ${receiver.email}`);
      return false;
    }

    return receiver.shouldSendAt(startedAt);
  }

  private async createEmail (mailing: Mailing, receiver: Receiver) {
    const headers: Headers = {};
    if (mailing.listId) {
      headers['List-Id'] = mailing.listId;
    }
    if (this.config.server.mail.listUnsubscribe) {
      headers['List-Unsubscribe'] = this.config.server.mail.listUnsubscribe;
    }
    headers.Precedence = 'bulk';
    const html = await mailing.getHtmlForReceiver(receiver);
    const subject = await mailing.getSubjectForReceiver(receiver);
    return new Email({
      from: mailing.from,
      headers,
      html: html,
      receivers: [receiver],
      replyTo: mailing.replyTo,
      subject
    });
  }

  private isStopping (mailingId: number): boolean {
    const state = this.executionStates.get(mailingId);
    return Boolean(state && state.stopping);
  }

  private async runMailing (generalInfoMailing: Mailing): Promise<void> {
    // generalInfoMailing - объект с общей информацией о рассылке.
    // Он может быть устаревшим, поэтому его не обновляем напрямую.
    // Позиция в списке получателей хранится в репозитории и читается перед
    // каждым письмом: список может измениться во время отправки (mail-sorter
    // удаляет адреса с ошибками доставки), и репозиторий поправляет позицию

    const mailingId = generalInfoMailing.id;
    const startedAt = new Date();
    while (true) {
      if (this.isStopping(mailingId)) {
        this.logger.debug(`#${mailingId}: execution was stopped, exiting`);
        this.executionStates.delete(mailingId);
        this.emit(MailingExecutorEvents.MAILING_PAUSED, mailingId);
        return;
      }

      const receiver = await this.mailingRepository.getNextReceiver(mailingId);
      if (!receiver) {
        break;
      }

      if (!this.checkReceiver(generalInfoMailing, receiver, startedAt)) {
        await this.mailingRepository.advancePosition(mailingId, receiver, false);
        continue;
      }

      const email = await this.createEmail(generalInfoMailing, receiver);
      this.logger.debug(`#${mailingId}: sending email to ${email.receivers.join(',')}`);
      this.logger.debug(`${receiver.email}: periodicDate = ${receiver.periodicDate}`);
      await this.mailer.sendEmail(email);
      this.logger.verbose(`#${mailingId}: sent to ${email.receivers.join(',')}`);
      await this.mailingRepository.advancePosition(mailingId, receiver, true);

      this.emit(MailingExecutorEvents.EMAIL_SENT, generalInfoMailing, email);

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
        stats.sentCount = (stats.sentCount || 0) + 1;
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
  MAILING_STARTED = 'started',
  EMAIL_SENT = 'sent'
}

interface MailingExecutionState {
  stopping: boolean;
}
