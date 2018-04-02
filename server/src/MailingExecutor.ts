import { Mailing, MailingState } from './Mailing';
import { MailSender } from './MailSender';
import { Receiver } from './/Receiver';
import { Email } from './Email';
import { EventEmitter } from 'events';
import { MailingRepository } from 'src/MailingRepository';
import { Logger } from './Logger';


export class MailingExecutor extends EventEmitter {
  private executionStates: Map<number, MailingExecutionState> = new Map();

  constructor (
    private mailer: MailSender,
    private repository: MailingRepository,
    private logger: Logger
  ) {
    super();
  }

  async pauseExecution (mailing: Mailing): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (mailing.state !== MailingState.RUNNING || !this.executionStates.has(mailing.id)) {
        this.logger.warn(`#${mailing.id}: call to MailingExecutor.pauseExecution while not running`);
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
    if (mailing.state === MailingState.RUNNING) return;

    this.logger.verbose(`#${mailing.id}: starting execution`);
    
    const unsentReceivers = await mailing.getUnsentReceivers();
    this.logger.debug(`#${mailing.id}: ${unsentReceivers.length} unsent receivers`);
    if (!unsentReceivers.length) {
      this.logger.warn(`#${mailing.id}: has no unsent receivers, but is not finished`);
      this.emit(MailingExecutorEvents.MAILING_FINISHED, mailing);
      return;
    }
    const emails = this.createEmails(mailing, unsentReceivers);

    this.executionStates.set(mailing.id, { stopping: false });
    this.emit(MailingExecutorEvents.MAILING_STARTED, mailing);
    // Это не ошибка - не ждём через await намеренно, пусть выполняется в фоне
    this.runMailing(mailing, emails).catch(error => {
      this.emit(MailingExecutorEvents.MAILING_ERROR, mailing, error);
    });
  }


  private createEmails (mailing: Mailing, receivers: Receiver[]) {
    return receivers.map(receiver => {
      return new Email({
        headers: mailing.headers,
        html: mailing.html,
        receivers: [receiver],
        subject: mailing.subject
      });
    });
  }

  private isStopping (mailing: Mailing): boolean {
    const state = this.executionStates.get(mailing.id);
    return Boolean(state && state.stopping);
  }

  private async runMailing (mailing: Mailing, emails: Email[]): Promise<void> {
    for (const email of emails) {
      if (this.isStopping(mailing)) {
        this.logger.debug(`#${mailing.id}: execution was stopped, exiting`);
        this.executionStates.delete(mailing.id);
        this.emit(MailingExecutorEvents.MAILING_PAUSED, mailing);
        return;
      }
      this.logger.debug(`#${mailing.id}: sending email to ${email.receivers.join(',')}...`);
      await this.mailer.sendEmail(email);
      this.logger.debug(`#${mailing.id}: sent, incrementing sentCount`);
      mailing.sentCount++;
      await this.repository.update(mailing);
    }

    this.logger.verbose(`#${mailing.id}: finished`);
    this.executionStates.delete(mailing.id);
    this.emit(MailingExecutorEvents.MAILING_FINISHED, mailing);
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
