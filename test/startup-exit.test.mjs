import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const entry = join(root, 'dist', 'index.js');

function runMain(extraEnv) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [entry], {
      env: {
        ...process.env,
        ...extraEnv,
      },
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    p.stderr?.on('data', (c) => {
      stderr += String(c);
    });
    p.on('close', (code) => resolve({ code, stderr }));
  });
}

describe('index 启动失败退出码', () => {
  it('默认库不在白名单时应 exit 1', async () => {
    const { code, stderr } = await runMain({
      MYSQL_DATABASE: 'wrongdb',
      MYSQL_DATABASE_ALLOWLIST: 'rightdb',
      MYSQL_HOST: '127.0.0.1',
    });
    assert.equal(code, 1);
    assert.ok(stderr.includes('ERROR') || stderr.includes('不在'));
  });

  it('MYSQL_MCP_EXTRA_CONNECTIONS 非法 JSON 应 exit 1', async () => {
    const { code } = await runMain({
      MYSQL_MCP_EXTRA_CONNECTIONS: 'not-json{',
      MYSQL_HOST: '127.0.0.1',
    });
    assert.equal(code, 1);
  });
});
