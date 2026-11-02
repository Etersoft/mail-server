import { MailSender } from './MailSender';
import { Email } from './Email';
import { createTransport, Transporter } from 'nodemailer';
import { convert } from 'html-to-text';


// Картинки пропускаем: в тексте от них остались бы только адреса или data: URI
const htmlToTextOptions = {
  selectors: [
    { options: { hideLinkHrefIfSameAsText: true }, selector: 'a' },
    { format: 'skip', selector: 'img' }
  ]
};


export interface SmtpMailSenderConfig {
  auth?: {
    pass: string;
    user: string;
  };
  from: string;
  host: string;
  /**
   * Имя в EHLO; по умолчанию — имя системы, если в нём есть точка, иначе
   * nodemailer подставляет [127.0.0.1]
   */
  name?: string;
  port: number | string;
  /**
   * true — TLS сразу (порт 465); false — STARTTLS, если сервер его предлагает
   */
  secure?: boolean;
}

export class SmtpMailSender implements MailSender {
  private transport: Transporter;

  constructor (private config: SmtpMailSenderConfig) {
    this.transport = createTransport({
      auth: config.auth,
      host: config.host,
      name: config.name,
      pool: true,
      port: Number(config.port),
      secure: config.secure
    }, {
      from: this.config.from
    });
  }

  async sendEmail (email: Email): Promise<void> {
    const to = email.receivers.map(receiver => receiver.email);
    // В заголовке «Кому» — с именем, nodemailer сам закодирует кириллицу
    const toHeader = email.receivers.map(receiver =>
      receiver.name ? { address: receiver.email, name: receiver.name } : receiver.email
    );
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
      text: email.text || (email.html ? convert(email.html, htmlToTextOptions) : undefined),
      to: toHeader
    });
  }
}
