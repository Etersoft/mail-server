import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import { Server } from 'node:http';
import express, { Request, Response } from 'express';
import { createFakeLogger, getTestingRedisConnectionPool, redisSkip } from './testing-utils';
import { RedisConnectionPool } from '../src/RedisConnectionPool';
import { ApiKeyRepository, hashApiKey } from '../src/ApiKeyRepository';
import { apiKeyAuth, getActor } from '../src/middleware/apiKeyAuth';
import { bodyParser } from '../src/middleware/bodyParser';
import { Logger } from '../src/Logger';


describe('ApiKeyRepository', { skip: redisSkip }, () => {
  let pool: RedisConnectionPool;
  let repository: ApiKeyRepository;

  before(async () => {
    pool = await getTestingRedisConnectionPool();
    repository = new ApiKeyRepository(pool);
  });

  after(async () => {
    await pool.close();
  });

  beforeEach(async () => {
    await pool.runWithConnection(client => client.flushDb());
  });

  it('should store only the hash and find the key by its value', async () => {
    const key = await repository.add('site-test');
    assert.ok(key);
    assert.match(key, /^ep_[A-Za-z0-9_-]{43}$/);
    const stored = await pool.runWithConnection(client => client.hGetAll('API_KEYS'));
    assert.doesNotMatch(JSON.stringify(stored), new RegExp(key.slice(3)));
    assert.equal(JSON.parse(stored['site-test']).hash, hashApiKey(key));

    const record = await repository.findByKey(key);
    assert.equal(record?.name, 'site-test');
    assert.equal(record?.proxy, false);
    assert.equal(await repository.findByKey(key + 'x'), null);
  });

  it('should refuse a duplicate or invalid name', async () => {
    assert.ok(await repository.add('front', true));
    assert.equal(await repository.add('front'), null);
    await assert.rejects(repository.add('with space'), /Invalid key name/);
  });

  it('should list keys with the last use and revoke them', async () => {
    const key = await repository.add('front', true);
    await repository.add('another');
    await repository.touch('front', new Date('2026-11-02T10:00:00Z'));
    const list = await repository.list();
    assert.deepEqual(list.map(record => [record.name, record.proxy, record.lastUsedAt]), [
      ['another', false, undefined],
      ['front', true, '2026-11-02T10:00:00.000Z']
    ]);

    assert.equal(await repository.revoke('front'), true);
    assert.equal(await repository.revoke('front'), false);
    assert.equal(await repository.findByKey(key!), null);
    assert.deepEqual((await repository.list()).map(record => record.name), ['another']);
  });

  it('should not accept an old key after the name is reissued', async () => {
    const oldKey = await repository.add('site');
    await repository.revoke('site');
    const newKey = await repository.add('site');
    assert.equal(await repository.findByKey(oldKey!), null);
    assert.equal((await repository.findByKey(newKey!))?.name, 'site');
  });
});

describe('apiKeyAuth', { skip: redisSkip }, () => {
  let pool: RedisConnectionPool;
  let repository: ApiKeyRepository;
  let server: Server;
  let base: string;
  let logger: Logger;
  let siteKey: string;
  let frontKey: string;
  const config = { required: false };

  before(async () => {
    pool = await getTestingRedisConnectionPool();
    repository = new ApiKeyRepository(pool);
    siteKey = (await repository.add('site'))!;
    frontKey = (await repository.add('front', true))!;
    logger = createFakeLogger();

    const app = express();
    app.post('/{*path}', bodyParser());
    app.put('/{*path}', bodyParser());
    app.use(apiKeyAuth(repository, logger, config, req => req.path === '/openapi.json'));
    app.all('/{*path}', (req: Request, res: Response) => {
      res.json({ actor: getActor(res) });
    });
    server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server.close();
    await pool.close();
  });

  beforeEach(() => {
    config.required = false;
    for (const method of ['info', 'warn'] as const) {
      (logger[method] as any).mock.resetCalls();
    }
  });

  async function request (path: string, init: RequestInit = {}) {
    const response = await fetch(base + path, init);
    return { body: await response.json() as any, response };
  }

  it('should accept a key in Authorization or X-API-Key', async () => {
    const bearer = await request('/mailings', { headers: { Authorization: `Bearer ${siteKey}` } });
    assert.equal(bearer.response.status, 200);
    assert.deepEqual(bearer.body.actor, { key: 'site' });

    const header = await request('/mailings', { headers: { 'X-API-Key': siteKey } });
    assert.deepEqual(header.body.actor, { key: 'site' });
  });

  it('should reject an unknown key even when keys are not required', async () => {
    const { body, response } = await request('/mailings', {
      headers: { Authorization: 'Bearer ep_wrong' }
    });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('www-authenticate'), 'Bearer');
    assert.equal(body.code, 'INVALID_API_KEY');
  });

  it('should let requests without a key through and log them until keys are required', async () => {
    assert.equal((await request('/mailings/5')).response.status, 200);
    await request('/mailings/6');
    const warnings = (logger.warn as any).mock.calls.map((call: any) => call.arguments[0]);
    assert.equal(warnings.length, 1, 'repeated requests to the same route are logged once');
    assert.match(warnings[0], /^Request without API key: \S+ GET \/mailings\/:id$/);

    config.required = true;
    const { body, response } = await request('/mailings');
    assert.equal(response.status, 401);
    assert.equal(body.code, 'API_KEY_REQUIRED');
  });

  it('should keep public paths open', async () => {
    config.required = true;
    assert.equal((await request('/openapi.json')).response.status, 200);
  });

  it('should trust X-Remote-User only with a proxy key', async () => {
    const front = await request('/mailings', {
      headers: { Authorization: `Bearer ${frontKey}`, 'X-Remote-User': 'ivan' }
    });
    assert.deepEqual(front.body.actor, { key: 'front', user: 'ivan' });

    const site = await request('/mailings', {
      headers: { Authorization: `Bearer ${siteKey}`, 'X-Remote-User': 'ivan' }
    });
    assert.deepEqual(site.body.actor, { key: 'site' });
  });

  it('should log changing requests with the key, the user and the fields', async () => {
    await request('/mailings/5', {
      body: JSON.stringify({ html: '<p>secret</p>', receivers: [{}, {}], state: 'running' }),
      headers: { Authorization: `Bearer ${frontKey}`, 'X-Remote-User': 'ivan' },
      method: 'PUT'
    });
    const messages = (logger.info as any).mock.calls.map((call: any) => call.arguments[0]);
    assert.equal(messages.length, 1);
    assert.match(messages[0], /^PUT \/mailings\/5 by ivan via front from \S+: /);
    assert.match(messages[0], /: html, receivers\[2\], state=running$/);

    await request('/mailings', { headers: { Authorization: `Bearer ${siteKey}` } });
    assert.equal((logger.info as any).mock.calls.length, 1, 'GET is not logged');
  });

  it('should record the last use of a key', async () => {
    await request('/mailings', { headers: { Authorization: `Bearer ${siteKey}` } });
    await new Promise(resolve => setTimeout(resolve, 50));
    const site = (await repository.list()).find(record => record.name === 'site');
    assert.ok(site?.lastUsedAt);
  });
});
