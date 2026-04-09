/**
 * MCP Prompts — 预置 Prompts 引导 LLM 使用工具
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerPrompts(server: McpServer): void {
  server.prompt(
    'analyze-table',
    '分析指定表的结构、索引和数据分布，给出优化建议',
    { table: z.string().describe('要分析的表名') },
    async ({ table }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              `请分析表 \`${table}\` 的结构和性能，按以下步骤操作：`,
              '',
              '1. 使用 `describe_table` 获取表结构',
              '2. 使用 `show_indexes` 查看索引',
              '3. 使用 `show_create_table` 查看建表语句',
              `4. 使用 \`query\` 执行 \`SELECT COUNT(*) FROM ${table}\` 了解数据量`,
              '',
              '然后根据结果给出以下分析：',
              '- 字段类型是否合理',
              '- 索引是否充分（是否有缺失索引或冗余索引）',
              '- 是否存在可优化的设计（如过长的 VARCHAR、缺少注释等）',
              '- 给出具体的优化建议（ALTER 语句或索引建议）',
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.prompt(
    'generate-query',
    '根据自然语言描述生成 SQL 查询',
    {
      description: z.string().describe('用自然语言描述你想查询的内容'),
      tables: z.string().optional().describe('涉及的表名（逗号分隔），不指定则自动发现'),
    },
    async ({ description, tables }) => {
      const tableHint = tables
        ? `涉及的表：${tables}`
        : '请先使用 `list_tables` 查看可用表，再使用 `describe_table` 了解相关表的结构';

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                `请根据以下需求生成 SQL 查询：`,
                '',
                `需求：${description}`,
                '',
                tableHint,
                '',
                '要求：',
                '1. 使用参数化查询（? 占位符）防止 SQL 注入',
                '2. 生成查询后使用 `query` 工具执行并展示结果',
                '3. 如果查询可能返回大量数据，添加合理的 LIMIT',
                '4. 解释查询逻辑和各部分的作用',
              ].join('\n'),
            },
          },
        ],
      };
    }
  );

  server.prompt(
    'optimize-query',
    '分析并优化一条 SQL 查询的性能',
    { sql: z.string().describe('要优化的 SQL 查询语句') },
    async ({ sql }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              '请分析并优化以下 SQL 查询：',
              '',
              '```sql',
              sql,
              '```',
              '',
              '步骤：',
              '1. 使用 `explain_query` 分析执行计划',
              '2. 检查涉及表的索引（`show_indexes`）',
              '3. 根据执行计划识别性能瓶颈（全表扫描、临时表、文件排序等）',
              '',
              '输出：',
              '- 执行计划解读',
              '- 识别的问题',
              '- 优化后的 SQL（如有改进）',
              '- 建议添加的索引（给出 CREATE INDEX 语句）',
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.prompt('data-overview', '快速概览数据库内容：表、数据量、最近的数据', {}, async () => ({
    messages: [
      {
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: [
            '请概览当前数据库的整体情况：',
            '',
            '1. 使用 `list_tables` 获取所有表及其行数',
            '2. 对于每个表，使用 `query` 查看最近 3 条数据（按主键倒序）',
            '3. 汇总以下信息：',
            '   - 表总数',
            '   - 各表的行数和大小',
            '   - 各表的用途（根据表名和字段推断）',
            '   - 表之间可能的关联关系（通过外键命名推断）',
          ].join('\n'),
        },
      },
    ],
  }));
}
