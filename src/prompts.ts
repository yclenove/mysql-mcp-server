/**
 * MCP Prompts — 预置 Prompts 引导 LLM 使用工具
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    'analyze-table',
    {
      description: '表结构/索引/行数分析与优化建议',
      argsSchema: { table: z.string().describe('表名') },
    },
    async ({ table }, _extra) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              `分析表 \`${table}\`：依次 describe_table、show_indexes、show_create_table、query 执行 SELECT COUNT(*) FROM \`${table}\`。`,
              '输出：类型与索引问题、冗余/缺失索引、可执行优化（索引/ALTER 建议）。',
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.registerPrompt(
    'generate-query',
    {
      description: '自然语言 → 参数化 SELECT + query 执行',
      argsSchema: {
        description: z.string().describe('需求描述'),
        tables: z.string().optional().describe('表名逗号分隔；缺省则 list_tables+describe_table'),
      },
    },
    async ({ description, tables }, _extra) => {
      const tableHint = tables ? `表：${tables}` : '先 list_tables / describe_table 再写 SQL';

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                `需求：${description}`,
                tableHint,
                '用 ? 参数化；大结果加 LIMIT；写完后 query 执行并简述逻辑。',
              ].join('\n'),
            },
          },
        ],
      };
    }
  );

  server.registerPrompt(
    'optimize-query',
    {
      description: 'EXPLAIN + 索引检查 + 改写建议',
      argsSchema: { sql: z.string().describe('SELECT SQL') },
    },
    async ({ sql }, _extra) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              '优化下列 SQL：',
              '```sql',
              sql,
              '```',
              'explain_query → show_indexes；输出：瓶颈、改写 SQL、CREATE INDEX 建议。',
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.registerPrompt(
    'data-overview',
    { description: '库级：表清单、行数、抽样行' },
    async (_extra) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              'list_tables 看行数；每表 query 取最近 3 行（有主键则倒序主键）。',
              '汇总：表数、用途推断、可能外键关联。',
            ].join('\n'),
          },
        },
      ],
    })
  );
}
