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
    } else if (to === MailingState.PAUSED) {
      await this.executor.pauseExecution(mailing);
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
      mailing.state = MailingState.PAUSED;
      await this.mailingRepository.update(mailing);
    }));
  }

  private handleMailingError = async (mailing: Mailing, error: Error) => {
    this.logger.error(error);
    this.setState(mailing, MailingState.ERROR);
  }

  private handleMailingFinish = async (mailing: Mailing) => {
    this.setState(mailing, MailingState.FINISHED);
  }

  private handleMailingPause = async (mailing: Mailing) => {
    this.setState(mailing, MailingState.PAUSED);
  }

  private handleMailingStart = async (mailing: Mailing) => {
    this.setState(mailing, MailingState.RUNNING);
  }

  private initExecutorEvents () {
    this.executor.on(MailingExecutorEvents.MAILING_ERROR, this.handleMailingError);
    this.executor.on(MailingExecutorEvents.MAILING_FINISHED, this.handleMailingFinish);
    this.executor.on(MailingExecutorEvents.MAILING_PAUSED, this.handleMailingPause);
    this.executor.on(MailingExecutorEvents.MAILING_STARTED, this.handleMailingStart);
  }

  private async setState (mailing: Mailing, to: MailingState) {
    const fromString = MailingState[mailing.state];
    const toString = MailingState[to];
    this.logger.verbose(`#${mailing.id}: changing state ${fromString} -> ${toString}`);
    mailing.state = to;
    await this.mailingRepository.update(mailing);
    this.logger.debug(`#${mailing.id}: saved state to repository`);
  }
}
