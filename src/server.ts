/**
 * MCP Server 配置和工具注册
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerQueryTools } from './tools/query.js';
import { registerModifyTools } from './tools/modify.js';
import { registerSchemaTools } from './tools/schema.js';
import { registerBatchTools } from './tools/batch.js';
import { registerResources } from './resources.js';
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
  registerResources(server);

  return server;
}

/**
 * 获取工具列表说明
 */
export function getToolsDescription(): string {
  return `
MySQL MCP Server 提供的工具列表：

【查询类】
- query: 执行只读查询（SELECT/SHOW/DESCRIBE/EXPLAIN）
- explain_query: 分析 SQL 查询执行计划

【修改类】
- insert: 执行 INSERT 插入
- update: 执行 UPDATE 更新
- delete: 执行 DELETE 删除

【批量操作】
- batch_execute: 批量执行 SQL（自动事务，失败回滚）
- batch_insert: 批量插入记录

【元数据】
- show_databases: 列出所有数据库
- list_tables: 列出表
- describe_table: 获取表结构
- show_indexes: 获取表索引
- show_create_table: 获取建表语句

【安全特性】
- 参数化查询防 SQL 注入
- DELETE/UPDATE 必须包含 WHERE
- TRUNCATE/DROP/ALTER 拒绝执行
- 只读模式（MYSQL_READONLY=true）
`;
}
