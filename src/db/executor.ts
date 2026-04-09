/**
 * SQL 执行器
 */
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getPool, getConnection } from './connection.js';
import { QueryResult, BatchResult, ExecutionMode } from '../types/index.js';
import { auditLog } from '../audit.js';

const IDENTIFIER_REGEX = /^[A-Za-z0-9_]+$/;
const RETRIABLE_ERROR_CODES = new Set([
  'PROTOCOL_CONNECTION_LOST',
  'ER_LOCK_DEADLOCK',
  'ER_LOCK_WAIT_TIMEOUT',
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
]);

/**
 * 判断 SQL 是否为只读查询
 */
export function isReadOnlyQuery(sql: string): boolean {
  const trimmed = sql.trim().toLowerCase();
  // 只允许 SELECT 和 SHOW 语句
  return (
    trimmed.startsWith('select') ||
    trimmed.startsWith('show') ||
    trimmed.startsWith('describe') ||
    trimmed.startsWith('desc') ||
    trimmed.startsWith('explain')
  );
}

/**
 * 校验 SQL 标识符（表名、列名等）
 */
export function validateIdentifier(name: string, fieldName: string = '标识符'): string | null {
  if (!name || typeof name !== 'string') {
    return `${fieldName}不能为空`;
  }
  if (!IDENTIFIER_REGEX.test(name)) {
    return `${fieldName}不合法，仅支持字母、数字和下划线`;
  }
  return null;
}

/**
 * 转义 SQL 标识符
 */
export function escapeIdentifier(name: string): string {
  return `\`${name.replace(/`/g, '``')}\``;
}

function stripQuotedContentAndComments(sql: string): string {
  return sql
    .replace(/--.*$/gm, ' ')
    .replace(/#.*$/gm, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(/"(?:\\"|[^"])*"/g, '""')
    .replace(/`(?:``|[^`])*`/g, '``');
}

function getRuntimeConfig() {
  return {
    queryTimeout: parseInt(process.env.MYSQL_QUERY_TIMEOUT || '30000', 10),
    retryCount: parseInt(process.env.MYSQL_RETRY_COUNT || '2', 10),
    retryDelayMs: parseInt(process.env.MYSQL_RETRY_DELAY_MS || '200', 10),
    maxRows: parseInt(process.env.MYSQL_MAX_ROWS || '100', 10),
  };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetriableError(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return !!code && RETRIABLE_ERROR_CODES.has(code);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (timeoutMs <= 0) {
    return promise;
  }
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`查询超时（>${timeoutMs}ms）`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

async function executeWithRetry<T>(runner: () => Promise<T>, allowRetry: boolean): Promise<T> {
  const { retryCount, retryDelayMs } = getRuntimeConfig();
  const attempts = Math.max(0, retryCount) + 1;
  for (let i = 0; i < attempts; i++) {
    try {
      return await runner();
    } catch (error) {
      const shouldRetry = allowRetry && i < attempts - 1 && isRetriableError(error);
      if (!shouldRetry) {
        throw error;
      }
      const backoff = Math.max(50, retryDelayMs) * Math.pow(2, i);
      const jitter = Math.floor(Math.random() * 50);
      await sleep(backoff + jitter);
    }
  }
  throw new Error('查询执行失败');
}

/**
 * 检查危险操作
 */
function checkDangerousOperation(sql: string): string | null {
  const normalized = stripQuotedContentAndComments(sql).trim().toLowerCase();

  if (normalized.startsWith('truncate')) {
    return '危险操作：TRUNCATE 会清空整张表数据，拒绝执行';
  }

  if (normalized.startsWith('drop')) {
    return '危险操作：DROP 会删除数据库对象，拒绝执行';
  }

  if (normalized.startsWith('alter')) {
    return '危险操作：ALTER 会修改表结构，拒绝执行。如需 DDL 操作请直接使用数据库客户端';
  }

  const isDeleteOrUpdate = normalized.startsWith('delete') || normalized.startsWith('update');
  const hasWhere = /\bwhere\b/.test(normalized);
  if (isDeleteOrUpdate && !hasWhere) {
    return '危险操作：DELETE 或 UPDATE 语句缺少 WHERE 子句，拒绝执行';
  }

  return null;
}

/**
 * 执行 SQL 查询
 */
export async function executeQuery(
  sql: string,
  params?: any[],
  mode: ExecutionMode = ExecutionMode.READWRITE,
  overrideMaxRows?: number
): Promise<QueryResult> {
  const startTime = Date.now();

  try {
    if (mode === ExecutionMode.READONLY && !isReadOnlyQuery(sql)) {
      return {
        success: false,
        error: '当前处于只读模式，只允许执行 SELECT 查询',
      };
    }

    const dangerCheck = checkDangerousOperation(sql);
    if (dangerCheck) {
      return {
        success: false,
        error: dangerCheck,
      };
    }

    const pool = getPool();
    const { queryTimeout, maxRows } = getRuntimeConfig();
    const effectiveMaxRows = Math.max(1, overrideMaxRows ?? maxRows);
    const [result] = await executeWithRetry<[unknown, unknown]>(
      () => withTimeout(pool.execute(sql, params) as Promise<[unknown, unknown]>, queryTimeout),
      isReadOnlyQuery(sql)
    );
    const executionTime = Date.now() - startTime;

    if (Array.isArray(result)) {
      auditLog({ sql, params, success: true, executionTime });
      return {
        success: true,
        data: (result as RowDataPacket[]).slice(0, effectiveMaxRows),
        totalRows: (result as RowDataPacket[]).length,
        truncated: (result as RowDataPacket[]).length > effectiveMaxRows,
        executionTime,
      };
    } else {
      const header = result as ResultSetHeader;
      auditLog({ sql, params, success: true, executionTime, affectedRows: header.affectedRows });
      return {
        success: true,
        affectedRows: header.affectedRows,
        insertId: header.insertId,
        changedRows: 'changedRows' in header ? header.changedRows : undefined,
        message: `执行成功，影响 ${header.affectedRows} 行`,
        executionTime,
      };
    }
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : '未知错误';
    auditLog({ sql, params, success: false, error: errorMsg, executionTime });
    return {
      success: false,
      error: errorMsg,
      executionTime,
    };
  }
}

/**
 * 批量执行 SQL（事务）
 */
export async function executeBatch(
  statements: { sql: string; params?: any[] }[],
  mode: ExecutionMode = ExecutionMode.READWRITE
): Promise<BatchResult> {
  const startTime = Date.now();
  const results: QueryResult[] = [];
  let successCount = 0;
  let errorCount = 0;

  // 检查只读模式
  if (mode === ExecutionMode.READONLY) {
    for (const stmt of statements) {
      if (!isReadOnlyQuery(stmt.sql)) {
        return {
          success: false,
          results: [],
          totalStatements: statements.length,
          successCount: 0,
          errorCount: statements.length,
          error: '当前处于只读模式，批量执行中包含非 SELECT 语句',
        };
      }
    }
  }

  const conn = await getConnection();

  try {
    // 开始事务
    await conn.beginTransaction();

    for (const { sql, params } of statements) {
      // 检查危险操作
      const dangerCheck = checkDangerousOperation(sql);
      if (dangerCheck) {
        await conn.rollback();
        return {
          success: false,
          results,
          totalStatements: statements.length,
          successCount,
          errorCount: statements.length - successCount,
          error: dangerCheck,
        };
      }

      try {
        const { queryTimeout, maxRows } = getRuntimeConfig();
        const [result] = await executeWithRetry<[unknown, unknown]>(
          () => withTimeout(conn.execute(sql, params) as Promise<[unknown, unknown]>, queryTimeout),
          isReadOnlyQuery(sql)
        );

        if (Array.isArray(result)) {
          results.push({
            success: true,
            data: (result as RowDataPacket[]).slice(0, Math.max(1, maxRows)),
            totalRows: (result as RowDataPacket[]).length,
            truncated: (result as RowDataPacket[]).length > Math.max(1, maxRows),
          });
        } else {
          const header = result as ResultSetHeader;
          results.push({
            success: true,
            affectedRows: header.affectedRows,
            insertId: header.insertId,
            changedRows: 'changedRows' in header ? header.changedRows : undefined,
            message: `执行成功，影响 ${header.affectedRows} 行`,
          });
        }
        successCount++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '未知错误';
        results.push({
          success: false,
          error: errorMsg,
        });
        errorCount++;
        // 出错时回滚事务
        await conn.rollback();
        return {
          success: false,
          results,
          totalStatements: statements.length,
          successCount,
          errorCount,
          error: `批量执行在第 ${results.length} 条语句失败：${errorMsg}`,
        };
      }
    }

    // 提交事务
    await conn.commit();

    const executionTime = Date.now() - startTime;
    results.forEach((r) => (r.executionTime = executionTime));

    return {
      success: true,
      results,
      totalStatements: statements.length,
      successCount,
      errorCount,
    };
  } catch (error) {
    await conn.rollback();
    const errorMsg = error instanceof Error ? error.message : '未知错误';
    return {
      success: false,
      results,
      totalStatements: statements.length,
      successCount,
      errorCount: statements.length - successCount,
      error: `事务执行失败：${errorMsg}`,
    };
  } finally {
    conn.release();
  }
}

/**
 * 获取所有数据库列表
 */
export async function listDatabases(): Promise<QueryResult> {
  return executeQuery('SHOW DATABASES');
}

/**
 * 获取指定数据库的所有表
 */
export async function listTables(database?: string): Promise<QueryResult> {
  const db = database || process.env.MYSQL_DATABASE;
  if (!db) {
    return {
      success: false,
      error: '未指定数据库，请在参数中提供或设置 MYSQL_DATABASE 环境变量',
    };
  }

  const sql = `
    SELECT 
      table_name as \`name\`,
      engine,
      table_rows as \`rows\`,
      data_length as dataLength,
      create_time as createTime,
      update_time as updateTime,
      table_comment as comment
    FROM information_schema.tables
    WHERE table_schema = ?
    ORDER BY table_name
  `;

  return executeQuery(sql, [db]);
}

/**
 * 获取表结构
 */
export async function describeTable(table: string): Promise<QueryResult> {
  if (!table) {
    return {
      success: false,
      error: '表名不能为空',
    };
  }

  const sql = `
    SELECT 
      column_name as \`name\`,
      column_type as \`type\`,
      is_nullable as nullable,
      column_default as defaultValue,
      column_comment as comment,
      column_key = 'PRI' as isPrimaryKey,
      extra = 'auto_increment' as isAutoIncrement
    FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = ?
    ORDER BY ordinal_position
  `;

  return executeQuery(sql, [table]);
}

/**
 * 获取表索引信息
 */
export async function showIndexes(table: string): Promise<QueryResult> {
  if (!table) {
    return {
      success: false,
      error: '表名不能为空',
    };
  }

  const validationError = validateIdentifier(table, '表名');
  if (validationError) {
    return {
      success: false,
      error: validationError,
    };
  }

  return executeQuery(`SHOW INDEX FROM ${escapeIdentifier(table)}`);
}

/**
 * 获取表创建语句
 */
export async function showCreateTable(table: string): Promise<QueryResult> {
  if (!table) {
    return {
      success: false,
      error: '表名不能为空',
    };
  }

  const validationError = validateIdentifier(table, '表名');
  if (validationError) {
    return {
      success: false,
      error: validationError,
    };
  }

  return executeQuery(`SHOW CREATE TABLE ${escapeIdentifier(table)}`);
}
