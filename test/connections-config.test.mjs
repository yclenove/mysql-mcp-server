import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const KEY = 'MYSQL_MCP_EXTRA_CONNECTIONS';

describe('parseExtraConnections', () => {
  let prev;

  beforeEach(() => {
    prev = process.env[KEY];
  });

  afterEach(() => {
    if (prev === undefined) {
      delete process.env[KEY];
    } else {
      process.env[KEY] = prev;
    }
  });

  it('未配置应返回空数组', async () => {
    delete process.env[KEY];
    const { parseExtraConnections } = await import('../dist/db/connection.js');
    assert.deepEqual(parseExtraConnections(undefined), []);
  });

  it('应解析 url 项', async () => {
    process.env[KEY] = JSON.stringify([
      { id: 'replica', url: 'mysql://u:p@127.0.0.1:3307/otherdb' },
    ]);
    const { parseExtraConnections } = await import('../dist/db/connection.js');
    const list = parseExtraConnections(process.env[KEY]);
    assert.equal(list.length, 1);
    assert.equal(list[0].id, 'replica');
    assert.equal(list[0].config.host, '127.0.0.1');
    assert.equal(list[0].config.database, 'otherdb');
  });

  it('非法 JSON 应抛错', async () => {
    process.env[KEY] = 'not-json';
    const { parseExtraConnections } = await import('../dist/db/connection.js');
    assert.throws(() => parseExtraConnections(process.env[KEY]), /JSON/);
  });

  it('id 为 default 应抛错', async () => {
    process.env[KEY] = JSON.stringify([{ id: 'default', host: 'h' }]);
    const { parseExtraConnections } = await import('../dist/db/connection.js');
    assert.throws(() => parseExtraConnections(process.env[KEY]), /default/);
  });

  it('重复 id 应抛错', async () => {
    process.env[KEY] = JSON.stringify([
      { id: 'a', host: '127.0.0.1' },
      { id: 'a', host: '127.0.0.1' },
    ]);
    const { parseExtraConnections } = await import('../dist/db/connection.js');
    assert.throws(() => parseExtraConnections(process.env[KEY]), /重复/);
  });
});
