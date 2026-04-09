/**
 * MCP Resources — 暴露数据库 schema 供 LLM 自动发现
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listTables, describeTable, listDatabases } from './db/executor.js';
import { getPool, isReadOnly } from './db/connection.js';
import { filterShowDatabasesRows } from './db/allowlist.js';
import {
  getSchemaOverviewMaxExpandTables,
  splitTablesForSchemaOverview,
  formatTableNamesTail,
  SCHEMA_OVERVIEW_NAMES_TAIL_CAP,
  SCHEMA_OVERVIEW_NAMES_ONLY_CAP,
} from './schemaOverviewLimit.js';

/**
 * 注册 MCP Resources
 */
export function registerResources(server: McpServer): void {
  server.registerResource(
    'schema-overview',
    'mysql://schema/overview',
    {
      description:
        '当前库表与列摘要；表多仅展开前 N 张（MCP_SCHEMA_OVERVIEW_MAX_TABLES，默认 50）；0=仅表名；详单用 schema/table/{name}',
    },
    async (_uri, _extra) => {
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
      const maxExpand = getSchemaOverviewMaxExpandTables();
      const { expand, namesOnly } = splitTablesForSchemaOverview(tableNames, maxExpand);

      const sections: string[] = [];
      sections.push(`数据库: ${process.env.MYSQL_DATABASE || '(默认)'}`);
      if (tableNames.length === 0) {
        sections.push('共 0 张表');
      } else if (maxExpand <= 0) {
        sections.push(`共 ${tableNames.length} 张表（MCP_SCHEMA_OVERVIEW_MAX_TABLES=0，仅表名）`);
      } else if (namesOnly.length === 0) {
        sections.push(`共 ${tableNames.length} 张表`);
      } else {
        sections.push(
          `共 ${tableNames.length} 张表（前 ${expand.length} 张含列，上限 MCP_SCHEMA_OVERVIEW_MAX_TABLES=${maxExpand}）`
        );
      }

      for (const tableName of expand) {
        const cols = await describeTable(tableName);
        if (cols.success && cols.data) {
          const colList = cols.data
            .map((c: any) => {
              const pk = c.isPrimaryKey === 1 ? ' PK' : '';
              const ai = c.isAutoIncrement === 1 ? ' AI' : '';
              return `  ${c.name} ${c.type}${pk}${ai}`;
            })
            .join('\n');
          sections.push(`表 ${tableName}:\n${colList}`);
        }
      }

      if (maxExpand <= 0 && tableNames.length > 0) {
        sections.push(
          `仅表名（未查列）。可调大 MCP_SCHEMA_OVERVIEW_MAX_TABLES 展开前若干张。\n${formatTableNamesTail(tableNames, SCHEMA_OVERVIEW_NAMES_ONLY_CAP)}`
        );
      } else if (namesOnly.length > 0) {
        sections.push(
          `另有 ${namesOnly.length} 张表未展开列：${formatTableNamesTail(namesOnly, SCHEMA_OVERVIEW_NAMES_TAIL_CAP)}`
        );
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

  server.registerResource(
    'table-schema',
    new ResourceTemplate('mysql://schema/table/{tableName}', { list: undefined }),
    { description: '单表列 JSON' },
    async (uri, variables, _extra) => {
      const raw = variables.tableName;
      const table = Array.isArray(raw) ? raw[0] : raw;
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

  server.registerResource(
    'pool-status',
    'mysql://status/pool',
    { description: '连接池队列/连接数' },
    async (_uri, _extra) => {
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

  server.registerResource(
    'databases',
    'mysql://databases',
    { description: '库名 JSON 数组' },
    async (_uri, _extra) => {
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

      const rows = filterShowDatabasesRows(result.data || []);
      const dbNames = rows.map((r: any) => r.Database);
      return {
        contents: [
          {
            uri: 'mysql://databases',
            mimeType: 'application/json',
            text: JSON.stringify(dbNames),
          },
        ],
      };
    }
  );
}
