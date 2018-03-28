import { Receiver } from './Receiver';


export interface EmailParameters {
  headers?: Map<string, string>;
  html?: string;
  receivers: Receiver[];
  text?: string;
}


export class Email {
  public headers: Map<string, string>;
  public html?: string;
  public receivers: Receiver[];
  public text?: string;

  constructor (parameters: EmailParameters) {
    this.headers = parameters.headers || defaultHeaders;
    this.html = parameters.html;
    this.receivers = parameters.receivers;
    this.text = parameters.text;
  }
}


const defaultHeaders = new Map<string, string>();
