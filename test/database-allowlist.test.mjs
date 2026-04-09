import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const KEYS = [
  'MYSQL_DATABASE_ALLOWLIST',
  'MYSQL_DATABASE',
  'MYSQL_URL',
  'MYSQL_CONNECTION_STRING',
];

function snapshotEnv() {
  const snap = {};
  for (const k of KEYS) {
    snap[k] = process.env[k];
  }
  return snap;
}

function restoreEnv(snap) {
  for (const k of KEYS) {
    if (snap[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = snap[k];
    }
  }
}

describe('database allowlist', () => {
  let snap;

  beforeEach(() => {
    snap = snapshotEnv();
  });

  afterEach(() => {
    restoreEnv(snap);
  });

  it('getDatabaseAllowlist：未配置应返回 null', async () => {
    delete process.env.MYSQL_DATABASE_ALLOWLIST;
    const { getDatabaseAllowlist } = await import('../dist/db/allowlist.js');
    assert.equal(getDatabaseAllowlist(), null);
  });

  it('getDatabaseAllowlist：空字符串应返回 null', async () => {
    process.env.MYSQL_DATABASE_ALLOWLIST = '   ';
    const { getDatabaseAllowlist } = await import('../dist/db/allowlist.js');
    assert.equal(getDatabaseAllowlist(), null);
  });

  it('getDatabaseAllowlist：应解析逗号分隔并 trim', async () => {
    process.env.MYSQL_DATABASE_ALLOWLIST = ' a , b ';
    const { getDatabaseAllowlist } = await import('../dist/db/allowlist.js');
    const s = getDatabaseAllowlist();
    assert.ok(s);
    assert.equal(s.has('a'), true);
    assert.equal(s.has('b'), true);
  });

  it('getDatabaseAllowlist：非法库名应抛错', async () => {
    process.env.MYSQL_DATABASE_ALLOWLIST = 'ok,bad-name';
    const { getDatabaseAllowlist } = await import('../dist/db/allowlist.js');
    assert.throws(() => getDatabaseAllowlist(), /非法库名/);
  });

  it('isDatabaseOnAllowlist：无白名单时应放行', async () => {
    delete process.env.MYSQL_DATABASE_ALLOWLIST;
    const { isDatabaseOnAllowlist } = await import('../dist/db/allowlist.js');
    assert.equal(isDatabaseOnAllowlist('any_db'), true);
  });

  it('isDatabaseOnAllowlist：有白名单时仅允许列表内', async () => {
    process.env.MYSQL_DATABASE_ALLOWLIST = 'x,y';
    const { isDatabaseOnAllowlist } = await import('../dist/db/allowlist.js');
    assert.equal(isDatabaseOnAllowlist('x'), true);
    assert.equal(isDatabaseOnAllowlist('z'), false);
  });

  it('validateStartupDatabaseAgainstAllowlist：无白名单不校验', async () => {
    delete process.env.MYSQL_DATABASE_ALLOWLIST;
    process.env.MYSQL_DATABASE = 'not_in_any_list';
    const { validateStartupDatabaseAgainstAllowlist } = await import(
      '../dist/db/allowlist.js'
    );
    assert.doesNotThrow(() => validateStartupDatabaseAgainstAllowlist());
  });

  it('validateStartupDatabaseAgainstAllowlist：默认库不在白名单应抛错', async () => {
    process.env.MYSQL_DATABASE_ALLOWLIST = 'allowed_only';
    process.env.MYSQL_DATABASE = 'other';
    delete process.env.MYSQL_URL;
    delete process.env.MYSQL_CONNECTION_STRING;
    const { validateStartupDatabaseAgainstAllowlist } = await import(
      '../dist/db/allowlist.js'
    );
    assert.throws(() => validateStartupDatabaseAgainstAllowlist(), /不在 MYSQL_DATABASE_ALLOWLIST/);
  });

  it('validateStartupDatabaseAgainstAllowlist：连接串中的库名参与校验', async () => {
    process.env.MYSQL_DATABASE_ALLOWLIST = 'in_list';
    delete process.env.MYSQL_DATABASE;
    process.env.MYSQL_URL = 'mysql://u:p@h:3306/from_url';
    delete process.env.MYSQL_CONNECTION_STRING;
    const { validateStartupDatabaseAgainstAllowlist } = await import(
      '../dist/db/allowlist.js'
    );
    assert.throws(() => validateStartupDatabaseAgainstAllowlist(), /from_url/);
  });

  it('filterShowDatabasesRows：无白名单原样返回', async () => {
    delete process.env.MYSQL_DATABASE_ALLOWLIST;
    const { filterShowDatabasesRows } = await import('../dist/db/allowlist.js');
    const rows = [{ Database: 'a' }, { Database: 'b' }];
    assert.deepEqual(filterShowDatabasesRows(rows), rows);
  });

  it('filterShowDatabasesRows：有白名单只保留命中行', async () => {
    process.env.MYSQL_DATABASE_ALLOWLIST = 'keep';
    const { filterShowDatabasesRows } = await import('../dist/db/allowlist.js');
    const rows = [{ Database: 'keep' }, { Database: 'drop' }];
    assert.deepEqual(filterShowDatabasesRows(rows), [{ Database: 'keep' }]);
  });
});
