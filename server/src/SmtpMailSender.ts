import { MailSender } from './MailSender';
import { Email } from './Email';


export class SmtpMailSender implements MailSender {
  async sendEmail (email: Email): Promise<void> {

  }
}
