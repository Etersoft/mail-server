import { Receiver } from './Receiver';
import { MailingRepository } from './MailingRepository';


export interface Headers {
  [name: string]: string;
}

export enum MailingState {
  NEW = 1,
  RUNNING = 2,
  PAUSED = 3,
  FINISHED = 4,
  ERROR = 5
}

export interface MailingProperties {
  headers: Headers;
  html: string;
  name: string;
  state?: MailingState;
  sentCount?: number;
  subject: string;
}

/**
 * Класс рассылки
 */
export class Mailing implements MailingProperties {
  public headers: Headers;
  public html: string;
  public name: string;
  public state: MailingState;
  public sentCount: number;
  public subject: string;

  constructor (
    public id: number,
    properties: MailingProperties,
    public repository: MailingRepository,
    private receivers?: Receiver[]
  ) {
    this.headers = properties.headers;
    this.html = properties.html;
    this.name = properties.name;
    this.state = properties.state || MailingState.NEW;
    this.sentCount = properties.sentCount || 0;
    this.subject = properties.subject;
  }

  async getReceivers (): Promise<ReadonlyArray<Receiver>> {
    if (this.receivers) {
      return this.receivers;
    } else {
      return this.repository.getReceivers(this.id);
    }
  }

  async getUnsentReceivers () {
    const receivers = await this.getReceivers();
    const unsentReceivers = receivers.slice(this.sentCount);
    return unsentReceivers;
  }

  hasValidExecutionState (): boolean {
    return this.state === MailingState.NEW || this.state === MailingState.PAUSED;
  }
}
