import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const AUDIT_PATH = join(process.cwd(), '_test_audit.log');

describe('auditLog', () => {
  before(() => {
    if (existsSync(AUDIT_PATH)) unlinkSync(AUDIT_PATH);
    process.env.MCP_AUDIT_LOG = AUDIT_PATH;
  });

  after(() => {
    if (existsSync(AUDIT_PATH)) unlinkSync(AUDIT_PATH);
    delete process.env.MCP_AUDIT_LOG;
  });

  it('应写入成功的审计记录', async () => {
    const { auditLog } = await import('../dist/audit.js');
    auditLog({ sql: 'SELECT 1', success: true, executionTime: 5 });
    assert.equal(existsSync(AUDIT_PATH), true);
    const lines = readFileSync(AUDIT_PATH, 'utf-8').trim().split('\n');
    const record = JSON.parse(lines[lines.length - 1]);
    assert.equal(record.sql, 'SELECT 1');
    assert.equal(record.success, true);
    assert.equal(record.executionTime, '5ms');
    assert.ok(record.timestamp);
  });

  it('失败记录应包含 error 字段', async () => {
    const { auditLog } = await import('../dist/audit.js');
    auditLog({ sql: 'BAD SQL', success: false, error: 'syntax error' });
    const lines = readFileSync(AUDIT_PATH, 'utf-8').trim().split('\n');
    const record = JSON.parse(lines[lines.length - 1]);
    assert.equal(record.success, false);
    assert.equal(record.error, 'syntax error');
  });

  it('params 为空数组时不应出现在记录中', async () => {
    const { auditLog } = await import('../dist/audit.js');
    auditLog({ sql: 'SELECT ?', params: [], success: true });
    const lines = readFileSync(AUDIT_PATH, 'utf-8').trim().split('\n');
    const record = JSON.parse(lines[lines.length - 1]);
    assert.equal(record.params, undefined);
  });

  it('params 有值时应记录', async () => {
    const { auditLog } = await import('../dist/audit.js');
    auditLog({ sql: 'SELECT ?', params: [42], success: true });
    const lines = readFileSync(AUDIT_PATH, 'utf-8').trim().split('\n');
    const record = JSON.parse(lines[lines.length - 1]);
    assert.deepEqual(record.params, [42]);
  });

  it('affectedRows 应记录', async () => {
    const { auditLog } = await import('../dist/audit.js');
    auditLog({ sql: 'INSERT INTO t VALUES(1)', success: true, affectedRows: 1 });
    const lines = readFileSync(AUDIT_PATH, 'utf-8').trim().split('\n');
    const record = JSON.parse(lines[lines.length - 1]);
    assert.equal(record.affectedRows, 1);
  });

  it('多条记录应各占一行', async () => {
    const { auditLog } = await import('../dist/audit.js');
    const linesBefore = readFileSync(AUDIT_PATH, 'utf-8').trim().split('\n').length;
    auditLog({ sql: 'Q1', success: true });
    auditLog({ sql: 'Q2', success: true });
    const linesAfter = readFileSync(AUDIT_PATH, 'utf-8').trim().split('\n').length;
    assert.equal(linesAfter - linesBefore, 2);
  });
});
