/**
 * 批量执行工具
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  executeBatch,
  isReadOnlyQuery,
  validateIdentifier,
  escapeIdentifier,
} from '../db/executor.js';
import { ExecutionMode } from '../types/index.js';
import { isReadOnly, isDebugMode } from '../db/connection.js';

const MAX_BATCH_SIZE = 50;

/**
 * 注册批量执行工具
 */
export function registerBatchTools(server: McpServer): void {
  server.registerTool(
    'batch_execute',
    {
      description: `事务批量 SQL，失败回滚，≤${MAX_BATCH_SIZE} 条`,
      inputSchema: {
        statements: z
          .array(
            z.object({
              sql: z.string().describe('SQL'),
              params: z.array(z.any()).optional().describe('? 绑定值'),
            })
          )
          .max(MAX_BATCH_SIZE)
          .describe('语句数组'),
      },
    },
    async ({ statements }, _extra) => {
      if (!statements || statements.length === 0) {
        return {
          content: [{ type: 'text', text: '错误：语句列表不能为空' }],
          isError: true,
        };
      }

      if (statements.length > MAX_BATCH_SIZE) {
        return {
          content: [
            {
              type: 'text',
              text: `错误：一次最多执行 ${MAX_BATCH_SIZE} 条语句，当前 ${statements.length} 条`,
            },
          ],
          isError: true,
        };
      }

      const readOnlyMode = isReadOnly();
      const mode = readOnlyMode ? ExecutionMode.READONLY : ExecutionMode.READWRITE;

      if (readOnlyMode) {
        const hasWriteOperation = statements.some((stmt) => !isReadOnlyQuery(stmt.sql));
        if (hasWriteOperation) {
          return {
            content: [
              {
                type: 'text',
                text: '错误：当前处于只读模式，批量执行中包含非 SELECT 语句',
              },
            ],
            isError: true,
          };
        }
      }

      const result = await executeBatch(statements, mode);

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: result.error,
                successCount: result.successCount,
                errorCount: result.errorCount,
              }),
            },
          ],
          isError: true,
        };
      }

      const response: Record<string, unknown> = {
        totalStatements: result.totalStatements,
        successCount: result.successCount,
        results: result.results.map((r, index) => {
          const item: Record<string, unknown> = { index: index + 1 };
          if (r.data !== undefined) {
            item.data = r.data;
            if (r.truncated) {
              item.totalRows = r.totalRows;
              item.truncated = true;
            }
          }
          if (r.affectedRows !== undefined) {
            item.affectedRows = r.affectedRows;
          }
          if (r.insertId) {
            item.insertId = r.insertId;
          }
          return item;
        }),
      };
      if (isDebugMode()) {
        response.executionTime = `${result.results[0]?.executionTime}ms`;
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(response) }],
      };
    }
  );

  server.registerTool(
    'batch_insert',
    {
      description: `多行 INSERT，事务，≤${MAX_BATCH_SIZE} 行`,
      inputSchema: {
        table: z.string().describe('表名'),
        records: z
          .array(z.record(z.string(), z.any()))
          .max(MAX_BATCH_SIZE)
          .describe('对象数组，键为列名'),
      },
    },
    async ({ table, records }, _extra) => {
      if (isReadOnly()) {
        return {
          content: [{ type: 'text', text: '错误：当前处于只读模式，禁止执行插入操作' }],
          isError: true,
        };
      }

      if (!records || records.length === 0) {
        return {
          content: [{ type: 'text', text: '错误：记录列表不能为空' }],
          isError: true,
        };
      }

      if (records.length > MAX_BATCH_SIZE) {
        return {
          content: [
            {
              type: 'text',
              text: `错误：一次最多插入 ${MAX_BATCH_SIZE} 条记录，当前 ${records.length} 条`,
            },
          ],
          isError: true,
        };
      }

      const tableValidationError = validateIdentifier(table, '表名');
      if (tableValidationError) {
        return {
          content: [{ type: 'text', text: `错误：${tableValidationError}` }],
          isError: true,
        };
      }

      const firstRecord = records[0];
      if (!firstRecord) {
        return {
          content: [{ type: 'text', text: '错误：记录列表不能为空' }],
          isError: true,
        };
      }
      const firstColumns = Object.keys(firstRecord);
      if (firstColumns.length === 0) {
        return {
          content: [{ type: 'text', text: '错误：记录字段不能为空' }],
          isError: true,
        };
      }

      for (const column of firstColumns) {
        const columnValidationError = validateIdentifier(column, `字段名 ${column}`);
        if (columnValidationError) {
          return {
            content: [{ type: 'text', text: `错误：${columnValidationError}` }],
            isError: true,
          };
        }
      }

      for (let i = 0; i < records.length; i++) {
        const record = records[i]!;
        const columns = Object.keys(record);
        if (
          columns.length !== firstColumns.length ||
          !firstColumns.every((col) => Object.prototype.hasOwnProperty.call(record, col))
        ) {
          return {
            content: [
              {
                type: 'text',
                text: `错误：第 ${i + 1} 条记录字段不一致，批量插入要求所有记录字段完全一致`,
              },
            ],
            isError: true,
          };
        }
      }

      try {
        const escapedColumns = firstColumns.map((c) => escapeIdentifier(c)).join(', ');
        const rowPlaceholder = `(${firstColumns.map(() => '?').join(', ')})`;
        const allPlaceholders = records.map(() => rowPlaceholder).join(', ');
        const allValues = records.flatMap((record) => firstColumns.map((col) => record[col]));

        const sql = `INSERT INTO ${escapeIdentifier(table)} (${escapedColumns}) VALUES ${allPlaceholders}`;
        const result = await executeBatch([{ sql, params: allValues }], ExecutionMode.READWRITE);

        if (!result.success) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: result.error, insertedCount: 0 }),
              },
            ],
            isError: true,
          };
        }

        const header = result.results[0];
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                table,
                insertedCount: header?.affectedRows ?? records.length,
                firstInsertId: header?.insertId,
              }),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `错误：${error instanceof Error ? error.message : '批量插入失败'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
