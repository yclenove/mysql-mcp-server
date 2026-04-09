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
import { isDatabaseOnAllowlist, filterShowDatabasesRows } from '../db/allowlist.js';
import { auditLog } from '../audit.js';

/**
 * 注册元数据相关工具
 */
export function registerSchemaTools(server: McpServer): void {
  server.registerTool(
    'test_connection',
    { description: 'Ping；返回 version/latency' },
    async (_extra) => {
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

  server.registerTool(
    'use_database',
    {
      description: 'USE 切换库',
      inputSchema: {
        database: z.string().describe('库名'),
      },
    },
    async ({ database }, _extra) => {
      const err = validateIdentifier(database, '数据库名');
      if (err) {
        return {
          content: [{ type: 'text', text: `错误：${err}` }],
          isError: true,
        };
      }

      if (!isDatabaseOnAllowlist(database)) {
        return {
          content: [
            {
              type: 'text',
              text: `错误：数据库「${database}」不在 MYSQL_DATABASE_ALLOWLIST 白名单中`,
            },
          ],
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

  server.registerTool('show_databases', { description: 'SHOW DATABASES' }, async (_extra) => {
    const result = await listDatabases();

    if (!result.success) {
      return {
        content: [{ type: 'text', text: `错误：${result.error}` }],
        isError: true,
      };
    }

    const rows = filterShowDatabasesRows(result.data || []);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(rows.map((row: any) => row.Database)),
        },
      ],
    };
  });

  server.registerTool(
    'list_tables',
    {
      description: '表列表+行数等元数据',
      inputSchema: {
        database: z.string().optional().describe('库名，缺省用 MYSQL_DATABASE'),
      },
    },
    async ({ database }, _extra) => {
      if (database && !isDatabaseOnAllowlist(database)) {
        return {
          content: [
            {
              type: 'text',
              text: `错误：数据库「${database}」不在 MYSQL_DATABASE_ALLOWLIST 白名单中`,
            },
          ],
          isError: true,
        };
      }

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

  server.registerTool(
    'describe_table',
    {
      description: '列结构（类型/主键/可空）',
      inputSchema: {
        table: z.string().describe('表名'),
      },
    },
    async ({ table }, _extra) => {
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

  server.registerTool(
    'show_indexes',
    {
      description: 'SHOW INDEX',
      inputSchema: {
        table: z.string().describe('表名'),
      },
    },
    async ({ table }, _extra) => {
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

  server.registerTool(
    'show_create_table',
    {
      description: 'SHOW CREATE TABLE',
      inputSchema: {
        table: z.string().describe('表名'),
      },
    },
    async ({ table }, _extra) => {
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
