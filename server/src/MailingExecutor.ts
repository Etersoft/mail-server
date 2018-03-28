import { Mailing } from './Mailing';
import { MailSender } from './MailSender';


export class MailingExecutor {
  constructor (private mailer: MailSender) {}

  async pauseExecution (mailing: Mailing): Promise<void> {

  }

  async startExecution (mailing: Mailing): Promise<void> {

  }
}
