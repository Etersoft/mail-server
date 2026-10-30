import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import { Server } from 'node:http';
import express from 'express';
import { setupRoutes } from '../src/routes';
import { openApiDocument } from '../src/openapi';


function createApp () {
  const app = express();
  const stub: any = {};
  setupRoutes(
    { server: { subscription: {} } }, app, stub, stub, stub, stub, stub, stub, stub, stub, stub
  );
  return app;
}

function getRoutes (app: express.Express) {
  const routes: string[] = [];
  for (const layer of (app as any).router.stack) {
    if (!layer.route) {
      continue;
    }
    const path = layer.route.path.replace(/:(\w+)/g, '{$1}');
    for (const method of Object.keys(layer.route.methods)) {
      routes.push(`${method} ${path}`);
    }
  }
  return routes;
}

describe('OpenAPI', () => {
  it('should describe every API route', () => {
    const documented = new Set<string>();
    for (const [path, item] of Object.entries(openApiDocument.paths)) {
      for (const method of Object.keys(item)) {
        documented.add(`${method} ${path}`);
      }
    }
    const apiRoutes = getRoutes(createApp())
      .filter(route => route.split(' ')[1].startsWith('/mailings'));
    assert.deepEqual(apiRoutes.filter(route => !documented.has(route)), []);
    assert.deepEqual([...documented].filter(route => !apiRoutes.includes(route)), []);
  });

  it('should resolve every $ref', () => {
    const json = JSON.stringify(openApiDocument);
    for (const [, name] of json.matchAll(/"#\/components\/schemas\/(\w+)"/g)) {
      assert.ok(name in openApiDocument.components.schemas, `missing schema ${name}`);
    }
  });

  describe('HTTP', () => {
    let server: Server;
    let base: string;

    before(async () => {
      server = createApp().listen(0);
      await new Promise(resolve => server.once('listening', resolve));
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    after(() => {
      server.close();
    });

    it('should serve the document', async () => {
      const response = await fetch(`${base}/openapi.json`);
      assert.equal(response.status, 200);
      assert.equal(((await response.json()) as any).openapi, '3.1.0');
    });

    it('should serve Swagger UI', async () => {
      const redirect = await fetch(`${base}/docs`, { redirect: 'manual' });
      assert.equal(redirect.status, 301);
      assert.equal(redirect.headers.get('location'), 'docs/');

      const page = await fetch(`${base}/docs/`);
      assert.match(await page.text(), /swagger-ui-bundle\.js/);

      for (const file of ['init.js', 'swagger-ui-bundle.js', 'swagger-ui.css']) {
        const response = await fetch(`${base}/docs/${file}`);
        assert.equal(response.status, 200, file);
        await response.arrayBuffer();
      }
    });
  });
});
