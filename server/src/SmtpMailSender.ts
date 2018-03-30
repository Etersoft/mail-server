import { MailSender } from './MailSender';
import { Email } from './Email';
import { createTransport, Transporter } from 'nodemailer';


export class SmtpMailSender implements MailSender {
  private transport: Transporter;

  constructor (private config: any) {
    this.transport = createTransport({
      pool: true,
      port: config.port
    });
  }

  async sendEmail (email: Email): Promise<void> {
    await this.transport.sendMail({
      html: email.html,
      from: this.config.from,
      subject: email.subject,
      to: email.receivers.map(receiver => receiver.email).join(', ')
    });
  }
}
