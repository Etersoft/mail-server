const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { createTransport } = require('nodemailer');


const MAIL_SERVER_URL = process.env.MAIL_SERVER_URL || 'http://127.0.0.1:8000';
const FACADE_URL = process.env.FACADE_URL || 'http://127.0.0.1:8001';
const CLIENT_URL = process.env.CLIENT_URL || 'http://127.0.0.1';
const MAIL_HOST = process.env.MAIL_HOST || '127.0.0.1';

const MAILING_NAME = 'E2E рассылка';

// Вызов API mail-server; возвращает поле data ответа
async function api (path, method = 'GET', body) {
  const response = await fetch(MAIL_SERVER_URL + path, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method
  });
  const json = await response.json();
  if (!response.ok || !json.success) {
    throw new Error(`${method} ${path}: ${response.status} ${JSON.stringify(json)}`);
  }
  return json.data;
}

async function findMailing (name = MAILING_NAME) {
  const list = await api('/mailings');
  const found = list.filter(m => m.name === name);
  return found[found.length - 1];
}

// Письма ящика user (GreenMail создаёт пользователя при первом входе)
async function readMailbox (user) {
  const client = new ImapFlow({
    auth: { pass: 'x', user }, host: MAIL_HOST, logger: false, port: 3143, secure: false
  });
  await client.connect();
  try {
    await client.mailboxOpen('INBOX');
    const result = [];
    const fetched = await client.fetchAll('1:*', { flags: true, source: true, uid: true });
    for (const item of fetched) {
      const parsed = await simpleParser(item.source);
      result.push({ flags: item.flags, parsed, source: item.source.toString() });
    }
    return result;
  } catch (error) {
    // пустой ящик: fetch диапазона 1:* завершается ошибкой
    if (/Invalid messageset|empty/i.test(error.message)) {
      return [];
    }
    throw error;
  } finally {
    await client.logout();
  }
}

function sendRaw (to, raw) {
  const transport = createTransport({ host: MAIL_HOST, port: 3025, secure: false });
  return transport.sendMail({ envelope: { from: 'mailer-daemon@example.net', to }, raw });
}

async function waitFor (check, { timeout = 30000, interval = 500, what = 'condition' } = {}) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const result = await check();
    if (result) {
      return result;
    }
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for ' + what);
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

module.exports = {
  api, CLIENT_URL, FACADE_URL, findMailing, MAILING_NAME, readMailbox, sendRaw, waitFor
};
