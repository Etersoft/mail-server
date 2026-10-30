import { MailingExecutor, MailingExecutorEvents } from './MailingExecutor';
import { Mailing } from './Mailing';
import { MailingState } from './MailingState';
import { Logger } from './Logger';
import { MailingRepository } from './MailingRepository';
import { sleep } from './utils/sleep';


/**
 * Класс, управляющий состоянием рассылок. Отвечает за их запуск и остановку,
 * за изменение состояния в случае ошибок выполнения. Для выполнения вызывает
 * MailingExecutor
 */
export class MailingStateManager {
  static allowedExternalTransitions: any = {
    [MailingState.NEW]: [MailingState.RUNNING],
    [MailingState.ERROR]: [MailingState.RUNNING],
    [MailingState.PAUSED]: [MailingState.RUNNING],
    [MailingState.RUNNING]: [MailingState.PAUSED],
    [MailingState.FINISHED]: [MailingState.RUNNING]
  };

  private autoPauseIds: Map<number, number> = new Map();
  private maxEmailsWithoutPause: number;
  private pauseDuration: number;
  private sentWithoutPause: Map<number, number> = new Map();

  constructor (
    private executor: MailingExecutor,
    private logger: Logger,
    private mailingRepository: MailingRepository,
    config: any
  ) {
    this.initExecutorEvents();

    this.maxEmailsWithoutPause = config.server.maxEmailsWithoutPause;
    this.pauseDuration = config.server.pauseDuration;
  }

  async changeState (mailing: Mailing, to: MailingState): Promise<boolean> {
    const from = mailing.state;

    if (from === to) {
      return true;
    }

    if (!MailingStateManager.allowedExternalTransitions[from]) {
      return false;
    }

    if (MailingStateManager.allowedExternalTransitions[from].indexOf(to) === -1) {
      return false;
    }

    if (to === MailingState.RUNNING) {
      await this.executor.startExecution(mailing);
      this.logger.info(`#${mailing.id}: started`);
    } else if (to === MailingState.PAUSED) {
      await this.executor.pauseExecution(mailing);
      this.logger.info(`#${mailing.id}: paused`);
    }
    this.incrementAutoPauseId(mailing.id);
    this.sentWithoutPause.set(mailing.id, 0);
    // Ручной запуск или пауза отменяют продолжение после автопаузы
    if (mailing.autoResumeAt) {
      await this.mailingRepository.updateInTransaction(mailing.id, mailingToUpdate => {
        mailingToUpdate.autoResumeAt = undefined;
      });
    }
    return true;
  }

  /**
   * Инициализация после запуска сервера: рассылки, которые выполнялись
   * (остались RUNNING), продолжаются с того же получателя, а рассылкам на
   * автоматической паузе назначается продолжение в сохранённое время.
   */
  async initialize () {
    const allMailings = await this.mailingRepository.getAll();
    for (const mailing of allMailings) {
      if (mailing.state === MailingState.RUNNING) {
        // startExecution не запускает рассылку, уже помеченную RUNNING
        const paused = await this.mailingRepository.updateInTransaction(
          mailing.id, mailingToUpdate => {
            mailingToUpdate.state = MailingState.PAUSED;
          }
        );
        if (paused) {
          this.logger.info(`#${mailing.id}: was running before restart, resuming`);
          await this.changeState(paused, MailingState.RUNNING);
        }
      } else if (mailing.state === MailingState.PAUSED && mailing.autoResumeAt) {
        const delay = Math.max(0, mailing.autoResumeAt - Date.now());
        this.logger.info(`#${mailing.id}: auto-paused before restart, resuming in ${
          Math.round(delay / 1000)} s`);
        void this.resumeAfter(mailing.id, delay, this.incrementAutoPauseId(mailing.id));
      }
    }
  }

  private async autoPause (mailing: Mailing) {
    this.logger.info(`#${mailing.id} has hit the limit and should be paused`);
    await this.changeState(mailing, MailingState.PAUSED);
    const thisPauseId = this.incrementAutoPauseId(mailing.id);
    this.sentWithoutPause.set(mailing.id, 0);
    await this.mailingRepository.updateInTransaction(mailing.id, mailingToUpdate => {
      mailingToUpdate.autoResumeAt = Date.now() + this.pauseDuration * 1000;
    });

    await this.resumeAfter(mailing.id, this.pauseDuration * 1000, thisPauseId);
  }

  private async resumeAfter (mailingId: number, delay: number, thisPauseId: number) {
    await sleep(delay);

    // Update mailing - it could have changed
    const updatedMailing = await this.mailingRepository.getById(mailingId);
    if (updatedMailing && updatedMailing.state === MailingState.PAUSED &&
        this.autoPauseIds.get(mailingId) === thisPauseId) {
      this.logger.info(`#${mailingId} has been auto-paused and now should be started again`);
      await this.changeState(updatedMailing, MailingState.RUNNING);
      this.autoPauseIds.delete(mailingId);
    } else {
      this.logger.info(`#${mailingId} has been auto-paused but its state has been changed`);
      this.logger.info('    by someone after that. It will not be automatically started.');
    }
  }

  private handleMailingError = async (mailingId: number, error: Error) => {
    this.logger.error(error);
    this.setState(mailingId, MailingState.ERROR);
  };

  private handleMailingFinish = async (mailingId: number) => {
    await this.setState(mailingId, MailingState.FINISHED);
    this.logger.info(`#${mailingId}: finished`);
  };

  private handleMailingPause = async (mailingId: number) => {
    this.setState(mailingId, MailingState.PAUSED);
  };

  private handleMailingStart = async (mailingId: number) => {
    this.setState(mailingId, MailingState.RUNNING);
  };

  private handleSentEmail = async (mailing: Mailing) => {
    if (!this.maxEmailsWithoutPause || !this.pauseDuration) {
      return;
    }

    if (!this.sentWithoutPause.has(mailing.id)) {
      this.sentWithoutPause.set(mailing.id, 1);
    } else {
      this.sentWithoutPause.set(mailing.id, this.sentWithoutPause.get(mailing.id)! + 1);
    }

    if (this.sentWithoutPause.get(mailing.id)! >= this.maxEmailsWithoutPause) {
      const updatedMailing = await this.mailingRepository.getById(mailing.id);
      await this.autoPause(updatedMailing!);
    }
  };

  private incrementAutoPauseId (mailingId: number) {
    const pauseId = (this.autoPauseIds.get(mailingId) || 0) + 1;
    this.autoPauseIds.set(mailingId, pauseId);
    return pauseId;
  }

  private initExecutorEvents () {
    this.executor.on(MailingExecutorEvents.MAILING_ERROR, this.handleMailingError);
    this.executor.on(MailingExecutorEvents.MAILING_FINISHED, this.handleMailingFinish);
    this.executor.on(MailingExecutorEvents.MAILING_PAUSED, this.handleMailingPause);
    this.executor.on(MailingExecutorEvents.MAILING_STARTED, this.handleMailingStart);
    this.executor.on(MailingExecutorEvents.EMAIL_SENT, this.handleSentEmail);
  }

  private async setState (mailingId: number, to: MailingState) {
    let fromString;
    const toString = MailingState[to];
    const mailing = await this.mailingRepository.updateInTransaction(
      mailingId, mailingToUpdate => {
        fromString = MailingState[mailingToUpdate.state];
        mailingToUpdate.state = to;
      }
    );
    if (mailing) {
      this.logger.debug(`#${mailing.id}: saved state to repository`);
      this.logger.verbose(`#${mailing.id}: changed state ${fromString} -> ${toString}`);
    } else {
      this.logger.warn(`#${mailingId}: attempt to change state of mailing that not exists`);
    }
  }
}
