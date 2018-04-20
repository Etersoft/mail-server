import { MailSender } from './MailSender';
import { Email } from './Email';
import { createTransport, Transporter } from 'nodemailer';


export interface SmtpMailSenderConfig {
  from: string;
  host: string;
  port: string;
}

export class SmtpMailSender implements MailSender {
  private transport: Transporter;

  constructor (private config: SmtpMailSenderConfig) {
    this.transport = createTransport({
      host: config.host,
      pool: true,
      port: config.port
    } as any, {
      from: this.config.from
    });
  }

  async sendEmail (email: Email): Promise<void> {
    await this.transport.sendMail({
      attachments: email.attachments,
      headers: email.headers,
      html: email.html,
      replyTo: email.replyTo,
      subject: email.subject,
      to: email.receivers.map(receiver => receiver.email).join(', ')
    });
  }
}
