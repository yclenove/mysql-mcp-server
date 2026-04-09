/**
 * 查询类工具 - SELECT/SHOW/DESCRIBE
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { executeQuery, isReadOnlyQuery } from '../db/executor.js';
import { ExecutionMode } from '../types/index.js';
import { isDebugMode } from '../db/connection.js';

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
    },
    async ({ sql, params = [] }) => {
      if (!isReadOnlyQuery(sql)) {
        return {
          content: [{ type: 'text', text: '错误：此工具只允许执行 SELECT/SHOW/DESCRIBE 查询' }],
          isError: true,
        };
      }

      const result = await executeQuery(sql, params, ExecutionMode.READONLY);

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
}
