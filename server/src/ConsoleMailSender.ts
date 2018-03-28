// tslint:disable:no-console
import { Email } from './Email';
import { MailSender } from './MailSender';


/**
 * Заглушка - вместо отправки писем просто пишет их в консоль.
 */
export class ConsoleMailSender implements MailSender {
  sendEmail (email: Email): Promise<void> {
    console.log('Email to:', email.receivers.map(r => r.getStringRepresentation()).join(', '));
    console.log('Text:', email.text);
    console.log('HTML:', email.html);
    let headers = '';
    for (const header of email.headers.entries()) {
      headers += `\n  ${header[0]}: ${header[1]}`;
    }
    console.log('Headers:', headers);

    return Promise.resolve();
  }
}
