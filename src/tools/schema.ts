/**
 * 元数据相关工具 - 表结构、数据库列表等
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  listDatabases,
  listTables,
  describeTable,
  showIndexes,
  showCreateTable,
} from '../db/executor.js';

/**
 * 注册元数据相关工具
 */
export function registerSchemaTools(server: McpServer): void {
  server.tool('show_databases', '列出所有数据库', {}, async () => {
    const result = await listDatabases();

    if (!result.success) {
      return {
        content: [{ type: 'text', text: `错误：${result.error}` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result.data?.map((row: any) => row.Database) || []),
        },
      ],
    };
  });

  server.tool(
    'list_tables',
    '列出指定数据库中的所有表',
    {
      database: z.string().optional().describe('数据库名，不指定则使用默认'),
    },
    async ({ database }) => {
      const result = await listTables(database);

      if (!result.success) {
        return {
          content: [{ type: 'text', text: `错误：${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result.data || []) }],
      };
    }
  );

  server.tool(
    'describe_table',
    '获取表的字段结构（名称、类型、主键等）',
    {
      table: z.string().describe('表名'),
    },
    async ({ table }) => {
      const result = await describeTable(table);

      if (!result.success) {
        return {
          content: [{ type: 'text', text: `错误：${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result.data || []) }],
      };
    }
  );

  server.tool(
    'show_indexes',
    '获取表的索引信息',
    {
      table: z.string().describe('表名'),
    },
    async ({ table }) => {
      const result = await showIndexes(table);

      if (!result.success) {
        return {
          content: [{ type: 'text', text: `错误：${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result.data || []) }],
      };
    }
  );

  server.tool(
    'show_create_table',
    '获取表的建表 SQL 语句',
    {
      table: z.string().describe('表名'),
    },
    async ({ table }) => {
      const result = await showCreateTable(table);

      if (!result.success) {
        return {
          content: [{ type: 'text', text: `错误：${result.error}` }],
          isError: true,
        };
      }

      const row = result.data?.[0] as any;
      return {
        content: [
          {
            type: 'text',
            text: row?.['Create Table'] || row?.['Create View'] || '无创建语句',
          },
        ],
      };
    }
  );
}
