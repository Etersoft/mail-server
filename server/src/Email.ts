import { Receiver } from './Receiver';
import { Headers } from './Mailing';


export interface EmailParameters {
  headers?: Headers;
  html?: string;
  receivers: Receiver[];
  replyTo?: string;
  text?: string;
  subject: string;
}


export class Email {
  public headers: Headers;
  public html?: string;
  public receivers: Receiver[];
  public replyTo?: string;
  public text?: string;
  public subject: string;

  constructor (parameters: EmailParameters) {
    this.headers = parameters.headers || defaultHeaders;
    this.html = parameters.html;
    this.receivers = parameters.receivers;
    this.replyTo = parameters.replyTo;
    this.text = parameters.text;
    this.subject = parameters.subject;
  }
}


const defaultHeaders = {};
