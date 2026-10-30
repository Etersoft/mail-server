import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getSorterStatus } from '../src/controllers/getSorterStatus';


function callHandler (status: any, config: any = { server: {} }) {
  const repository: any = { get: async () => status };
  const handler = getSorterStatus(repository, config);
  return new Promise<any>((resolve, reject) => {
    const res: any = { json: resolve };
    Promise.resolve(handler({} as any, res, reject)).catch(reject);
  });
}

describe('getSorterStatus', () => {
  it('should return null when mail-sorter has not run yet', async () => {
    assert.deepEqual(await callHandler(null), { data: null, success: true });
  });

  it('should mark status stale when the last success is too old', async () => {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const fresh = await callHandler({ lastSuccessAt: hourAgo, success: true });
    assert.equal(fresh.data.stale, false);

    const stale = await callHandler(
      { lastSuccessAt: hourAgo, success: true }, { server: { sorterStatusMaxAge: 1800 } }
    );
    assert.equal(stale.data.stale, true);

    const neverSucceeded = await callHandler({ lastSuccessAt: null, success: false });
    assert.equal(neverSucceeded.data.stale, true);
  });
});
