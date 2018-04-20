import { Receiver } from './Receiver';
import { Headers } from './Mailing';


export interface EmailParameters {
  attachments?: Attachment[];
  headers?: Headers;
  html?: string;
  receivers: Receiver[];
  replyTo?: string;
  text?: string;
  subject: string;
}

export interface Attachment {
  content: string | Buffer;
  filename: string;
}


export class Email {
  public attachments?: Attachment[];
  public headers: Headers;
  public html?: string;
  public receivers: Receiver[];
  public replyTo?: string;
  public text?: string;
  public subject: string;

  constructor (parameters: EmailParameters) {
    this.attachments = parameters.attachments;
    this.headers = parameters.headers || defaultHeaders;
    this.html = parameters.html;
    this.receivers = parameters.receivers;
    this.replyTo = parameters.replyTo;
    this.text = parameters.text;
    this.subject = parameters.subject;
  }
}


const defaultHeaders = {};
