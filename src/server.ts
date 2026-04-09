/**
 * MCP Server 配置和工具注册
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerQueryTools } from './tools/query.js';
import { registerModifyTools } from './tools/modify.js';
import { registerSchemaTools } from './tools/schema.js';
import { registerBatchTools } from './tools/batch.js';
import { registerDDLTools } from './tools/ddl.js';
import { registerConnectionTools } from './tools/connections.js';
import { registerOpsTools } from './tools/ops.js';
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
  registerConnectionTools(server);
  registerOpsTools(server);
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
元数据: test_connection use_database show_databases list_tables describe_table show_indexes show_create_table list_connections use_connection
安全: 参数化; DELETE/UPDATE须WHERE; 拒 TRUNCATE/DROP/ALTER; MYSQL_READONLY
EXPLAIN: explain_query 附告警行; 多连接: list_connections use_connection + MYSQL_MCP_EXTRA_CONNECTIONS
运维(可选): MYSQL_MCP_OPS_TOOLS process_list slow_query_status; MYSQL_MCP_KILL_QUERY kill_query; MYSQL_MCP_READ_AUDIT_TOOL read_audit_log; MYSQL_MCP_READ_SLOW_LOG read_slow_query_log
只读加固: MYSQL_READONLY 时会话 transaction_read_only; 校验额外库: MYSQL_MCP_VALIDATE_EXTRA_CONNECTIONS
提示: MCP_QUERY_RESULT_HINT query 体积; MYSQL_MCP_EXPLAIN_JSON explain JSON 告警`;
}
