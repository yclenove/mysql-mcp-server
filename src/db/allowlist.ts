/**
 * MYSQL_DATABASE_ALLOWLIST：逗号分隔的库名白名单；未设置则不限制。
 * 库名仅允许字母、数字、下划线，与 validateIdentifier 一致。
 */
import { getConfigFromEnv, type ParsedExtraConnection } from './connection.js';

const IDENTIFIER_REGEX = /^[A-Za-z0-9_]+$/;

/**
 * 返回白名单集合；未配置时返回 null（表示不限制）。
 * 配置非法时抛出 Error（应在进程启动时捕获并退出）。
 */
export function getDatabaseAllowlist(): Set<string> | null {
  const raw = process.env.MYSQL_DATABASE_ALLOWLIST;
  if (raw === undefined || String(raw).trim() === '') {
    return null;
  }
  const parts = String(raw)
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return null;
  }
  const set = new Set<string>();
  for (const p of parts) {
    if (!IDENTIFIER_REGEX.test(p)) {
      throw new Error(
        `MYSQL_DATABASE_ALLOWLIST 含非法库名「${p}」，仅允许字母、数字、下划线，多个库用英文逗号分隔`
      );
    }
    set.add(p);
  }
  return set;
}

export function isDatabaseOnAllowlist(database: string): boolean {
  const list = getDatabaseAllowlist();
  if (!list) {
    return true;
  }
  return list.has(database);
}

/**
 * 启动时校验：若配置了白名单且默认库（含 MYSQL_URL 解析结果）不在白名单内则退出。
 */
export function validateStartupDatabaseAgainstAllowlist(): void {
  const list = getDatabaseAllowlist();
  if (!list) {
    return;
  }
  const db = getConfigFromEnv().database?.trim();
  if (!db) {
    return;
  }
  if (!list.has(db)) {
    throw new Error(
      `默认数据库「${db}」不在 MYSQL_DATABASE_ALLOWLIST 中（当前允许：${[...list].join(', ')}）`
    );
  }
}

/**
 * 若设置 MYSQL_MCP_VALIDATE_EXTRA_CONNECTIONS=true，校验每个额外 DSN 的默认库在白名单内（需已配置 MYSQL_DATABASE_ALLOWLIST）。
 */
export function validateExtraConnectionsAgainstAllowlist(extras: ParsedExtraConnection[]): void {
  if (process.env.MYSQL_MCP_VALIDATE_EXTRA_CONNECTIONS !== 'true') {
    return;
  }
  const list = getDatabaseAllowlist();
  if (!list) {
    return;
  }
  for (const { id, config } of extras) {
    const db = config.database?.trim();
    if (!db) {
      continue;
    }
    if (!list.has(db)) {
      throw new Error(
        `额外连接「${id}」默认库「${db}」不在 MYSQL_DATABASE_ALLOWLIST 中（当前允许：${[...list].join(', ')}）`
      );
    }
  }
}

/** SHOW DATABASES 结果行过滤（字段名 Database） */
export function filterShowDatabasesRows(rows: unknown[]): unknown[] {
  const list = getDatabaseAllowlist();
  if (!list || !Array.isArray(rows)) {
    return rows;
  }
  return rows.filter((r) => {
    const name = (r as { Database?: string })?.Database;
    return typeof name === 'string' && list.has(name);
  });
}
