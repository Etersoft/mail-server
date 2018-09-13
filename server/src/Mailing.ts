import { Receiver } from './Receiver';
import { MailingRepository } from './MailingRepository';
import * as moment from 'moment';


export enum MailingState {
  NEW = 1,
  RUNNING = 2,
  PAUSED = 3,
  FINISHED = 4,
  ERROR = 5
}

export interface MailingProperties {
  creationDate?: moment.Moment;
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
  private savedCreationDate?: moment.Moment;

  constructor (
    public id: number,
    properties: MailingProperties,
    public repository: MailingRepository,
    private receivers?: Receiver[]
  ) {
    this.savedCreationDate = properties.creationDate;
    this.html = properties.html;
    this.listId = properties.listId;
    this.name = properties.name;
    this.replyTo = properties.replyTo;
    this.state = properties.state || MailingState.NEW;
    this.sentCount = properties.sentCount || 0;
    this.subject = properties.subject;
    this.undeliveredCount = properties.undeliveredCount || 0;
  }

  /**
   * Хак: если дата не определена, то пытаемся вынуть её из названия
   */
  get creationDate (): moment.Moment | undefined {
    if (this.savedCreationDate) {
      return this.savedCreationDate;
    }

    const matchIndex = this.name.search(/\d{2}\.\d{2}\.\d{4} \d{2}\:\d{2}\:\d{2}/g);
    if (matchIndex === -1) {
      return undefined;
    }

    return moment(this.name.slice(matchIndex), 'DD.MM.YYYY HH:mm:ss');
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
