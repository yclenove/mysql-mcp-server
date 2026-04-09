import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  isReadOnlyQuery,
  validateIdentifier,
  escapeIdentifier,
  executeQuery,
} from '../dist/db/executor.js';
import { ExecutionMode } from '../dist/types/index.js';
import { closePool } from '../dist/db/connection.js';

after(async () => {
  await closePool();
});

describe('isReadOnlyQuery', () => {
  const readOnlyStatements = [
    'SELECT * FROM users',
    'select 1',
    'SHOW TABLES',
    'show databases',
    'DESCRIBE users',
    'desc users',
    'EXPLAIN SELECT 1',
    '  SELECT * FROM users',
  ];

  for (const sql of readOnlyStatements) {
    it(`应识别 "${sql}" 为只读`, () => {
      assert.equal(isReadOnlyQuery(sql), true);
    });
  }

  const writeStatements = [
    'INSERT INTO users VALUES (1)',
    'UPDATE users SET name = "a"',
    'DELETE FROM users WHERE id = 1',
    'DROP TABLE users',
    'TRUNCATE TABLE users',
    'ALTER TABLE users ADD col INT',
    'CREATE TABLE t (id INT)',
  ];

  for (const sql of writeStatements) {
    it(`应识别 "${sql}" 为非只读`, () => {
      assert.equal(isReadOnlyQuery(sql), false);
    });
  }
});

describe('validateIdentifier', () => {
  it('合法标识符应返回 null', () => {
    assert.equal(validateIdentifier('users'), null);
    assert.equal(validateIdentifier('table_1'), null);
    assert.equal(validateIdentifier('A_B_C123'), null);
  });

  it('空字符串应报错', () => {
    assert.notEqual(validateIdentifier(''), null);
  });

  it('含特殊字符应报错', () => {
    assert.notEqual(validateIdentifier('users;--'), null);
    assert.notEqual(validateIdentifier('table name'), null);
    assert.notEqual(validateIdentifier('user`s'), null);
  });

  it('自定义 fieldName 应出现在错误消息中', () => {
    const err = validateIdentifier('', '表名');
    assert.ok(err?.includes('表名'));
  });
});

describe('escapeIdentifier', () => {
  it('应用反引号包裹', () => {
    assert.equal(escapeIdentifier('users'), '`users`');
  });

  it('应转义内部反引号', () => {
    assert.equal(escapeIdentifier('user`name'), '`user``name`');
  });
});

describe('checkDangerousOperation (通过 executeQuery 间接测试)', () => {
  it('DELETE 无 WHERE 应被拦截', async () => {
    const r = await executeQuery('DELETE FROM users');
    assert.equal(r.success, false);
    assert.ok(r.error?.includes('WHERE'));
  });

  it('UPDATE 无 WHERE 应被拦截', async () => {
    const r = await executeQuery('UPDATE users SET a = 1');
    assert.equal(r.success, false);
    assert.ok(r.error?.includes('WHERE'));
  });

  it('TRUNCATE 应被拦截', async () => {
    const r = await executeQuery('TRUNCATE TABLE users');
    assert.equal(r.success, false);
    assert.ok(r.error?.includes('TRUNCATE'));
  });

  it('DROP 应被拦截', async () => {
    const r = await executeQuery('DROP TABLE users');
    assert.equal(r.success, false);
    assert.ok(r.error?.includes('DROP'));
  });

  it('ALTER 应被拦截', async () => {
    const r = await executeQuery('ALTER TABLE users ADD col INT');
    assert.equal(r.success, false);
    assert.ok(r.error?.includes('ALTER'));
  });

  it('注释中的 WHERE 不应绕过检查', async () => {
    const r = await executeQuery('DELETE FROM users -- WHERE id = 1');
    assert.equal(r.success, false);
    assert.ok(r.error?.includes('WHERE'));
  });

  it('带 WHERE 的 DELETE 不应被拦截（仅安全检查阶段）', async () => {
    const r = await executeQuery('DELETE FROM __nonexist__ WHERE id = 1');
    assert.equal(r.success, false);
    assert.ok(!r.error?.includes('WHERE'));
  });
});

describe('只读模式拦截', () => {
  it('READONLY 模式下 INSERT 应被拒绝', async () => {
    const r = await executeQuery('INSERT INTO t VALUES(1)', [], ExecutionMode.READONLY);
    assert.equal(r.success, false);
    assert.ok(r.error?.includes('只读'));
  });

  it('READONLY 模式下 SELECT 安全检查应通过', async () => {
    const r = await executeQuery('SELECT 1', [], ExecutionMode.READONLY);
    // 没有数据库连接会报连接错误，但不应报只读错误
    if (!r.success) {
      assert.ok(!r.error?.includes('只读'));
    }
  });
});
