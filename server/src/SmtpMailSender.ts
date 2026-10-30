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
    const to = email.receivers.map(receiver => receiver.email);
    await this.transport.sendMail({
      attachments: email.attachments,
      // Возвраты всегда идут на адрес сервиса (его разбирает mail-sorter),
      // даже если у рассылки свой From
      envelope: {
        from: this.config.from,
        to
      },
      from: email.from || this.config.from,
      headers: email.headers,
      html: email.html,
      replyTo: email.replyTo,
      sender: email.from ? this.config.from : undefined,
      subject: email.subject,
      text: email.html ? undefined : email.text,
      to: to.join(', ')
    });
  }
}
