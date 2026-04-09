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

/**
 * 注册查询类工具
 */
export function registerQueryTools(server: McpServer): void {
  server.tool(
    'query',
    '执行只读查询（SELECT/SHOW/DESCRIBE/EXPLAIN），支持参数化查询',
    {
      sql: z.string().describe('SQL 查询语句'),
      params: z.array(z.any()).optional().describe('查询参数'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(10000)
        .optional()
        .describe('限制返回行数，覆盖服务器默认值'),
    },
    async ({ sql, params = [], limit }) => {
      if (!isReadOnlyQuery(sql)) {
        return {
          content: [{ type: 'text', text: '错误：此工具只允许执行 SELECT/SHOW/DESCRIBE 查询' }],
          isError: true,
        };
      }

      const result = await executeQuery(sql, params, ExecutionMode.READONLY, limit);

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

  server.tool(
    'explain_query',
    '分析 SQL 查询的执行计划（EXPLAIN），用于性能优化',
    {
      sql: z.string().describe('要分析的 SELECT 查询语句'),
    },
    async ({ sql }) => {
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
