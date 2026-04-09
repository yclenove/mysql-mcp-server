/**
 * 批量执行工具
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { executeBatch, isReadOnlyQuery, validateIdentifier, escapeIdentifier } from '../db/executor.js';
import { ExecutionMode } from '../types/index.js';
import { isReadOnly } from '../db/connection.js';

// 批量执行限制
const MAX_BATCH_SIZE = 50;

/**
 * 注册批量执行工具
 */
export function registerBatchTools(server: McpServer): void {
  // 批量执行 SQL
  server.tool(
    'batch_execute',
    `批量执行多条 SQL 语句（自动使用事务），支持混合查询和修改操作。最多支持 ${MAX_BATCH_SIZE} 条语句，超过将被拒绝执行。` +
    '事务特性：所有语句在同一个事务中执行，如果其中一条失败会全部回滚。' +
    '安全提示：DELETE/UPDATE 语句必须包含 WHERE 条件，否则会被拒绝执行。' +
    '使用示例：[{sql:"SELECT * FROM users WHERE id=?", params:[1]}, {sql:"UPDATE users SET name=? WHERE id=?", params:["张三", 1]}]',
    {
      statements: z
        .array(
          z.object({
            sql: z.string().describe('SQL 语句'),
            params: z.array(z.any()).optional().describe('参数（用于参数化查询）'),
          })
        )
        .max(MAX_BATCH_SIZE, `一次最多执行 ${MAX_BATCH_SIZE} 条语句`)
        .describe(`SQL 语句列表，每条包含 sql 和可选的 params，最多 ${MAX_BATCH_SIZE} 条`),
    },
    async ({ statements }) => {
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
              text: `错误：一次最多执行 ${MAX_BATCH_SIZE} 条语句，当前提交了 ${statements.length} 条。请分批执行或减少语句数量。`,
            },
          ],
          isError: true,
        };
      }

      // 检查只读模式
      const readOnlyMode = isReadOnly();
      const mode = readOnlyMode ? ExecutionMode.READONLY : ExecutionMode.READWRITE;

      // 如果在只读模式下，检查是否有非查询语句
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
              text: JSON.stringify(
                {
                  success: false,
                  error: result.error,
                  totalStatements: result.totalStatements,
                  successCount: result.successCount,
                  errorCount: result.errorCount,
                  results: result.results,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                totalStatements: result.totalStatements,
                successCount: result.successCount,
                errorCount: result.errorCount,
                results: result.results.map((r, index) => ({
                  index: index + 1,
                  ...r,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 批量查询（只读）
  server.tool(
    'batch_query',
    `批量执行多条只读查询（SELECT/SHOW/DESCRIBE/DESC/EXPLAIN）。最多支持 ${MAX_BATCH_SIZE} 条查询。` +
    '性能提示：所有查询在同一个事务中执行，适合需要多次查询的场景。' +
    '限制：只能执行只读查询语句，如需执行修改操作请使用 batch_execute。' +
    '使用示例：[{sql:"SELECT * FROM users WHERE id=?", params:[1]}, {sql:"SELECT COUNT(*) FROM orders", params:[]}]',
    {
      queries: z
        .array(
          z.object({
            sql: z.string().describe('只读 SQL 语句'),
            params: z.array(z.any()).optional().describe('查询参数'),
          })
        )
        .max(MAX_BATCH_SIZE, `一次最多执行 ${MAX_BATCH_SIZE} 条查询`)
        .describe(`SELECT 查询列表，最多 ${MAX_BATCH_SIZE} 条`),
    },
    async ({ queries }) => {
      if (!queries || queries.length === 0) {
        return {
          content: [{ type: 'text', text: '错误：查询列表不能为空' }],
          isError: true,
        };
      }

      if (queries.length > MAX_BATCH_SIZE) {
        return {
          content: [
            {
              type: 'text',
              text: `错误：一次最多执行 ${MAX_BATCH_SIZE} 条查询，当前提交了 ${queries.length} 条。请分批执行或减少查询数量。`,
            },
          ],
          isError: true,
        };
      }

      // 验证所有语句都是只读查询
      for (const query of queries) {
        if (!isReadOnlyQuery(query.sql)) {
          return {
            content: [
              {
                type: 'text',
                text: `错误：第 ${queries.indexOf(query) + 1} 条语句不是只读查询语句，请使用 batch_execute 工具`,
              },
            ],
            isError: true,
          };
        }
      }

      const result = await executeBatch(queries, ExecutionMode.READONLY);

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  error: result.error,
                  totalStatements: result.totalStatements,
                  successCount: result.successCount,
                  errorCount: result.errorCount,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                totalQueries: result.totalStatements,
                results: result.results.map((r, index) => ({
                  queryIndex: index + 1,
                  rowCount: r.data?.length || 0,
                  totalRows: r.totalRows ?? (r.data?.length || 0),
                  truncated: r.truncated || false,
                  data: r.data || [],
                  executionTime: r.executionTime,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 批量插入
  server.tool(
    'batch_insert',
    `批量插入多条记录（自动使用事务）。最多支持 ${MAX_BATCH_SIZE} 条记录。` +
    '事务特性：所有插入在同一个事务中执行，如果其中一条失败会全部回滚。' +
    '性能优势：比逐条执行 insert 工具效率高，适合批量导入数据。' +
    '字段说明：records 数组中每个对象的 key 是字段名，value 是字段值。' +
    '使用示例：table:"users", records:[{name:"张三", age:25}, {name:"李四", age:30}]',
    {
      table: z.string().describe('表名'),
      records: z
        .array(z.record(z.string(), z.any()))
        .max(MAX_BATCH_SIZE, `一次最多插入 ${MAX_BATCH_SIZE} 条记录`)
        .describe(`要插入的记录对象数组，最多 ${MAX_BATCH_SIZE} 条，每条记录的 key 是字段名，value 是字段值`),
    },
    async ({ table, records }) => {
      // 检查只读模式
      if (isReadOnly()) {
        return {
          content: [
            {
              type: 'text',
              text: '错误：当前处于只读模式，禁止执行插入操作',
            },
          ],
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
              text: `错误：一次最多插入 ${MAX_BATCH_SIZE} 条记录，当前提交了 ${records.length} 条。请分批执行或减少记录数量。`,
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

      let result;
      try {
        // 构建 INSERT 语句
        const statements = records.map((record, index) => {
          const columns = Object.keys(record);
          if (columns.length !== firstColumns.length || !firstColumns.every((col) => Object.prototype.hasOwnProperty.call(record, col))) {
            throw new Error(`第 ${index + 1} 条记录字段不一致，批量插入要求所有记录字段完全一致`);
          }

          const values = Object.values(record);
          const placeholders = values.map(() => '?').join(', ');
          const escapedColumns = columns.map((column) => escapeIdentifier(column)).join(', ');
          const sql = `INSERT INTO ${escapeIdentifier(table)} (${escapedColumns}) VALUES (${placeholders})`;
          return { sql, params: values };
        });
        result = await executeBatch(statements, ExecutionMode.READWRITE);
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `错误：${error instanceof Error ? error.message : '批量插入构建失败'}`,
            },
          ],
          isError: true,
        };
      }

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  error: result.error,
                  insertedCount: result.successCount,
                  failedCount: result.errorCount,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                table,
                totalRecords: records.length,
                insertedCount: result.successCount,
                firstInsertId: result.results[0]?.insertId,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
