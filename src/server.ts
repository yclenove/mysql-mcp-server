/**
 * MCP Server 配置和工具注册
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerQueryTools } from './tools/query.js';
import { registerModifyTools } from './tools/modify.js';
import { registerSchemaTools } from './tools/schema.js';
import { registerBatchTools } from './tools/batch.js';
import { registerDDLTools } from './tools/ddl.js';
import { registerResources } from './resources.js';
import { registerPrompts } from './prompts.js';
import packageJson from '../package.json' with { type: 'json' };

/**
 * 创建并配置 MCP Server
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: 'mysql-mcp-server',
    version: packageJson.version,
  });

  registerQueryTools(server);
  registerModifyTools(server);
  registerSchemaTools(server);
  registerBatchTools(server);
  registerDDLTools(server);
  registerResources(server);
  registerPrompts(server);

  return server;
}

/**
 * 获取工具列表说明
 */
export function getToolsDescription(): string {
  return `MySQL MCP 工具（短览）：
查询: query(只读+?参数+limit/page) explain_query(SELECT计划)
写入: insert update delete(须WHERE) call_procedure
批量: batch_execute batch_insert(事务 ≤50)
DDL: create_table(只读禁)
元数据: test_connection use_database show_databases list_tables describe_table show_indexes show_create_table
安全: 参数化; DELETE/UPDATE须WHERE; 拒 TRUNCATE/DROP/ALTER; MYSQL_READONLY`;
}
