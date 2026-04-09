/**
 * 数据修改类工具 - INSERT/UPDATE/DELETE
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { executeQuery } from '../db/executor.js';
import { ExecutionMode } from '../types/index.js';
import { isReadOnly, isDebugMode } from '../db/connection.js';

function checkReadOnly(): { allowed: boolean; error?: string } {
  if (isReadOnly()) {
    return {
      allowed: false,
      error: '当前处于只读模式，禁止执行写入操作',
    };
  }
  return { allowed: true };
}

function formatWriteResult(result: {
  affectedRows?: number;
  insertId?: number;
  changedRows?: number;
  message?: string;
  executionTime?: number;
}): string {
  const response: Record<string, unknown> = {
    affectedRows: result.affectedRows,
  };
  if (result.insertId) {
    response.insertId = result.insertId;
  }
  if (result.changedRows !== undefined) {
    response.changedRows = result.changedRows;
  }
  if (isDebugMode()) {
    response.executionTime = `${result.executionTime}ms`;
  }
  return JSON.stringify(response);
}

/**
 * 注册数据修改类工具
 */
export function registerModifyTools(server: McpServer): void {
  server.tool(
    'insert',
    '执行 INSERT 语句，支持参数化查询',
    {
      sql: z.string().describe('INSERT SQL 语句'),
      params: z.array(z.any()).optional().describe('参数'),
    },
    async ({ sql, params = [] }) => {
      const readOnlyCheck = checkReadOnly();
      if (!readOnlyCheck.allowed) {
        return {
          content: [{ type: 'text', text: readOnlyCheck.error! }],
          isError: true,
        };
      }

      const trimmed = sql.trim().toLowerCase();
      if (!trimmed.startsWith('insert')) {
        return {
          content: [{ type: 'text', text: '错误：此工具只允许执行 INSERT 语句' }],
          isError: true,
        };
      }

      const result = await executeQuery(sql, params, ExecutionMode.READWRITE);

      if (!result.success) {
        return {
          content: [{ type: 'text', text: `插入失败：${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: formatWriteResult(result) }],
      };
    }
  );

  server.tool(
    'update',
    '执行 UPDATE 语句（必须包含 WHERE），支持参数化查询',
    {
      sql: z.string().describe('UPDATE SQL 语句'),
      params: z.array(z.any()).optional().describe('参数'),
    },
    async ({ sql, params = [] }) => {
      const readOnlyCheck = checkReadOnly();
      if (!readOnlyCheck.allowed) {
        return {
          content: [{ type: 'text', text: readOnlyCheck.error! }],
          isError: true,
        };
      }

      const trimmed = sql.trim().toLowerCase();
      if (!trimmed.startsWith('update')) {
        return {
          content: [{ type: 'text', text: '错误：此工具只允许执行 UPDATE 语句' }],
          isError: true,
        };
      }

      const result = await executeQuery(sql, params, ExecutionMode.READWRITE);

      if (!result.success) {
        return {
          content: [{ type: 'text', text: `更新失败：${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: formatWriteResult(result) }],
      };
    }
  );

  server.tool(
    'delete',
    '执行 DELETE 语句（必须包含 WHERE），支持参数化查询',
    {
      sql: z.string().describe('DELETE SQL 语句'),
      params: z.array(z.any()).optional().describe('参数'),
    },
    async ({ sql, params = [] }) => {
      const readOnlyCheck = checkReadOnly();
      if (!readOnlyCheck.allowed) {
        return {
          content: [{ type: 'text', text: readOnlyCheck.error! }],
          isError: true,
        };
      }

      const trimmed = sql.trim().toLowerCase();
      if (!trimmed.startsWith('delete')) {
        return {
          content: [{ type: 'text', text: '错误：此工具只允许执行 DELETE 语句' }],
          isError: true,
        };
      }

      const result = await executeQuery(sql, params, ExecutionMode.READWRITE);

      if (!result.success) {
        return {
          content: [{ type: 'text', text: `删除失败：${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: formatWriteResult(result) }],
      };
    }
  );
}
