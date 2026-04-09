import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const KEY = 'MCP_SCHEMA_OVERVIEW_MAX_TABLES';

describe('schema overview limit', () => {
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

  it('getSchemaOverviewMaxExpandTables：未配置默认 50', async () => {
    delete process.env[KEY];
    const { getSchemaOverviewMaxExpandTables } = await import('../dist/schemaOverviewLimit.js');
    assert.equal(getSchemaOverviewMaxExpandTables(), 50);
  });

  it('getSchemaOverviewMaxExpandTables：0 为仅表名模式', async () => {
    process.env[KEY] = '0';
    const { getSchemaOverviewMaxExpandTables } = await import('../dist/schemaOverviewLimit.js');
    assert.equal(getSchemaOverviewMaxExpandTables(), 0);
  });

  it('getSchemaOverviewMaxExpandTables：非法值回退 50', async () => {
    process.env[KEY] = 'x';
    const { getSchemaOverviewMaxExpandTables } = await import('../dist/schemaOverviewLimit.js');
    assert.equal(getSchemaOverviewMaxExpandTables(), 50);
  });

  it('splitTablesForSchemaOverview：maxExpand=0 全部进 namesOnly', async () => {
    const { splitTablesForSchemaOverview } = await import('../dist/schemaOverviewLimit.js');
    const names = ['a', 'b'];
    assert.deepEqual(splitTablesForSchemaOverview(names, 0), {
      expand: [],
      namesOnly: names,
    });
  });

  it('splitTablesForSchemaOverview：未超限全部展开', async () => {
    const { splitTablesForSchemaOverview } = await import('../dist/schemaOverviewLimit.js');
    const names = ['a', 'b'];
    assert.deepEqual(splitTablesForSchemaOverview(names, 10), {
      expand: names,
      namesOnly: [],
    });
  });

  it('splitTablesForSchemaOverview：超限拆分', async () => {
    const { splitTablesForSchemaOverview } = await import('../dist/schemaOverviewLimit.js');
    const names = ['t1', 't2', 't3'];
    assert.deepEqual(splitTablesForSchemaOverview(names, 2), {
      expand: ['t1', 't2'],
      namesOnly: ['t3'],
    });
  });

  it('formatTableNamesTail：不超长原样拼接', async () => {
    const { formatTableNamesTail } = await import('../dist/schemaOverviewLimit.js');
    assert.equal(formatTableNamesTail(['a', 'b'], 5), 'a, b');
  });

  it('formatTableNamesTail：超长截断', async () => {
    const { formatTableNamesTail } = await import('../dist/schemaOverviewLimit.js');
    const s = formatTableNamesTail(['a', 'b', 'c'], 2);
    assert.ok(s.startsWith('a, b'));
    assert.ok(s.includes('共 3 张'));
  });
});
