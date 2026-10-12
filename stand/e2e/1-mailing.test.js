// Этап 1: рассылка, подписка через subscription-facade, подготовка писем
// для mail-sorter (DSN и письмо от человека в ящик noreply@example.com)
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const {
  api, CLIENT_URL, FACADE_URL, MAILING_NAME, readMailbox, sendRaw, waitFor
} = require('./lib');


const MailingState = { FINISHED: 4, RUNNING: 2 };

describe('stand', function () {
  let mailing;

  before(async function () {
    const created = await api('/mailings', 'POST', {
      html: '<p>Здравствуйте, {{receiver.name}}! Это проверочная рассылка.</p>',
      name: MAILING_NAME,
      receivers: [
        { email: 'alice@example.com', name: 'Alice' },
        { email: 'bob@example.com', name: 'Bob' }
      ],
      subject: 'Привет, {{receiver.name}}'
    });
    mailing = await api(`/mailings/${created.id}`);
  });

  it('web client is served and proxies API', async function () {
    const page = await (await fetch(CLIENT_URL + '/')).text();
    assert.match(page, /Сервис рассылок/);
    const list = await (await fetch(CLIENT_URL + '/api/mailings')).json();
    assert.equal(list.success, true);
  });

  it('sends mailing with personalized subject and List-Id', async function () {
    await api(`/mailings/${mailing.id}`, 'PUT', { state: MailingState.RUNNING });
    await waitFor(async () => {
      const current = await api(`/mailings/${mailing.id}`);
      return current.state === MailingState.FINISHED && current.sentCount === 2;
    }, { what: 'mailing to finish' });

    for (const [user, name] of [['alice@example.com', 'Alice'], ['bob@example.com', 'Bob']]) {
      const messages = await waitFor(async () => {
        const list = await readMailbox(user);
        return list.length ? list : null;
      }, { what: 'mail for ' + user });
      const { parsed } = messages[messages.length - 1];
      assert.equal(parsed.subject, `Привет, ${name}`);
      assert.match(parsed.html, new RegExp(`Здравствуйте, ${name}!`));
      assert.equal(parsed.headers.get('precedence'), 'bulk');
      assert.match(parsed.headerLines.find(h => h.key === 'list-id').line, /stand\.local/);
    }
  });

  it('subscribes and unsubscribes through subscription-facade', async function () {
    const email = 'carol@example.com';
    await api(`/mailings/${mailing.id}`, 'PUT', { openForSubscription: true });
    // без periodicDate/schedule API отвечает INVALID_SCHEDULE (так было и раньше)
    await api(`/mailings/${mailing.id}/requestSubscription`, 'POST', {
      email, name: 'Carol', schedule: '* * *'
    });

    const [confirmation] = await waitFor(async () => {
      const list = await readMailbox(email);
      return list.length ? list : null;
    }, { what: 'subscription confirmation' });
    const code = /code=([0-9a-f-]{36})/.exec(confirmation.parsed.html)[1];

    const wrong = await (await fetch(
      `${FACADE_URL}/subscribe?mailingId=${mailing.id}&email=${email}&code=wrong`
    )).text();
    assert.match(wrong, /Не удалось добавить адрес/);

    const subscribed = await (await fetch(
      `${FACADE_URL}/subscribe?mailingId=${mailing.id}&email=${email}&code=${code}`
    )).text();
    assert.match(subscribed, /Спасибо!/);
    let receivers = await api(`/mailings/${mailing.id}/receivers`);
    assert.ok(receivers.list.some(r => r.email === email));

    const unsubscribed = await (await fetch(
      `${FACADE_URL}/unsubscribe?mailingId=${mailing.id}&email=${email}&code=${code}`
    )).text();
    assert.match(unsubscribed, /исключён из рассылки/);
    receivers = await api(`/mailings/${mailing.id}/receivers`);
    assert.ok(!receivers.list.some(r => r.email === email));
  });

  it('delivers bounce and human reply to noreply mailbox', async function () {
    await sendRaw('noreply@example.com', buildDsn('bob@example.com', mailing.listId));
    await sendRaw('noreply@example.com', [
      'From: Ivan <ivan@example.org>',
      'To: noreply@example.com',
      'Subject: Вопрос по рассылке',
      'Date: ' + new Date().toUTCString(),
      'Message-ID: <human-1@example.org>',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'Здравствуйте! Как отписаться?',
      ''
    ].join('\r\n'));
    const messages = await waitFor(async () => {
      const list = await readMailbox('noreply@example.com');
      return list.length >= 2 ? list : null;
    }, { what: 'noreply mailbox' });
    assert.equal(messages.length, 2);
  });
});

// Уведомление о недоставке в формате Postfix (multipart/report, RFC 3464)
function buildDsn (recipient, listId) {
  const boundary = 'E2E.DSN.boundary/stand.local';
  return [
    'From: MAILER-DAEMON@example.net (Mail Delivery System)',
    'To: noreply@example.com',
    'Subject: Undelivered Mail Returned to Sender',
    'Date: ' + new Date().toUTCString(),
    'Message-ID: <dsn-1@example.net>',
    'Auto-Submitted: auto-replied',
    'MIME-Version: 1.0',
    `Content-Type: multipart/report; report-type=delivery-status; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Description: Notification',
    'Content-Type: text/plain; charset=us-ascii',
    '',
    'I\'m sorry to have to inform you that your message could not',
    'be delivered to one or more recipients.',
    '',
    `--${boundary}`,
    'Content-Description: Delivery report',
    'Content-Type: message/delivery-status',
    '',
    'Reporting-MTA: dns; mx.example.net',
    '',
    `Final-Recipient: rfc822; ${recipient}`,
    `Original-Recipient: rfc822;${recipient}`,
    'Action: failed',
    'Status: 5.1.1',
    'Diagnostic-Code: smtp; 550 5.1.1 User unknown',
    '',
    `--${boundary}`,
    'Content-Description: Undelivered Message',
    'Content-Type: message/rfc822',
    '',
    'From: noreply@example.com',
    `To: ${recipient}`,
    'Subject: =?UTF-8?B?0J/RgNC40LLQtdGCLCBCb2I=?=',
    `List-Id: ${listId}`,
    'Precedence: bulk',
    'Content-Type: text/plain; charset=utf-8',
    '',
    'Hello',
    '',
    `--${boundary}--`,
    ''
  ].join('\r\n');
}
