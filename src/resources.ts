/**
 * MCP Resources — 暴露数据库 schema 供 LLM 自动发现
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listTables, describeTable, listDatabases } from './db/executor.js';
import { getPool, isReadOnly } from './db/connection.js';

/**
 * 注册 MCP Resources
 */
export function registerResources(server: McpServer): void {
  server.resource(
    'schema-overview',
    'mysql://schema/overview',
    { description: '当前数据库的所有表及其结构概览' },
    async () => {
      const tablesResult = await listTables();
      if (!tablesResult.success || !tablesResult.data) {
        return {
          contents: [
            {
              uri: 'mysql://schema/overview',
              mimeType: 'text/plain',
              text: `无法获取表列表：${tablesResult.error || '未知错误'}`,
            },
          ],
        };
      }

      const tableNames = tablesResult.data.map((t: any) => t.name).filter(Boolean);

      const sections: string[] = [];
      sections.push(`数据库: ${process.env.MYSQL_DATABASE || '(默认)'}`);
      sections.push(`共 ${tableNames.length} 张表\n`);

      for (const tableName of tableNames) {
        const cols = await describeTable(tableName);
        if (cols.success && cols.data) {
          const colList = cols.data
            .map((c: any) => {
              const pk = c.isPrimaryKey === 1 ? ' [PK]' : '';
              const ai = c.isAutoIncrement === 1 ? ' AUTO_INCREMENT' : '';
              const comment = c.comment ? ` -- ${c.comment}` : '';
              return `  ${c.name} ${c.type}${pk}${ai}${comment}`;
            })
            .join('\n');
          sections.push(`表 ${tableName}:\n${colList}`);
        }
      }

      return {
        contents: [
          {
            uri: 'mysql://schema/overview',
            mimeType: 'text/plain',
            text: sections.join('\n\n'),
          },
        ],
      };
    }
  );

  server.resource(
    'table-schema',
    new ResourceTemplate('mysql://schema/table/{tableName}', { list: undefined }),
    { description: '指定表的详细结构' },
    async (uri, { tableName }) => {
      const table = Array.isArray(tableName) ? tableName[0] : tableName;
      if (!table) {
        return {
          contents: [
            {
              uri: uri.toString(),
              mimeType: 'text/plain',
              text: '错误：未指定表名',
            },
          ],
        };
      }

      const result = await describeTable(table);
      if (!result.success) {
        return {
          contents: [
            {
              uri: uri.toString(),
              mimeType: 'text/plain',
              text: `错误：${result.error}`,
            },
          ],
        };
      }

      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify(result.data),
          },
        ],
      };
    }
  );

  server.resource(
    'pool-status',
    'mysql://status/pool',
    { description: '连接池状态：活跃连接、空闲连接、等待队列' },
    async () => {
      try {
        const pool = getPool();
        const p = pool.pool as any;
        const status = {
          activeConnections: p._allConnections?.length ?? 0,
          idleConnections: p._freeConnections?.length ?? 0,
          waitingRequests: p._connectionQueue?.length ?? 0,
          connectionLimit: p.config?.connectionLimit ?? 0,
          readonlyMode: isReadOnly(),
          database: process.env.MYSQL_DATABASE || '(未指定)',
        };
        return {
          contents: [
            {
              uri: 'mysql://status/pool',
              mimeType: 'application/json',
              text: JSON.stringify(status),
            },
          ],
        };
      } catch (error) {
        return {
          contents: [
            {
              uri: 'mysql://status/pool',
              mimeType: 'text/plain',
              text: `无法获取连接池状态：${error instanceof Error ? error.message : '未知错误'}`,
            },
          ],
        };
      }
    }
  );

  server.resource('databases', 'mysql://databases', { description: '所有数据库列表' }, async () => {
    const result = await listDatabases();
    if (!result.success) {
      return {
        contents: [
          {
            uri: 'mysql://databases',
            mimeType: 'text/plain',
            text: `错误：${result.error}`,
          },
        ],
      };
    }

    const dbNames = result.data?.map((r: any) => r.Database) || [];
    return {
      contents: [
        {
          uri: 'mysql://databases',
          mimeType: 'application/json',
          text: JSON.stringify(dbNames),
        },
      ],
    };
  });
}
