import { MailingExecutor, MailingExecutorEvents } from './MailingExecutor';
import { Mailing, MailingState } from './Mailing';
import { Logger } from './Logger';
import { MailingRepository } from './MailingRepository';


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

  constructor (
    private executor: MailingExecutor,
    private logger: Logger,
    private mailingRepository: MailingRepository
  ) {
    this.initExecutorEvents();
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

  private initExecutorEvents () {
    this.executor.on(MailingExecutorEvents.MAILING_ERROR, this.handleMailingError);
    this.executor.on(MailingExecutorEvents.MAILING_FINISHED, this.handleMailingFinish);
    this.executor.on(MailingExecutorEvents.MAILING_PAUSED, this.handleMailingPause);
    this.executor.on(MailingExecutorEvents.MAILING_STARTED, this.handleMailingStart);
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
