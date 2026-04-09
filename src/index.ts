#!/usr/bin/env node
/**
 * MySQL MCP Server 入口文件
 *
 * 环境变量配置（优先级从高到低）：
 * 1. 当前工作目录下已存在的 `.env` 文件中的键（dotenv `override: true`，覆盖进程继承的环境变量，避免系统里残留的 MYSQL_* 压过项目配置）
 * 2. 进程继承的环境变量（系统、终端、MCP 客户端 `env` 等；未被 `.env` 覆盖的键仍生效）
 * 3. MYSQL_URL / MYSQL_CONNECTION_STRING 等在连接层解析出的字段
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';
import { createServer } from './server.js';
import {
  testConnectionWithDetails,
  closePool,
  getConfigFromEnv,
  initConnectionPools,
  pingConnectionById,
  getExtraConnectionIds,
  parseExtraConnections,
} from './db/connection.js';
import {
  getDatabaseAllowlist,
  validateStartupDatabaseAgainstAllowlist,
  validateExtraConnectionsAgainstAllowlist,
} from './db/allowlist.js';

// 智能加载 .env 文件（按优先级）
function loadEnvFile(): string {
  const paths: string[] = [];

  // 1. 如果指定了 MYSQL_ENV_PATH，优先使用
  // if (process.env.MYSQL_ENV_PATH) {
  //   paths.push(resolve(process.env.MYSQL_ENV_PATH));
  // }

  // 2. 当前工作目录（Claude Code 的项目目录）
  paths.push(join(process.cwd(), '.env'));

  // 3. MCP server 所在目录
  // paths.push(join(__dirname, '../.env'));

  // 按优先级尝试加载
  for (const envPath of paths) {
    // 日志输出到 stderr，避免干扰 stdio 通信
    console.error(`[MySQL MCP] Loading .env from: ${envPath}`);
    if (existsSync(envPath)) {
      dotenvConfig({ path: envPath, override: true });
      return envPath;
    }
  }

  // 都没有找到，使用默认行为
  dotenvConfig();
  return 'default (not found)';
}

const loadedEnvPath = loadEnvFile();

// 日志输出到 stderr，避免干扰 stdio 通信
function log(message: string): void {
  console.error(`[MySQL MCP] ${message}`);
}

async function main() {
  log('Starting MySQL MCP Server...');
  log(`Loaded .env from: ${loadedEnvPath}`);
  log(`Working directory: ${process.cwd()}`);

  // 显示配置信息
  const config = getConfigFromEnv();
  log(
    `MySQL: ${config.host}:${config.port}/${config.database || '(no db)'} (readonly: ${process.env.MYSQL_READONLY === 'true'})`
  );

  try {
    getDatabaseAllowlist();
    validateStartupDatabaseAgainstAllowlist();
    const extras = parseExtraConnections(process.env.MYSQL_MCP_EXTRA_CONNECTIONS);
    validateExtraConnectionsAgainstAllowlist(extras);
  } catch (e) {
    log(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }

  try {
    initConnectionPools();
  } catch (e) {
    log(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }

  // 测试数据库连接
  const connectionResult = await testConnectionWithDetails();

  if (!connectionResult.success) {
    const code = connectionResult.code ? ` [${connectionResult.code}]` : '';
    log(
      `ERROR: Failed to connect to MySQL database${code}: ${connectionResult.error || 'unknown error'}`
    );
    process.exit(1);
  }

  log('Connected!');

  for (const id of getExtraConnectionIds()) {
    const ping = await pingConnectionById(id);
    if (!ping.success) {
      log(`WARN: 额外连接「${id}」不可用: ${ping.error || 'unknown'}`);
    }
  }

  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  log(
    `Ready — Tools: ${Object.keys((server as any)._registeredTools || {}).length}, ` +
      `Resources: ${Object.keys((server as any)._registeredResources || {}).length + Object.keys((server as any)._registeredResourceTemplates || {}).length}, ` +
      `Prompts: ${Object.keys((server as any)._registeredPrompts || {}).length}`
  );

  // 处理进程退出
  process.on('SIGINT', async () => {
    await closePool();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await closePool();
    process.exit(0);
  });
}

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await closePool();
  process.exit(1);
});
