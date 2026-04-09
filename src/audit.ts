/**
 * 查询审计日志 — 记录所有 SQL 执行
 * 通过 MCP_AUDIT_LOG 环境变量启用，指定日志文件路径
 */
import { appendFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

let logPath: string | null = null;
let initialized = false;

function init(): void {
  if (initialized) return;
  initialized = true;
  logPath = process.env.MCP_AUDIT_LOG || null;
  if (logPath) {
    try {
      mkdirSync(dirname(logPath), { recursive: true });
    } catch {
      // directory may already exist
    }
  }
}

export function auditLog(entry: {
  sql: string;
  params?: any[];
  success: boolean;
  error?: string;
  executionTime?: number;
  affectedRows?: number;
}): void {
  init();
  if (!logPath) return;

  try {
    const record = {
      timestamp: new Date().toISOString(),
      sql: entry.sql,
      params: entry.params?.length ? entry.params : undefined,
      success: entry.success,
      error: entry.error,
      executionTime: entry.executionTime !== undefined ? `${entry.executionTime}ms` : undefined,
      affectedRows: entry.affectedRows,
    };
    appendFileSync(logPath, JSON.stringify(record) + '\n', 'utf-8');
  } catch {
    // audit logging should never crash the server
  }
}
