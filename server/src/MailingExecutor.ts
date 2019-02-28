import { Mailing } from './Mailing';
import { MailingState } from './MailingState';
import { MailSender } from './MailSender';
import { Receiver } from './/Receiver';
import { Email, Headers } from './Email';
import { EventEmitter } from 'events';
import { MailingRepository } from 'src/MailingRepository';
import { Logger } from './Logger';
import { AddressStatsRepository } from './AddressStatsRepository';
import { isEmail } from 'validator';
import * as moment from 'moment';


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
    const email = this.createEmail(mailing, new Receiver(address));
    await this.mailer.sendEmail(email);
    this.logger.verbose(`#${mailing.id}: sent test email to ${address}`);
  }

  async startExecution (mailing: Mailing): Promise<void> {
    if (mailing.state === MailingState.RUNNING) { return; }

    if (mailing.state === MailingState.FINISHED) {
      this.logger.verbose(`#${mailing.id}: reset sentCount`);
      mailing = await this.mailingRepository.updateInTransaction(mailing.id, mailingToUpdate => {
        mailingToUpdate.sentCount = 0;
      }) || mailing;
    }

    const { value: receiver } = await this.getActualReceiverStream(mailing).next();
    if (!receiver) {
      this.logger.debug(`#${mailing.id}: no receivers to send emails to, ignoring start request`);
      return;
    } else {
      this.logger.debug(`#${mailing.id}: 123123123`, receiver);
    }

    this.logger.debug(`#${mailing.id}: starting execution`);

    this.executionStates.set(mailing.id, { stopping: false });
    this.emit(MailingExecutorEvents.MAILING_STARTED, mailing.id);
    // Это не ошибка - не ждём через await намеренно, пусть выполняется в фоне
    this.runMailing(mailing, this.getActualReceiverStream(mailing)).catch(error => {
      this.emit(MailingExecutorEvents.MAILING_ERROR, mailing.id, error);
    });
  }

  private async *getActualReceiverStream (mailing: Mailing) {
    const startedAt = moment();
    for await (const receiver of mailing.getUnsentReceiversStream()) {
      if (this.checkReceiver(mailing, receiver, startedAt)) {
        yield receiver;
      }
    }
  }

  private checkReceiver (mailing: Mailing, receiver: Receiver, startedAt: moment.Moment) {
    if (!isEmail(receiver.email) || receiver.email[0] === '-') {
      this.logger.warn(`#${mailing.id}: dropping non-email ${receiver.email}`);
      return false;
    }

    return receiver.shouldSendAt(startedAt);
  }

  private createEmail (mailing: Mailing, receiver: Receiver) {
    const headers: Headers = {};
    if (mailing.listId) {
      headers['List-Id'] = mailing.listId;
    }
    if (this.config.server.mail.listUnsubscribe) {
      headers['List-Unsubscribe'] = this.config.server.mail.listUnsubscribe;
    }
    headers.Precedence = 'bulk';

    return new Email({
      headers,
      html: mailing.getHtmlForReceiver(receiver),
      receivers: [receiver],
      replyTo: mailing.replyTo,
      subject: mailing.subject
    });
  }

  private isStopping (mailingId: number): boolean {
    const state = this.executionStates.get(mailingId);
    return Boolean(state && state.stopping);
  }

  private async runMailing (
    generalInfoMailing: Mailing, actualReceiverStream: AsyncIterable<Receiver>
  ): Promise<void> {
    // generalInfoMailing - объект с общей информацией об ошибке.
    // Он может быть устаревшим, поэтому его не обновляем напрямую,
    // а используем updateInTransaction

    const mailingId = generalInfoMailing.id;
    for await (const receiver of actualReceiverStream) {
      const email = this.createEmail(generalInfoMailing, receiver);
      if (this.isStopping(mailingId)) {
        this.logger.debug(`#${mailingId}: execution was stopped, exiting`);
        this.executionStates.delete(mailingId);
        this.emit(MailingExecutorEvents.MAILING_PAUSED, mailingId);
        return;
      }
      this.logger.debug(`#${mailingId}: sending email to ${email.receivers.join(',')}`);
      this.logger.debug(`${receiver.email}: periodicDate = ${receiver.periodicDate}`);
      await this.mailer.sendEmail(email);
      this.logger.verbose(`#${mailingId}: sent to ${email.receivers.join(',')}`);
      await this.mailingRepository.updateInTransaction(mailingId, mailing => {
        mailing.sentCount++;
      });

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
