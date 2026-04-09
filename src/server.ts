/**
 * MCP Server 配置和工具注册
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerQueryTools } from './tools/query.js';
import { registerModifyTools } from './tools/modify.js';
import { registerSchemaTools } from './tools/schema.js';
import { registerBatchTools } from './tools/batch.js';
import packageJson from '../package.json' with { type: 'json' };

/**
 * 创建并配置 MCP Server
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: 'mysql-mcp-server',
    version: packageJson.version,
  });

  // 注册各类工具
  registerQueryTools(server);
  registerModifyTools(server);
  registerSchemaTools(server);
  registerBatchTools(server);

  return server;
}

/**
 * 获取工具列表说明
 */
export function getToolsDescription(): string {
  return `
MySQL MCP Server 提供的工具列表：

【查询类】
- select: 执行 SELECT 查询
- query: 等同于 select

【修改类】
- insert: 执行 INSERT 插入
- update: 执行 UPDATE 更新
- delete: 执行 DELETE 删除
- execute: 通用执行（INSERT/UPDATE/DELETE）

【批量操作】
- batch_execute: 批量执行 SQL（自动事务）
- batch_query: 批量查询（只读）
- batch_insert: 批量插入

【元数据】
- show_databases: 获取所有数据库
- list_tables: 获取表列表
- describe_table: 获取表结构
- show_indexes: 获取表索引
- show_create_table: 获取建表语句

【安全特性】
- 支持参数化查询防止 SQL 注入
- DELETE/UPDATE 无 WHERE 条件时拒绝执行
- 支持只读模式（MYSQL_READONLY=true）
`;
}
