import { Receiver } from './Receiver';
import { MailingRepository } from './MailingRepository';


export enum MailingState {
  NEW = 1,
  RUNNING = 2,
  PAUSED = 3,
  FINISHED = 4,
  ERROR = 5
}

export interface MailingProperties {
  html: string;
  listId?: string;
  name: string;
  replyTo?: string;
  state?: MailingState;
  sentCount?: number;
  subject: string;
  undeliveredCount: number;
}

/**
 * Класс рассылки
 */
export class Mailing implements MailingProperties {
  public html: string;
  public listId?: string;
  public name: string;
  public replyTo?: string;
  public state: MailingState;
  public sentCount: number;
  public subject: string;
  public undeliveredCount: number;

  constructor (
    public id: number,
    properties: MailingProperties,
    public repository: MailingRepository,
    private receivers?: Receiver[]
  ) {
    this.html = properties.html;
    this.listId = properties.listId;
    this.name = properties.name;
    this.replyTo = properties.replyTo;
    this.state = properties.state || MailingState.NEW;
    this.sentCount = properties.sentCount || 0;
    this.subject = properties.subject;
    this.undeliveredCount = properties.undeliveredCount || 0;
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
