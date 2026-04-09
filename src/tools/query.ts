/**
 * 查询类工具 - SELECT/SHOW/DESCRIBE
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { executeQuery, isReadOnlyQuery } from '../db/executor.js';
import { ExecutionMode } from '../types/index.js';
import { isDebugMode } from '../db/connection.js';

function formatExplainResult(rows: any[]): string {
  return rows
    .map((row) => {
      const parts: string[] = [];
      if (row.id !== undefined) parts.push(`id=${row.id}`);
      if (row.select_type) parts.push(`type=${row.select_type}`);
      if (row.table) parts.push(`table=${row.table}`);
      if (row.type) parts.push(`access=${row.type}`);
      if (row.key) parts.push(`key=${row.key}`);
      if (row.rows !== undefined) parts.push(`rows=${row.rows}`);
      if (row.filtered !== undefined) parts.push(`filtered=${row.filtered}%`);
      if (row.Extra) parts.push(`extra=${row.Extra}`);
      return parts.join(', ');
    })
    .join('\n');
}

const queryInputSchema = {
  sql: z.string().describe('SQL'),
  params: z.array(z.any()).optional().describe('? 绑定值'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(10000)
    .optional()
    .describe('最大行数，覆盖 MYSQL_MAX_ROWS'),
  page: z.number().int().min(1).optional().describe('页码，从 1'),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .optional()
    .describe('每页行数，默认 20'),
};

/**
 * 注册查询类工具
 */
export function registerQueryTools(server: McpServer): void {
  server.registerTool(
    'query',
    {
      description: '只读 SELECT/SHOW/DESC/EXPLAIN；? 参数；可选 limit 或 page+pageSize',
      inputSchema: queryInputSchema,
    },
    async ({ sql, params = [], limit, page, pageSize }, _extra) => {
      if (!isReadOnlyQuery(sql)) {
        return {
          content: [{ type: 'text', text: '错误：此工具只允许执行 SELECT/SHOW/DESCRIBE 查询' }],
          isError: true,
        };
      }

      let finalSql = sql;
      const finalParams = [...(params || [])];

      if (page !== undefined) {
        const size = pageSize ?? 20;
        const offset = (page - 1) * size;
        finalSql = `${sql.replace(/;\s*$/, '')} LIMIT ${size} OFFSET ${offset}`;
      }

      const result = await executeQuery(finalSql, finalParams, ExecutionMode.READONLY, limit);

      if (!result.success) {
        return {
          content: [{ type: 'text', text: `查询失败：${result.error}` }],
          isError: true,
        };
      }

      const response: Record<string, unknown> = {
        data: result.data || [],
      };
      if (result.truncated) {
        response.totalRows = result.totalRows;
        response.truncated = true;
      }
      if (isDebugMode()) {
        response.executionTime = `${result.executionTime}ms`;
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(response) }],
      };
    }
  );

  server.registerTool(
    'explain_query',
    {
      description: 'EXPLAIN 单条 SELECT',
      inputSchema: {
        sql: z.string().describe('SELECT 语句'),
      },
    },
    async ({ sql }, _extra) => {
      const trimmed = sql.trim().toLowerCase();
      if (!trimmed.startsWith('select')) {
        return {
          content: [{ type: 'text', text: '错误：EXPLAIN 只支持 SELECT 查询语句' }],
          isError: true,
        };
      }

      const result = await executeQuery(`EXPLAIN ${sql}`, [], ExecutionMode.READONLY);

      if (!result.success) {
        return {
          content: [{ type: 'text', text: `分析失败：${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: formatExplainResult(result.data || []),
          },
        ],
      };
    }
  );
}
