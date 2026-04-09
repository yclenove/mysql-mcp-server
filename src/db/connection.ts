/**
 * 数据库连接池管理
 */
import mysql, { Pool, PoolOptions } from 'mysql2/promise';
import { DatabaseConfig } from '../types/index.js';

let pool: Pool | null = null;

/**
 * 从环境变量获取数据库配置
 */
export function getConfigFromEnv(): DatabaseConfig {
  const sslCa = process.env.MYSQL_SSL_CA;
  const sslCert = process.env.MYSQL_SSL_CERT;
  const sslKey = process.env.MYSQL_SSL_KEY;

  return {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE,
    connectionLimit: parseInt(process.env.MYSQL_CONNECTION_LIMIT || '10', 10),
    queueLimit: parseInt(process.env.MYSQL_QUEUE_LIMIT || '0', 10),
    timeout: parseInt(process.env.MYSQL_TIMEOUT || '60000', 10),
    queryTimeout: parseInt(process.env.MYSQL_QUERY_TIMEOUT || '30000', 10),
    retryCount: parseInt(process.env.MYSQL_RETRY_COUNT || '2', 10),
    retryDelayMs: parseInt(process.env.MYSQL_RETRY_DELAY_MS || '200', 10),
    maxRows: parseInt(process.env.MYSQL_MAX_ROWS || '1000', 10),
    ssl: sslCa || sslCert || sslKey ? {
      ca: sslCa,
      cert: sslCert,
      key: sslKey,
    } : undefined,
  };
}

/**
 * 获取连接池实例（单例模式）
 */
export function getPool(): Pool {
  if (!pool) {
    const config = getConfigFromEnv();
    
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

    pool = mysql.createPool(poolConfig);
  }
  return pool;
}

/**
 * 获取连接
 */
export async function getConnection() {
  const pool = getPool();
  return await pool.getConnection();
}

/**
 * 关闭连接池
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
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

export async function testConnectionWithDetails(): Promise<{ success: boolean; error?: string; code?: string }> {
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
 * 检查是否为只读模式
 */
export function isReadOnly(): boolean {
  return process.env.MYSQL_READONLY === 'true';
}
