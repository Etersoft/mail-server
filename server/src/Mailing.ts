import { Receiver } from './Receiver';
import { MailingRepository } from './MailingRepository';
import { AsyncTemplate } from './templates/AsyncTemplate';
import { HandlebarsAsyncTemplate } from './templates/HandlebarsAsyncTemplate';
import { MailingState } from './MailingState';


export interface MailingProperties {
  creationDate?: Date;
  extraData?: {
    textAfterSubscribe?: string,
    textAfterUnsubscribe?: string,  
    [field: string]: any 
  };
  from?: string;
  html: string;
  listId?: string;
  name: string;
  openForSubscription?: boolean;
  /**
   * Индекс в списке получателей, с которого продолжится отправка.
   * В отличие от sentCount учитывает и пропущенных получателей
   */
  position?: number;
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
  public _html: string;
  public extraData?: {
    textAfterSubscribe?: string,
    textAfterUnsubscribe?: string,  
    [field: string]: any 
  };
  public from?: string;
  public listId?: string;
  public name: string;
  public openForSubscription: boolean;
  public position: number;
  public replyTo?: string;
  public state: MailingState;
  public sentCount: number;
  public subject: string;
  public undeliveredCount: number;
  private _htmlTemplate?: AsyncTemplate<MailingTemplateContext>;
  private _subjectTemplate?: AsyncTemplate<MailingTemplateContext>;
  private savedCreationDate?: Date;

  constructor (
    public id: number,
    properties: MailingProperties,
    public repository: MailingRepository,
    private receivers?: Receiver[]
  ) {
    this.savedCreationDate = properties.creationDate;
    this.extraData = properties.extraData;
    this.from = properties.from;
    this.html = properties.html;
    this.listId = properties.listId;
    this.name = properties.name;
    this.openForSubscription = properties.openForSubscription || false;
    this.replyTo = properties.replyTo;
    this.state = properties.state || MailingState.NEW;
    this.sentCount = properties.sentCount || 0;
    // Рассылки, сохранённые до появления position, продолжаются с sentCount
    this.position = properties.position ?? this.sentCount;
    this.subject = properties.subject;
    this.undeliveredCount = properties.undeliveredCount || 0;
  }

  addReceiver (receiver: Receiver) {
    return this.repository.addReceiver(this.id, receiver);
  }

  /**
   * Хак: если дата не определена, то пытаемся вынуть её из названия
   */
  get creationDate (): Date | undefined {
    if (this.savedCreationDate) {
      return this.savedCreationDate;
    }

    // Дата в формате DD.MM.YYYY HH:mm:ss, местное время
    const match = /(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})/.exec(this.name);
    if (!match) {
      return undefined;
    }

    const [day, month, year, hours, minutes, seconds] = match.slice(1).map(Number);
    return new Date(year, month - 1, day, hours, minutes, seconds);
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
    const unsentReceivers = receivers.slice(this.position);
    return unsentReceivers;
  }

  getUnsentReceiversStream (batchSize: number = DEFAULT_STREAM_BATCH_SIZE) {
    return this.getReceiversStream(this.position, batchSize);
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
    },
    receiver);
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
