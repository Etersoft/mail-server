import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { substituteEnv } from '../src/readConfig';


describe('substituteEnv', () => {
  it('should replace %{NAME} with environment variables', () => {
    const config = {
      port: 587,
      smtp: { auth: { pass: '%{SMTP_PASSWORD}', user: 'noreply' } },
      tags: ['a-%{TAG}-b']
    };
    assert.deepEqual(substituteEnv(config, { SMTP_PASSWORD: 'secret', TAG: 'x' }), {
      port: 587,
      smtp: { auth: { pass: 'secret', user: 'noreply' } },
      tags: ['a-x-b']
    });
  });

  it('should keep strings without variables', () => {
    assert.equal(substituteEnv('100%', {}), '100%');
  });

  it('should fail on a missing variable', () => {
    assert.throws(() => substituteEnv({ pass: '%{SMTP_PASSWORD}' }, {}), /SMTP_PASSWORD/);
  });
});
