/**
 * 可选运维工具（MYSQL_MCP_OPS_TOOLS 等开关）
 */
import { closeSync, openSync, readFileSync, readSync, statSync } from 'fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { executeQuery } from '../db/executor.js';
import { ExecutionMode } from '../types/index.js';
import { isReadOnly } from '../db/connection.js';

const AUDIT_TAIL_MAX = 500;
const AUDIT_TAIL_DEFAULT = 50;
const AUDIT_TAIL_CHUNK = 512 * 1024;

function opsEnabled(): boolean {
  return process.env.MYSQL_MCP_OPS_TOOLS === 'true';
}

function killQueryEnabled(): boolean {
  return process.env.MYSQL_MCP_KILL_QUERY === 'true';
}

function readAuditEnabled(): boolean {
  return process.env.MYSQL_MCP_READ_AUDIT_TOOL === 'true' && !!process.env.MCP_AUDIT_LOG?.trim();
}

function readSlowLogEnabled(): boolean {
  return (
    process.env.MYSQL_MCP_READ_SLOW_LOG === 'true' && !!process.env.MYSQL_MCP_SLOW_LOG_PATH?.trim()
  );
}

function getProcessListMaxRows(): number {
  const n = parseInt(process.env.MYSQL_MCP_PROCESS_LIST_MAX || '100', 10);
  if (!Number.isFinite(n) || n < 1) {
    return 100;
  }
  return Math.min(n, 5000);
}

function readAuditTailLines(path: string, maxLines: number): string {
  const st = statSync(path);
  if (st.size <= AUDIT_TAIL_CHUNK) {
    const text = readFileSync(path, 'utf-8');
    return text.split(/\r?\n/).slice(-maxLines).join('\n');
  }
  const fd = openSync(path, 'r');
  try {
    const start = Math.max(0, st.size - AUDIT_TAIL_CHUNK);
    const len = st.size - start;
    const buf = Buffer.alloc(len);
    readSync(fd, buf, 0, len, start);
    const text = buf.toString('utf-8');
    return text.split(/\r?\n/).slice(-maxLines).join('\n');
  } finally {
    closeSync(fd);
  }
}

export function registerOpsTools(server: McpServer): void {
  if (opsEnabled()) {
    server.registerTool(
      'process_list',
      {
        description:
          'SHOW FULL PROCESSLIST（行数上限 MYSQL_MCP_PROCESS_LIST_MAX，默认 100）；需 PROCESS 权限',
      },
      async (_extra) => {
        const maxRows = getProcessListMaxRows();
        const result = await executeQuery('SHOW FULL PROCESSLIST', [], ExecutionMode.READONLY);
        if (!result.success) {
          return {
            content: [{ type: 'text', text: `错误：${result.error}` }],
            isError: true,
          };
        }
        const data = result.data || [];
        const rows = data.slice(0, maxRows);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                rows,
                maxRows,
                truncated: data.length > maxRows,
              }),
            },
          ],
        };
      }
    );

    server.registerTool(
      'slow_query_status',
      {
        description: '慢查询相关变量（slow_query%、long_query%）',
      },
      async (_extra) => {
        const a = await executeQuery(
          `SHOW VARIABLES LIKE 'slow_query%'`,
          [],
          ExecutionMode.READONLY
        );
        const b = await executeQuery(
          `SHOW VARIABLES LIKE 'long_query%'`,
          [],
          ExecutionMode.READONLY
        );
        if (!a.success) {
          return {
            content: [{ type: 'text', text: `错误：${a.error}` }],
            isError: true,
          };
        }
        if (!b.success) {
          return {
            content: [{ type: 'text', text: `错误：${b.error}` }],
            isError: true,
          };
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                slow_query: a.data || [],
                long_query: b.data || [],
              }),
            },
          ],
        };
      }
    );
  }

  if (killQueryEnabled()) {
    server.registerTool(
      'kill_query',
      {
        description: 'KILL QUERY（仅终止语句，需 PROCESS；MYSQL_READONLY 时禁用）',
        inputSchema: {
          thread_id: z.number().int().positive().describe('连接线程 ID（SHOW PROCESSLIST 的 Id）'),
        },
      },
      async ({ thread_id }, _extra) => {
        if (isReadOnly()) {
          return {
            content: [{ type: 'text', text: '错误：只读模式下不允许执行 KILL QUERY' }],
            isError: true,
          };
        }
        const tid = Math.floor(thread_id);
        const result = await executeQuery(`KILL QUERY ${tid}`, [], ExecutionMode.READWRITE);
        if (!result.success) {
          return {
            content: [{ type: 'text', text: `错误：${result.error}` }],
            isError: true,
          };
        }
        return {
          content: [{ type: 'text', text: JSON.stringify({ ok: true, thread_id: tid }) }],
        };
      }
    );
  }

  if (readAuditEnabled()) {
    server.registerTool(
      'read_audit_log',
      {
        description: `读取 MCP_AUDIT_LOG 文件尾部（默认 ${AUDIT_TAIL_DEFAULT} 行，最大 ${AUDIT_TAIL_MAX}）`,
        inputSchema: {
          lines: z.number().int().min(1).max(AUDIT_TAIL_MAX).optional().describe('行数'),
        },
      },
      async ({ lines }, _extra) => {
        const path = process.env.MCP_AUDIT_LOG!.trim();
        const n = Math.min(lines ?? AUDIT_TAIL_DEFAULT, AUDIT_TAIL_MAX);
        try {
          const tail = readAuditTailLines(path, n);
          return {
            content: [{ type: 'text', text: tail }],
          };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return {
            content: [{ type: 'text', text: `读取失败：${msg}` }],
            isError: true,
          };
        }
      }
    );
  }

  if (readSlowLogEnabled()) {
    server.registerTool(
      'read_slow_query_log',
      {
        description: `读取 MYSQL_MCP_SLOW_LOG_PATH 慢日志文件尾部（默认 ${AUDIT_TAIL_DEFAULT} 行，最大 ${AUDIT_TAIL_MAX}）`,
        inputSchema: {
          lines: z.number().int().min(1).max(AUDIT_TAIL_MAX).optional().describe('行数'),
        },
      },
      async ({ lines }, _extra) => {
        const path = process.env.MYSQL_MCP_SLOW_LOG_PATH!.trim();
        const n = Math.min(lines ?? AUDIT_TAIL_DEFAULT, AUDIT_TAIL_MAX);
        try {
          const tail = readAuditTailLines(path, n);
          return {
            content: [{ type: 'text', text: tail }],
          };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return {
            content: [{ type: 'text', text: `读取失败：${msg}` }],
            isError: true,
          };
        }
      }
    );
  }
}
