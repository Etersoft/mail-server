import { MailingExecutor, MailingExecutorEvents } from './MailingExecutor';
import { Mailing, MailingState } from './Mailing';
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
    [MailingState.FINISHED]: []
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
    return true;
  }

  /**
   * Инициализация - находит все рассылки, помеченные как RUNNING,
   * и помечает их как PAUSED, на случай, если сервер перед остановкой
   * не смог корректно остановить рассылку.
   */
  async initialize () {
    const allMailings = await this.mailingRepository.getAll();
    const running = allMailings.filter(mailing => mailing.state === MailingState.RUNNING);
    await Promise.all(running.map(async mailing => {
      await this.mailingRepository.updateInTransaction(mailing.id, mailingToUpdate => {
        mailingToUpdate.state = MailingState.PAUSED;
      });
    }));
  }

  private async autoPause (mailing: Mailing) {
    this.logger.info(`#${mailing.id} has hit the limit and should be paused`);
    await this.changeState(mailing, MailingState.PAUSED);
    const thisPauseId = this.incrementAutoPauseId(mailing.id);
    this.sentWithoutPause.set(mailing.id, 0);

    await sleep(this.pauseDuration * 1000);

    // Update mailing - it could have changed
    const updatedMailing = await this.mailingRepository.getById(mailing.id);
    if (updatedMailing && updatedMailing.state === MailingState.PAUSED &&
        this.autoPauseIds.get(mailing.id) === thisPauseId) {
      this.logger.info(`#${mailing.id} has been auto-paused and now should be started again`);
      await this.changeState(updatedMailing, MailingState.RUNNING);
      this.autoPauseIds.delete(mailing.id);
    } else {
      this.logger.info(`#${mailing.id} has been auto-paused but its state has been changed`);
      this.logger.info(`    by someone after that. It will not be automatically started.`);
    }
  }

  private handleMailingError = async (mailingId: number, error: Error) => {
    this.logger.error(error);
    this.setState(mailingId, MailingState.ERROR);
  }

  private handleMailingFinish = async (mailingId: number) => {
    await this.setState(mailingId, MailingState.FINISHED);
    this.logger.info(`#${mailingId}: finished`);
  }

  private handleMailingPause = async (mailingId: number) => {
    this.setState(mailingId, MailingState.PAUSED);
  }

  private handleMailingStart = async (mailingId: number) => {
    this.setState(mailingId, MailingState.RUNNING);
  }

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
  }

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
