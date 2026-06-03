# MySQL MCP Server

> **Safe, controlled** MySQL access for AI assistants — a production-oriented database tool server built on [MCP](https://modelcontextprotocol.io/)

[![npm version](https://img.shields.io/npm/v/@yclenove/mysql-mcp-server.svg)](https://www.npmjs.com/package/@yclenove/mysql-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/@yclenove/mysql-mcp-server.svg)](https://www.npmjs.com/package/@yclenove/mysql-mcp-server)
[![CI](https://github.com/yclenove/mysql-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/yclenove/mysql-mcp-server/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-green.svg)](https://nodejs.org/)

**[简体中文](./README.md) | English**

---

## Overview

**MySQL MCP Server** is an open-source [Model Context Protocol](https://modelcontextprotocol.io/) server that lets **Cursor, Claude Desktop**, and other AI clients safely query, analyze, and manage MySQL / MariaDB over stdio.

This project is an actively maintained fork of [wenit/mysql-mcp-server](https://github.com/wenit/mysql-mcp-server), extended for **real maintainer workflows**: layered safety, multi-DSN support, EXPLAIN analysis, audit/ops tooling, CI, and unit tests.

|                 |                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------- |
| **npm package** | [`@yclenove/mysql-mcp-server`](https://www.npmjs.com/package/@yclenove/mysql-mcp-server) |
| **Protocol**    | MCP over stdio (JSON-RPC)                                                                |
| **Runtime**     | Node.js ≥ 20                                                                             |
| **License**     | [MIT](./LICENSE)                                                                         |

---

## Why this project

When AI assistants touch databases, the real risks are not connection errors — they are **accidental writes, privilege leaks, token blow-ups, and poor observability**. This server treats those as first-class concerns:

| Capability                     | Description                                                                                                    |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| **Layered safety**             | Parameterized queries · DELETE/UPDATE require WHERE · TRUNCATE/DROP/ALTER blocked · optional DB allowlist      |
| **Read-only defense in depth** | `MYSQL_READONLY=true` — tool-layer rejection + `SET SESSION transaction_read_only = 1` on new pool connections |
| **Ops-ready**                  | Multi-DSN switching · process list · slow-query status · optional audit log and slow-log tail                  |
| **AI-friendly**                | EXPLAIN warnings · schema Resources · query/optimization Prompts · row/schema expansion caps                   |
| **Engineering quality**        | TypeScript · ESLint · Prettier · **10+ unit tests** · GitHub Actions CI                                        |

---

## Quick start

### 1. Install and run

```bash
# Option A: zero install (try it)
npx -y @yclenove/mysql-mcp-server

# Option B: global install
npm install -g @yclenove/mysql-mcp-server
mysql-mcp-server
```

### 2. Configure the database

Create `.env` in your project root (see [`.env.example`](./.env.example)):

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=your_database

# Strongly recommended for production
MYSQL_READONLY=true
```

> Since v1.4.2: when a project-root `.env` exists, `MYSQL_*` keys in that file **override** same-named system env vars — avoiding accidental localhost connections from the AI client shell.

### 3. Connect Cursor

[![Add to Cursor](https://img.shields.io/badge/Add%20to-Cursor-6C47FF?logo=cursor&logoColor=white)](https://cursor.com/en/install-mcp?name=mysql-mcp-server&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkB5Y2xlbm92ZS9teXNxbC1tY3Atc2VydmVyQGxhdGVzdCJdfQ%3D%3D)

If one-click install shows `No tools, prompts, or resources` (some Cursor builds merge `args` into one string), create a local `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "mysql-mcp": {
      "command": "mysql-mcp-server",
      "args": [],
      "env": {}
    }
  }
}
```

Put credentials in project-root `.env`; **do not** embed production passwords in MCP `env`. Full setup: [Client setup](#client-setup).

---

## At a glance

```
┌─────────────────────────────────────────────────────────────┐
│  MCP Client (Cursor / Claude Desktop / Inspector)            │
└───────────────────────────┬─────────────────────────────────┘
                            │ stdio JSON-RPC
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  MySQL MCP Server                                            │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌───────┐ │
│  │ Query   │ │ Modify  │ │ Schema   │ │ Batch   │ │ Ops*  │ │
│  │ EXPLAIN │ │ DDL     │ │ Connect  │ │         │ │ Audit*│ │
│  └─────────┘ └─────────┘ └──────────┘ └─────────┘ └───────┘ │
│  Resources · Prompts · timeout/retry/truncation · guards     │
└───────────────────────────┬─────────────────────────────────┘
                            │ mysql2 pool
                            ▼
                    MySQL / MariaDB
                    * requires explicit env flags
```

- **20+ MCP tools**: query, write, metadata, batch, DDL, multi-DSN, optional ops
- **4 Resources**: `schema/overview`, `schema/table/{name}`, `databases`, `status/pool`
- **4 Prompts**: `analyze-table`, `generate-query`, `optimize-query`, `data-overview`

---

## MCP tool reference

<details>
<summary><strong>Query & analysis</strong></summary>

| Tool            | Description                                                             |
| --------------- | ----------------------------------------------------------------------- |
| `query`         | Read-only SELECT/SHOW/DESCRIBE/EXPLAIN; `?` placeholders and pagination |
| `explain_query` | Execution plan + warnings; optional `MYSQL_MCP_EXPLAIN_JSON`            |

</details>

<details>
<summary><strong>Metadata & connections</strong></summary>

| Tool                                                    | Description                                    |
| ------------------------------------------------------- | ---------------------------------------------- |
| `test_connection`                                       | Ping, version, current connectionId / database |
| `use_database` / `show_databases` / `list_tables`       | DB/table metadata (allowlist-aware)            |
| `describe_table` / `show_indexes` / `show_create_table` | Table details                                  |
| `list_connections` / `use_connection`                   | Multi-DSN management                           |

</details>

<details>
<summary><strong>Write & batch</strong></summary>

| Tool                           | Description                                            |
| ------------------------------ | ------------------------------------------------------ |
| `insert` / `update` / `delete` | Parameterized writes; UPDATE/DELETE must include WHERE |
| `call_procedure`               | Stored procedure calls                                 |
| `batch_execute`                | Transactional batch (max 50 statements)                |
| `batch_insert`                 | Bulk insert (max 50 rows)                              |
| `create_table`                 | DDL (disabled in read-only mode)                       |

</details>

<details>
<summary><strong>Optional ops</strong> (env-gated)</summary>

| Tool                  | Prerequisite                                               |
| --------------------- | ---------------------------------------------------------- |
| `process_list`        | `MYSQL_MCP_OPS_TOOLS=true`                                 |
| `slow_query_status`   | `MYSQL_MCP_OPS_TOOLS=true`                                 |
| `kill_query`          | `MYSQL_MCP_KILL_QUERY=true` (not in read-only mode)        |
| `read_audit_log`      | `MYSQL_MCP_READ_AUDIT_TOOL=true` + `MCP_AUDIT_LOG`         |
| `read_slow_query_log` | `MYSQL_MCP_READ_SLOW_LOG=true` + `MYSQL_MCP_SLOW_LOG_PATH` |

</details>

Manual checklist: [MCP_CURSOR_TEST.md](./MCP_CURSOR_TEST.md) · Agent conventions: [AGENTS.md](./AGENTS.md)

---

## Security model

Designed for scenarios where **AI can make mistakes**:

```
Request → tool-layer checks → executor checks → MySQL session (optional transaction_read_only)
              │                      │
              ├─ read-only block     ├─ DELETE/UPDATE require WHERE
              ├─ dangerous DDL block ├─ identifier validation
              └─ DB allowlist        └─ SQL length / timeout / row caps
```

| Mechanism                 | Behavior                                                       |
| ------------------------- | -------------------------------------------------------------- |
| **Parameterized queries** | All tools use `?` placeholders                                 |
| **WHERE enforcement**     | DELETE/UPDATE without WHERE are rejected                       |
| **DDL guard**             | TRUNCATE / DROP / ALTER blocked by default                     |
| **DB allowlist**          | `MYSQL_DATABASE_ALLOWLIST` limits visible/switchable databases |
| **Read-only mode**        | Tool layer + session `transaction_read_only`                   |
| **Audit**                 | Optional `MCP_AUDIT_LOG` for tool invocations                  |

---

## Configuration

Copy [`.env.example`](./.env.example) and adjust. Common variables:

| Category   | Variable                                                 | Default  | Description                                   |
| ---------- | -------------------------------------------------------- | -------- | --------------------------------------------- |
| Connection | `MYSQL_HOST` / `PORT` / `USER` / `PASSWORD` / `DATABASE` | —        | Basic connection                              |
| Connection | `MYSQL_URL`                                              | —        | `mysql://` URL (alternative to discrete vars) |
| Safety     | `MYSQL_READONLY`                                         | `false`  | Read-only mode                                |
| Safety     | `MYSQL_DATABASE_ALLOWLIST`                               | —        | Comma-separated DB allowlist                  |
| Execution  | `MYSQL_MAX_ROWS`                                         | `100`    | Max rows per response                         |
| Execution  | `MYSQL_QUERY_TIMEOUT`                                    | `30000`  | Query timeout (ms)                            |
| Execution  | `MYSQL_MAX_SQL_LENGTH`                                   | `102400` | Max SQL length                                |
| MCP        | `MCP_SCHEMA_OVERVIEW_MAX_TABLES`                         | `50`     | Resource schema expansion cap                 |
| MCP        | `MCP_AUDIT_LOG`                                          | —        | Audit log path                                |
| Multi-DSN  | `MYSQL_MCP_EXTRA_CONNECTIONS`                            | —        | JSON array of extra DSNs                      |

See [`.env.example`](./.env.example) for the full annotated list.

---

## Client setup

### Cursor

1. Open this repo as the **workspace root** (so `cwd` loads `.env`)
2. Global install: `npm install -g @yclenove/mysql-mcp-server@latest`
3. Create local `.cursor/mcp.json` (not committed; see `.gitignore`)
4. Reload window or enable `mysql-mcp` under **Settings → MCP**

Without global install: `"command": "npx"`, `"args": ["-y", "@yclenove/mysql-mcp-server"]`  
Source debugging: `"command": "node"`, `"args": ["${workspaceFolder}/dist/index.js"]` (run `npm run build` first)

### Claude Desktop

Edit `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/`, Windows: `%APPDATA%/Claude/`):

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["-y", "@yclenove/mysql-mcp-server"],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "root",
        "MYSQL_PASSWORD": "your_password",
        "MYSQL_DATABASE": "your_database",
        "MYSQL_READONLY": "true"
      }
    }
  }
}
```

### Docker

```bash
docker build -t mysql-mcp-server .
docker run -e MYSQL_HOST=host.docker.internal \
           -e MYSQL_USER=root \
           -e MYSQL_PASSWORD=password \
           -e MYSQL_DATABASE=mydb \
           -e MYSQL_READONLY=true \
           mysql-mcp-server
```

---

## Development & contributing

### Run from source

```bash
git clone https://github.com/yclenove/mysql-mcp-server.git
cd mysql-mcp-server
npm install
cp .env.example .env   # edit credentials
npm run build
npm start
```

### Quality gates

CI runs on every PR / push to `main`:

```bash
npm run typecheck
npm run lint
npm run format:check
npm run build
npm test            # 10+ unit tests (node --test)
npm run inspector   # MCP Inspector
```

### Layout

```
src/
├── index.ts              # entry, loads .env
├── server.ts             # MCP server registration
├── resources.ts          # MCP Resources
├── prompts.ts            # MCP Prompts
├── db/
│   ├── connection.ts     # pool, multi-DSN, read-only session
│   ├── executor.ts       # execution, timeout, retry, guards
│   └── allowlist.ts      # DB allowlist
└── tools/                # query · modify · schema · batch · ops · ddl · connections
test/                     # *.test.mjs
```

Read [AGENTS.md](./AGENTS.md) before adding tools, Resources, or Prompts.

Issues and PRs welcome: [github.com/yclenove/mysql-mcp-server/issues](https://github.com/yclenove/mysql-mcp-server/issues)

---

## Troubleshooting

| Symptom                             | Fix                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------- |
| Connection failed                   | Check MySQL, credentials, firewall, `bind-address`                     |
| `.env` loaded but still `127.0.0.1` | v1.4.2+ project `.env` overrides system `MYSQL_*`; verify `MYSQL_HOST` |
| Cursor one-click shows no tools     | Use manual `.cursor/mcp.json` + `mysql-mcp-server`                     |
| Query timeout                       | Increase `MYSQL_QUERY_TIMEOUT`; cap rows with `MYSQL_MAX_ROWS`         |
| Write rejected in read-only mode    | Expected; check `MYSQL_READONLY=true`                                  |

---

## Links

| Doc                                                   | Description                       |
| ----------------------------------------------------- | --------------------------------- |
| [CHANGELOG.md](./CHANGELOG.md)                        | Release history                   |
| [MCP_CURSOR_TEST.md](./MCP_CURSOR_TEST.md)            | Full Cursor manual test checklist |
| [AGENTS.md](./AGENTS.md)                              | Agent extension conventions       |
| [Upstream](https://github.com/wenit/mysql-mcp-server) | Original fork source              |

---

## License

[MIT](./LICENSE) · Copyright (c) 2026 [yclenove](https://github.com/yclenove)
