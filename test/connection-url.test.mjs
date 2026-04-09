import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseMysqlConnectionUrl } from '../dist/db/connection.js';

describe('parseMysqlConnectionUrl', () => {
  it('应解析标准 mysql:// 连接串', () => {
    const r = parseMysqlConnectionUrl('mysql://u:p@db.example.com:3307/mydb');
    assert.deepEqual(r, {
      host: 'db.example.com',
      port: 3307,
      user: 'u',
      password: 'p',
      database: 'mydb',
    });
  });

  it('应支持 mysql2:// 协议', () => {
    const r = parseMysqlConnectionUrl('mysql2://root@127.0.0.1:3306/test');
    assert.equal(r?.user, 'root');
    assert.equal(r?.host, '127.0.0.1');
    assert.equal(r?.port, 3306);
    assert.equal(r?.database, 'test');
    assert.equal(r?.password ?? '', '');
  });

  it('缺省端口应为 3306 的解析结果中 port 字段', () => {
    const r = parseMysqlConnectionUrl('mysql://a:b@host.only/dbname');
    assert.equal(r?.port, undefined);
    assert.equal(r?.host, 'host.only');
  });

  it('应对 URL 编码的密码解码', () => {
    const r = parseMysqlConnectionUrl('mysql://u:p%40ss%3Aword@h:3306/d');
    assert.equal(r?.password, 'p@ss:word');
  });

  it('非法协议应返回 null', () => {
    assert.equal(parseMysqlConnectionUrl('postgres://u:p@h:5432/d'), null);
  });

  it('空串应返回 null', () => {
    assert.equal(parseMysqlConnectionUrl(''), null);
    assert.equal(parseMysqlConnectionUrl('   '), null);
  });
});
