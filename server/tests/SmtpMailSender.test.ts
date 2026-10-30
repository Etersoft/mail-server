import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTransport } from 'nodemailer';
import { SmtpMailSender } from '../src/SmtpMailSender';
import { Email } from '../src/Email';
import { Receiver } from '../src/Receiver';


const serviceAddress = 'no-reply@etersoft.ru';

async function send (email: Email) {
  const sender = new SmtpMailSender({ from: serviceAddress, host: 'localhost', port: '25' });
  const transport = createTransport({ buffer: true, newline: 'unix', streamTransport: true }, {
    from: serviceAddress
  });
  let info: any;
  (sender as any).transport = {
    sendMail: async (message: any) => {
      info = await transport.sendMail(message);
      return info;
    }
  };
  await sender.sendEmail(email);
  return { envelope: info.envelope, message: info.message.toString() as string };
}

describe('SmtpMailSender', () => {
  it('should send from the service address by default', async () => {
    const { envelope, message } = await send(new Email({
      html: '<p>Hello</p>',
      receivers: [new Receiver('partner@example.com')],
      subject: 'Test'
    }));
    assert.equal(envelope.from, serviceAddress);
    assert.deepEqual(envelope.to, ['partner@example.com']);
    assert.match(message, /^From: no-reply@etersoft\.ru$/m);
    assert.doesNotMatch(message, /^Sender:/m);
  });

  it('should keep the service address in the envelope and Sender with a custom From', async () => {
    const { envelope, message } = await send(new Email({
      from: 'Sales <sales@etersoft.ru>',
      html: '<p>Hello</p>',
      receivers: [new Receiver('partner@example.com')],
      replyTo: 'sales@etersoft.ru',
      subject: 'Test'
    }));
    assert.equal(envelope.from, serviceAddress);
    assert.deepEqual(envelope.to, ['partner@example.com']);
    assert.match(message, /^From: Sales <sales@etersoft\.ru>$/m);
    assert.match(message, /^Sender: no-reply@etersoft\.ru$/m);
    assert.match(message, /^Reply-To: sales@etersoft\.ru$/m);
  });
});
