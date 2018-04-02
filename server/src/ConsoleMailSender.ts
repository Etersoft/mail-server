// tslint:disable:no-console
import { Email } from './Email';
import { MailSender } from './MailSender';
import { sleep } from './utils/sleep';


/**
 * Заглушка - вместо отправки писем просто пишет их в консоль.
 */
export class ConsoleMailSender implements MailSender {
  async sendEmail (email: Email): Promise<void> {
    await sleep(500);
    console.log('---------');
    console.log('Email to:', email.receivers.map(r => r.getStringRepresentation()).join(', '));
    console.log('Subject:', email.subject);
    console.log('HTML:', email.html);
    let headers = '';
    for (const header in email.headers) {
      headers += `\n  ${header}: ${email.headers[header]}`;
    }
    console.log('Headers:', headers);
    console.log('---------');
  }
}
