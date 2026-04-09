/**
 * 多 DSN：列举与切换活动连接
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  getActiveConnectionId,
  listConnectionDescriptors,
  setActiveConnectionId,
} from '../db/connection.js';

export function registerConnectionTools(server: McpServer): void {
  server.registerTool(
    'list_connections',
    {
      description: '列出已配置的连接 id、host、port、database（无密码）',
    },
    async (_extra) => {
      const list = listConnectionDescriptors();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ connections: list, active: getActiveConnectionId() }),
          },
        ],
      };
    }
  );

  server.registerTool(
    'use_connection',
    {
      description:
        '切换活动连接（MYSQL_MCP_CONNECTION_ID）；需先在 MYSQL_MCP_EXTRA_CONNECTIONS 配置额外 DSN',
      inputSchema: {
        connection_id: z.string().describe('连接 id，如 default 或自定义 id'),
      },
    },
    async ({ connection_id }, _extra) => {
      const r = setActiveConnectionId(connection_id);
      if (!r.ok) {
        return {
          content: [{ type: 'text', text: `错误：${r.error}` }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ connectionId: getActiveConnectionId(), switched: true }),
          },
        ],
      };
    }
  );
}
