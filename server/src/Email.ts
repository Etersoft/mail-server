import { Receiver } from './Receiver';


export interface Headers {
  [name: string]: string;
}

export interface EmailParameters {
  attachments?: Attachment[];
  from?: string;
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
  public from?: string;
  public headers: Headers;
  public html?: string;
  public receivers: Receiver[];
  public replyTo?: string;
  public text?: string;
  public subject: string;

  constructor (parameters: EmailParameters) {
    this.attachments = parameters.attachments;
    this.from = parameters.from;
    this.headers = parameters.headers || defaultHeaders;
    this.html = parameters.html;
    this.receivers = parameters.receivers;
    this.replyTo = parameters.replyTo;
    this.text = parameters.text;
    this.subject = parameters.subject;
  }
}


const defaultHeaders = {};
