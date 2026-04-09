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
  validateIdentifier,
} from '../db/executor.js';
import { getPool, testConnectionWithDetails } from '../db/connection.js';
import { auditLog } from '../audit.js';

/**
 * 注册元数据相关工具
 */
export function registerSchemaTools(server: McpServer): void {
  server.tool(
    'test_connection',
    '测试数据库连接是否正常，返回连接状态和服务器版本',
    {},
    async () => {
      const startTime = Date.now();
      const result = await testConnectionWithDetails();
      const executionTime = Date.now() - startTime;

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                connected: false,
                error: result.error,
                code: result.code,
                latency: `${executionTime}ms`,
              }),
            },
          ],
          isError: true,
        };
      }

      try {
        const pool = getPool();
        const [rows] = await pool.query('SELECT VERSION() AS version');
        const version = Array.isArray(rows) && rows.length > 0 ? (rows[0] as any).version : null;
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                connected: true,
                version,
                database: process.env.MYSQL_DATABASE || null,
                latency: `${executionTime}ms`,
              }),
            },
          ],
        };
      } catch {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ connected: true, latency: `${executionTime}ms` }),
            },
          ],
        };
      }
    }
  );

  server.tool(
    'use_database',
    '切换当前使用的数据库',
    {
      database: z.string().describe('要切换到的数据库名'),
    },
    async ({ database }) => {
      const err = validateIdentifier(database, '数据库名');
      if (err) {
        return {
          content: [{ type: 'text', text: `错误：${err}` }],
          isError: true,
        };
      }

      const startTime = Date.now();
      try {
        const pool = getPool();
        await pool.query(`USE \`${database}\``);
        const executionTime = Date.now() - startTime;
        auditLog({ sql: `USE \`${database}\``, success: true, executionTime });
        process.env.MYSQL_DATABASE = database;
        return {
          content: [{ type: 'text', text: JSON.stringify({ database, switched: true }) }],
        };
      } catch (error) {
        const executionTime = Date.now() - startTime;
        const errorMsg = error instanceof Error ? error.message : '未知错误';
        auditLog({ sql: `USE \`${database}\``, success: false, error: errorMsg, executionTime });
        return {
          content: [{ type: 'text', text: `切换失败：${errorMsg}` }],
          isError: true,
        };
      }
    }
  );

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
