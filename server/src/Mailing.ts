import { Receiver } from './Receiver';
import { MailingRepository } from './MailingRepository';
import * as moment from 'moment';
import { AsyncTemplate } from './templates/AsyncTemplate';
import { HandlebarsAsyncTemplate } from './templates/HandlebarsAsyncTemplate';
import { MailingState } from './MailingState';


export interface MailingProperties {
  creationDate?: moment.Moment;
  extraData?: { [field: string]: any };
  html: string;
  listId?: string;
  name: string;
  openForSubscription?: boolean;
  replyTo?: string;
  state?: MailingState;
  sentCount?: number;
  subject: string;
  undeliveredCount: number;
}

export interface MailingTemplateContext {
  mailing: Mailing;
  receiver: Receiver;
}

const DEFAULT_STREAM_BATCH_SIZE = 100;

/**
 * Класс рассылки
 */
export class Mailing implements MailingProperties {
  // tslint:disable-next-line
  public _html: string;
  public extraData?: { [field: string]: any };
  public listId?: string;
  public name: string;
  public openForSubscription: boolean;
  public replyTo?: string;
  public state: MailingState;
  public sentCount: number;
  public subject: string;
  public undeliveredCount: number;
  // tslint:disable-next-line
  private _htmlTemplate?: AsyncTemplate<MailingTemplateContext>;
  // tslint:disable-next-line
  private _subjectTemplate?: AsyncTemplate<MailingTemplateContext>;
  private savedCreationDate?: moment.Moment;

  constructor (
    public id: number,
    properties: MailingProperties,
    public repository: MailingRepository,
    private receivers?: Receiver[]
  ) {
    this.savedCreationDate = properties.creationDate;
    this.extraData = properties.extraData;
    this.html = properties.html;
    this.listId = properties.listId;
    this.name = properties.name;
    this.openForSubscription = properties.openForSubscription || false;
    this.replyTo = properties.replyTo;
    this.state = properties.state || MailingState.NEW;
    this.sentCount = properties.sentCount || 0;
    this.subject = properties.subject;
    this.undeliveredCount = properties.undeliveredCount || 0;
  }

  addReceiver (receiver: Receiver) {
    return this.repository.addReceiver(this.id, receiver);
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

  getHtmlForReceiver (receiver: Receiver): Promise<string> {
    return this.renderTemplate(this.htmlTemplate, receiver);
  }

  async getReceiverByEmail (email: string): Promise<Receiver | null> {
    for await (const receiver of this.getReceiversStream()) {
      if (receiver.email === email) {
        return receiver;
      }
    }
    return null;
  }

  async getReceivers (): Promise<ReadonlyArray<Receiver>> {
    if (this.receivers) {
      return this.receivers;
    } else {
      return this.repository.getReceivers(this.id);
    }
  }

  async *getReceiversStream (start: number = 0, batchSize: number = DEFAULT_STREAM_BATCH_SIZE) {
    let batchId = 0;
    let result: Receiver[];
    do {
      result = await this.repository.getReceivers(
        this.id, start + batchId * batchSize, start + (batchId + 1) * batchSize
      );
      for (const receiver of result) {
        yield receiver;
      }
      batchId++;
    } while (result.length === batchSize);
  }

  getSubjectForReceiver (receiver: Receiver): Promise<string> {
    return this.renderTemplate(this.subjectTemplate, receiver);
  }

  async getUnsentReceivers () {
    const receivers = await this.getReceivers();
    const unsentReceivers = receivers.slice(this.sentCount);
    return unsentReceivers;
  }

  getUnsentReceiversStream (batchSize: number = DEFAULT_STREAM_BATCH_SIZE) {
    return this.getReceiversStream(this.sentCount, batchSize);
  }

  async hasReceiver (email: string) {
    for await (const receiver of this.getReceiversStream()) {
      if (receiver.email === email) {
        return true;
      }
    }
    return false;
  }

  hasValidExecutionState (): boolean {
    return this.state === MailingState.NEW || this.state === MailingState.PAUSED;
  }

  get html () {
    return this._html;
  }

  set html (value: string) {
    this._htmlTemplate = undefined;
    this._html = value;
  }

  removeReceiver (receiver: Receiver) {
    return this.repository.removeReceiver(this.id, receiver);
  }

  private renderTemplate (template: AsyncTemplate<MailingTemplateContext>, receiver: Receiver) {
    return template.render({
      mailing: this,
      receiver
    });
  }

  private get htmlTemplate () {
    if (!this._htmlTemplate) {
      this._htmlTemplate = new HandlebarsAsyncTemplate(this.html);
    }
    return this._htmlTemplate;
  }

  private get subjectTemplate () {
    if (!this._subjectTemplate) {
      this._subjectTemplate = new HandlebarsAsyncTemplate(this.subject);
    }
    return this._subjectTemplate;
  }
}
