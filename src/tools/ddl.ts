/**
 * 受控 DDL 工具 — 仅限建表，只读模式下禁用
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getPool, isReadOnly, isDebugMode } from '../db/connection.js';
import { validateIdentifier, escapeIdentifier } from '../db/executor.js';
import { auditLog } from '../audit.js';

export function registerDDLTools(server: McpServer): void {
  server.tool(
    'create_table',
    '创建新表（只读模式下禁用）',
    {
      table: z.string().describe('表名'),
      columns: z
        .array(
          z.object({
            name: z.string().describe('字段名'),
            type: z.string().describe('字段类型，如 INT、VARCHAR(255)、TEXT'),
            primaryKey: z.boolean().optional().describe('是否为主键'),
            autoIncrement: z.boolean().optional().describe('是否自增'),
            nullable: z.boolean().optional().describe('是否允许 NULL，默认 true'),
            defaultValue: z.string().optional().describe('默认值'),
            comment: z.string().optional().describe('字段注释'),
          })
        )
        .min(1)
        .describe('字段定义列表'),
      comment: z.string().optional().describe('表注释'),
      engine: z.string().optional().describe('存储引擎，默认 InnoDB'),
      charset: z.string().optional().describe('字符集，默认 utf8mb4'),
    },
    async ({ table, columns, comment, engine, charset }) => {
      if (isReadOnly()) {
        return {
          content: [{ type: 'text', text: '错误：当前处于只读模式，禁止执行 DDL 操作' }],
          isError: true,
        };
      }

      const tableErr = validateIdentifier(table, '表名');
      if (tableErr) {
        return {
          content: [{ type: 'text', text: `错误：${tableErr}` }],
          isError: true,
        };
      }

      for (const col of columns) {
        const colErr = validateIdentifier(col.name, `字段名 ${col.name}`);
        if (colErr) {
          return {
            content: [{ type: 'text', text: `错误：${colErr}` }],
            isError: true,
          };
        }
      }

      const colDefs = columns.map((col) => {
        const parts: string[] = [escapeIdentifier(col.name), col.type];
        if (col.primaryKey) parts.push('PRIMARY KEY');
        if (col.autoIncrement) parts.push('AUTO_INCREMENT');
        if (col.nullable === false) parts.push('NOT NULL');
        if (col.defaultValue !== undefined) parts.push(`DEFAULT ${col.defaultValue}`);
        if (col.comment) parts.push(`COMMENT '${col.comment.replace(/'/g, "''")}'`);
        return parts.join(' ');
      });

      const tableOptions: string[] = [];
      tableOptions.push(`ENGINE=${engine || 'InnoDB'}`);
      tableOptions.push(`DEFAULT CHARSET=${charset || 'utf8mb4'}`);
      if (comment) tableOptions.push(`COMMENT='${comment.replace(/'/g, "''")}'`);

      const sql = `CREATE TABLE ${escapeIdentifier(table)} (\n  ${colDefs.join(',\n  ')}\n) ${tableOptions.join(' ')}`;

      const startTime = Date.now();
      try {
        const pool = getPool();
        await pool.execute(sql);
        const executionTime = Date.now() - startTime;
        auditLog({ sql, success: true, executionTime });

        const response: Record<string, unknown> = { table, columnsCount: columns.length };
        if (isDebugMode()) response.executionTime = `${executionTime}ms`;
        response.sql = sql;

        return {
          content: [{ type: 'text', text: JSON.stringify(response) }],
        };
      } catch (error) {
        const executionTime = Date.now() - startTime;
        const errorMsg = error instanceof Error ? error.message : '未知错误';
        auditLog({ sql, success: false, error: errorMsg, executionTime });
        return {
          content: [{ type: 'text', text: `建表失败：${errorMsg}` }],
          isError: true,
        };
      }
    }
  );
}
