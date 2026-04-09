/**
 * 数据库连接池管理（支持默认连接 + MYSQL_MCP_EXTRA_CONNECTIONS 多 DSN）
 */
import mysql, { Pool, PoolOptions } from 'mysql2/promise';
import { DatabaseConfig } from '../types/index.js';

export const DEFAULT_CONNECTION_ID = 'default';

const CONNECTION_ID_REGEX = /^[A-Za-z0-9_]+$/;

const pools = new Map<string, Pool>();
/** 无密码，供 list_connections */
const connectionMeta = new Map<string, { host: string; port: number; database?: string }>();
/** 非 default 连接在 USE 后的当前库；default 仍以 MYSQL_DATABASE 为准 */
const sessionDatabaseById = new Map<string, string>();

let poolsInitialized = false;

/**
 * 解析 `mysql://` / `mysql2://` 连接串（密码等请使用 URL 编码，如 `p%40ss`）。
 * 与 `MYSQL_HOST` 等分项变量二选一；若同时存在，连接串中的主机/端口/用户/密码/路径库名优先，未给出的字段仍可由环境变量补全。
 */
export function parseMysqlConnectionUrl(
  urlStr: string
): Partial<Pick<DatabaseConfig, 'host' | 'port' | 'user' | 'password' | 'database'>> | null {
  const trimmed = urlStr.trim();
  if (!trimmed) return null;

  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return null;
  }

  const proto = u.protocol.replace(/:$/, '').toLowerCase();
  if (proto !== 'mysql' && proto !== 'mysql2') {
    return null;
  }

  const pathPart = u.pathname.replace(/^\//, '');
  const database = pathPart.split('?')[0] || undefined;

  return {
    host: u.hostname || undefined,
    port: u.port ? parseInt(u.port, 10) : undefined,
    user: u.username !== '' ? decodeURIComponent(u.username) : undefined,
    password: u.password !== '' ? decodeURIComponent(u.password) : undefined,
    database: database || undefined,
  };
}

function mergeUrlWithEnv(): Partial<
  Pick<DatabaseConfig, 'host' | 'port' | 'user' | 'password' | 'database'>
> {
  const raw = process.env.MYSQL_URL || process.env.MYSQL_CONNECTION_STRING;
  if (!raw) return {};
  const parsed = parseMysqlConnectionUrl(raw);
  return parsed ?? {};
}

function sslFromEnv(): DatabaseConfig['ssl'] {
  const sslCa = process.env.MYSQL_SSL_CA;
  const sslCert = process.env.MYSQL_SSL_CERT;
  const sslKey = process.env.MYSQL_SSL_KEY;
  if (sslCa || sslCert || sslKey) {
    return { ca: sslCa, cert: sslCert, key: sslKey };
  }
  return undefined;
}

/**
 * 分项环境变量 + 通用池参数（不含 MYSQL_URL），用于额外连接项合并
 */
export function getDiscreteConfigBase(): DatabaseConfig {
  return {
    host: process.env.MYSQL_HOST ?? 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER ?? 'root',
    password: process.env.MYSQL_PASSWORD ?? '',
    database: process.env.MYSQL_DATABASE,
    connectionLimit: parseInt(process.env.MYSQL_CONNECTION_LIMIT || '10', 10),
    queueLimit: parseInt(process.env.MYSQL_QUEUE_LIMIT || '0', 10),
    timeout: parseInt(process.env.MYSQL_TIMEOUT || '60000', 10),
    queryTimeout: parseInt(process.env.MYSQL_QUERY_TIMEOUT || '30000', 10),
    retryCount: parseInt(process.env.MYSQL_RETRY_COUNT || '2', 10),
    retryDelayMs: parseInt(process.env.MYSQL_RETRY_DELAY_MS || '200', 10),
    maxRows: parseInt(process.env.MYSQL_MAX_ROWS || '100', 10),
    ssl: sslFromEnv(),
  };
}

/**
 * 从环境变量获取数据库配置（含 MYSQL_URL）
 */
export function getConfigFromEnv(): DatabaseConfig {
  const fromUrl = mergeUrlWithEnv();
  const base = getDiscreteConfigBase();
  return {
    ...base,
    host: fromUrl.host ?? base.host,
    port: fromUrl.port ?? base.port,
    user: fromUrl.user ?? base.user,
    password: fromUrl.password ?? base.password,
    database: fromUrl.database ?? base.database,
  };
}

export type ParsedExtraConnection = { id: string; config: DatabaseConfig };

/**
 * 解析 MYSQL_MCP_EXTRA_CONNECTIONS JSON，供启动校验与单测
 */
export function parseExtraConnections(raw: string | undefined): ParsedExtraConnection[] {
  if (raw === undefined || String(raw).trim() === '') {
    return [];
  }
  let arr: unknown[];
  try {
    arr = JSON.parse(String(raw)) as unknown[];
  } catch {
    throw new Error('MYSQL_MCP_EXTRA_CONNECTIONS 不是合法 JSON');
  }
  if (!Array.isArray(arr)) {
    throw new Error('MYSQL_MCP_EXTRA_CONNECTIONS 须为 JSON 数组');
  }

  const seen = new Set<string>();
  const out: ParsedExtraConnection[] = [];

  for (const item of arr) {
    if (item === null || typeof item !== 'object') {
      throw new Error('MYSQL_MCP_EXTRA_CONNECTIONS 数组元素须为对象');
    }
    const entry = item as Record<string, unknown>;
    const id = entry.id;
    if (typeof id !== 'string' || !CONNECTION_ID_REGEX.test(id)) {
      throw new Error('每个连接须包含合法 id（字母数字下划线）');
    }
    if (id === DEFAULT_CONNECTION_ID) {
      throw new Error(`额外连接 id 不能为 ${DEFAULT_CONNECTION_ID}`);
    }
    if (seen.has(id)) {
      throw new Error(`MYSQL_MCP_EXTRA_CONNECTIONS 中 id「${id}」重复`);
    }
    seen.add(id);

    const base = getDiscreteConfigBase();
    let config: DatabaseConfig;

    if (typeof entry.url === 'string' && entry.url.trim() !== '') {
      const p = parseMysqlConnectionUrl(entry.url);
      if (!p) {
        throw new Error(`连接「${id}」的 url 无效`);
      }
      config = {
        ...base,
        host: p.host ?? base.host,
        port: p.port ?? base.port,
        user: p.user ?? base.user,
        password: p.password ?? base.password,
        database: p.database ?? base.database,
      };
    } else {
      config = {
        ...base,
        host: entry.host !== undefined ? String(entry.host) : base.host,
        port: entry.port !== undefined ? parseInt(String(entry.port), 10) || base.port : base.port,
        user: entry.user !== undefined ? String(entry.user) : base.user,
        password: entry.password !== undefined ? String(entry.password) : base.password,
        database: entry.database !== undefined ? String(entry.database) : base.database,
      };
    }

    out.push({ id, config });
  }

  return out;
}

function createMysqlPool(config: DatabaseConfig): Pool {
  const poolConfig: PoolOptions = {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionLimit: config.connectionLimit,
    queueLimit: config.queueLimit,
    connectTimeout: config.timeout,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  };

  if (config.ssl) {
    poolConfig.ssl = config.ssl;
  }

  return mysql.createPool(poolConfig);
}

function setMeta(id: string, config: DatabaseConfig): void {
  connectionMeta.set(id, {
    host: config.host,
    port: config.port,
    database: config.database,
  });
  const db = config.database?.trim();
  if (db) {
    sessionDatabaseById.set(id, db);
  }
}

/**
 * 初始化所有连接池（默认 + 额外）。重复调用为 no-op。
 */
export function initConnectionPools(): void {
  if (poolsInitialized) {
    return;
  }

  const defaultConfig = getConfigFromEnv();
  pools.set(DEFAULT_CONNECTION_ID, createMysqlPool(defaultConfig));
  setMeta(DEFAULT_CONNECTION_ID, defaultConfig);

  const extras = parseExtraConnections(process.env.MYSQL_MCP_EXTRA_CONNECTIONS);
  for (const { id, config } of extras) {
    pools.set(id, createMysqlPool(config));
    setMeta(id, config);
  }

  poolsInitialized = true;
}

export function getActiveConnectionId(): string {
  const raw = process.env.MYSQL_MCP_CONNECTION_ID;
  if (raw === undefined || String(raw).trim() === '') {
    return DEFAULT_CONNECTION_ID;
  }
  return String(raw).trim();
}

/**
 * 当前活动连接上的默认库（USE / 连接串 / MYSQL_DATABASE）
 */
export function getSessionDatabase(): string | undefined {
  const id = getActiveConnectionId();
  if (id === DEFAULT_CONNECTION_ID) {
    const envDb = process.env.MYSQL_DATABASE?.trim();
    if (envDb) {
      return envDb;
    }
    return connectionMeta.get(id)?.database;
  }
  return sessionDatabaseById.get(id) ?? connectionMeta.get(id)?.database;
}

/**
 * use_database 成功后更新会话库
 */
export function setSessionDatabaseForActiveConnection(database: string): void {
  const id = getActiveConnectionId();
  if (id === DEFAULT_CONNECTION_ID) {
    process.env.MYSQL_DATABASE = database;
  }
  sessionDatabaseById.set(id, database);
}

export function listConnectionDescriptors(): {
  id: string;
  host: string;
  port: number;
  database?: string;
}[] {
  return [...connectionMeta.entries()].map(([id, m]) => ({
    id,
    host: m.host,
    port: m.port,
    database: m.database,
  }));
}

export function setActiveConnectionId(
  connectionId: string
): { ok: true } | { ok: false; error: string } {
  const id = connectionId.trim();
  if (!CONNECTION_ID_REGEX.test(id)) {
    return { ok: false, error: 'connection_id 仅允许字母、数字、下划线' };
  }
  if (!pools.has(id)) {
    return { ok: false, error: `未知连接 id「${id}」，请先配置 MYSQL_MCP_EXTRA_CONNECTIONS` };
  }
  process.env.MYSQL_MCP_CONNECTION_ID = id;
  return { ok: true };
}

/**
 * 按活动连接 id 获取池；首次访问时初始化
 */
export function getPool(): Pool {
  initConnectionPools();
  const id = getActiveConnectionId();
  const p = pools.get(id);
  if (!p) {
    throw new Error(`内部错误：未找到连接池「${id}」`);
  }
  return p;
}

/**
 * 获取连接
 */
export async function getConnection() {
  const pool = getPool();
  return await pool.getConnection();
}

/**
 * 关闭所有连接池
 */
export async function closePool(): Promise<void> {
  const toClose = [...pools.values()];
  pools.clear();
  connectionMeta.clear();
  sessionDatabaseById.clear();
  poolsInitialized = false;
  await Promise.all(toClose.map((p) => p.end().catch(() => undefined)));
}

/**
 * 测试连接
 */
export async function testConnection(): Promise<boolean> {
  try {
    const conn = await getConnection();
    await conn.query('SELECT 1');
    conn.release();
    return true;
  } catch (_error) {
    return false;
  }
}

export async function testConnectionWithDetails(): Promise<{
  success: boolean;
  error?: string;
  code?: string;
}> {
  try {
    const conn = await getConnection();
    await conn.query('SELECT 1');
    conn.release();
    return { success: true };
  } catch (error) {
    const err = error as { message?: string; code?: string };
    return {
      success: false,
      error: err?.message || '未知连接错误',
      code: err?.code,
    };
  }
}

/**
 * 对指定连接 id 做 SELECT 1（不改变活动连接）
 */
export async function pingConnectionById(
  id: string
): Promise<{ success: boolean; error?: string }> {
  initConnectionPools();
  const p = pools.get(id);
  if (!p) {
    return { success: false, error: `未知连接「${id}」` };
  }
  try {
    const conn = await p.getConnection();
    await conn.query('SELECT 1');
    conn.release();
    return { success: true };
  } catch (error) {
    const err = error as { message?: string };
    return { success: false, error: err?.message || '未知错误' };
  }
}

export function getExtraConnectionIds(): string[] {
  return parseExtraConnections(process.env.MYSQL_MCP_EXTRA_CONNECTIONS).map((x) => x.id);
}

/**
 * 检查是否为只读模式
 */
export function isReadOnly(): boolean {
  return process.env.MYSQL_READONLY === 'true';
}

/**
 * 检查是否为调试模式（返回 executionTime 等额外信息）
 */
export function isDebugMode(): boolean {
  return process.env.MCP_DEBUG === 'true';
}
