import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const KEYS = [
  'MYSQL_DATABASE_ALLOWLIST',
  'MYSQL_MCP_VALIDATE_EXTRA_CONNECTIONS',
  'MYSQL_MCP_EXTRA_CONNECTIONS',
];

function snap() {
  const o = {};
  for (const k of KEYS) {
    o[k] = process.env[k];
  }
  return o;
}

function restore(s) {
  for (const k of KEYS) {
    if (s[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = s[k];
    }
  }
}

describe('validateExtraConnectionsAgainstAllowlist', () => {
  let prev;

  beforeEach(() => {
    prev = snap();
  });

  afterEach(() => {
    restore(prev);
  });

  it('未开启校验应跳过', async () => {
    delete process.env.MYSQL_MCP_VALIDATE_EXTRA_CONNECTIONS;
    process.env.MYSQL_DATABASE_ALLOWLIST = 'a';
    const { validateExtraConnectionsAgainstAllowlist } = await import('../dist/db/allowlist.js');
    assert.doesNotThrow(() =>
      validateExtraConnectionsAgainstAllowlist([{ id: 'x', config: { database: 'bad' } }])
    );
  });

  it('开启校验且库不在白名单应抛错', async () => {
    process.env.MYSQL_MCP_VALIDATE_EXTRA_CONNECTIONS = 'true';
    process.env.MYSQL_DATABASE_ALLOWLIST = 'only';
    const { validateExtraConnectionsAgainstAllowlist } = await import('../dist/db/allowlist.js');
    assert.throws(
      () =>
        validateExtraConnectionsAgainstAllowlist([
          {
            id: 'rep',
            config: { host: 'h', port: 3306, user: 'u', password: '', database: 'other' },
          },
        ]),
      /额外连接/
    );
  });
});
