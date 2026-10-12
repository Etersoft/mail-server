// Этап 2: проверка результата работы mail-sorter (запускается после
// `docker compose run --rm mail-sorter`)
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { api, findMailing, readMailbox } = require('./lib');


describe('after mail-sorter', function () {
  it('counted the bounce in mailing statistics (Redis)', async function () {
    const mailing = await api(`/mailings/${(await findMailing()).id}`);
    assert.equal(mailing.undeliveredCount, 1);
  });

  it('removed bounced address from mailings through mail-server API', async function () {
    const mailing = await findMailing();
    const receivers = await api(`/mailings/${mailing.id}/receivers`);
    assert.deepEqual(receivers.list.map(r => r.email), ['alice@example.com']);
  });

  it('forwarded the human message', async function () {
    const messages = await readMailbox('admin@example.com');
    assert.equal(messages.length, 1);
    assert.equal(messages[0].parsed.subject, 'Fwd: Вопрос по рассылке');
    assert.equal(messages[0].parsed.replyTo.value[0].address, 'ivan@example.org');
  });

  it('marked processed messages as read', async function () {
    const messages = await readMailbox('noreply@example.com');
    assert.equal(messages.length, 2);
    for (const message of messages) {
      assert.ok(message.flags.has('\\Seen'), message.parsed.subject);
    }
  });
});
