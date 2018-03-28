import { Receiver } from './Receiver';
import { MailingRepository } from './MailingRepository';


export enum MailingState {
  NEW = 1,
  RUNNING = 2,
  PAUSED = 3,
  FINISHED = 4
}

export interface MailingProperties {
  name: string;
  state?: MailingState;
  sentCount?: number;
}

/**
 * Класс рассылки
 */
export class Mailing implements MailingProperties {
  public name: string;
  public state: MailingState;
  public sentCount: number;

  constructor (
    public id: number,
    properties: MailingProperties,
    public repository: MailingRepository,
    private receivers?: Receiver[]
  ) {
    this.name = properties.name;
    this.state = properties.state || MailingState.NEW;
    this.sentCount = properties.sentCount || 0;
  }

  async getReceivers (): Promise<ReadonlyArray<Receiver>> {
    if (this.receivers) {
      return this.receivers;
    } else {
      return this.repository.getReceivers(this.id);
    }
  }
}
