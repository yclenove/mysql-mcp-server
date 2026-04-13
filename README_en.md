# MySQL MCP Server

[![npm version](https://img.shields.io/npm/v/@yclenove/mysql-mcp-server.svg)](https://www.npmjs.com/package/@yclenove/mysql-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-green.svg)](https://nodejs.org/)

**[简体中文](./README.md) | English**

A MySQL database tool server based on [MCP (Model Context Protocol)](https://modelcontextprotocol.io/), exposing stdio JSON-RPC for Claude, Cursor, and other clients to query and optionally write data safely.

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Quick start](#quick-start)
- [Tools](#tools)
- [Resources and Prompts](#resources-and-prompts)
- [Security and read-only](#security-and-read-only)
- [Configuration](#configuration)
- [Client setup](#client-setup)
- [Local development](#local-development)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [Changelog](#changelog)

---

## Features

- **Tools**: ~**20+** core MCP tools; optional ops / multi-DSN / slow-log tail tools when env vars are set (see [Tools](#tools)).
- **Safety**: parameterized queries; DELETE/UPDATE require WHERE; TRUNCATE/DROP/ALTER blocked; optional `MYSQL_DATABASE_ALLOWLIST`.
- **Read-only**: `MYSQL_READONLY=true` — tool layer + `SET SESSION transaction_read_only = 1` on new connections.
- **Multi-DSN**: `MYSQL_MCP_EXTRA_CONNECTIONS` + `list_connections` / `use_connection`.
- **EXPLAIN**: row-based plan + Chinese warnings; optional `MYSQL_MCP_EXPLAIN_JSON` for `FORMAT=JSON`.
- **Token**: `schema/overview` can cap expanded tables; `MCP_QUERY_RESULT_HINT` adds approximate result size.
- **Audit / ops**: optional audit log, process list, slow-query variables, slow-log file tail (each behind explicit flags).
- **Resources & Prompts**: four Resources and four Prompts (below).

---

## Architecture

```
MCP Client (Claude / Cursor)
    │  stdio JSON-RPC
    ▼
MCP Server (server.ts)
    ├── Query ───────────── query, explain_query
    ├── Modify ──────────── insert, update, delete, call_procedure
    ├── Schema ──────────── test_connection, use_database, show_databases,
    │                        list_tables, describe_table, show_indexes, show_create_table
    ├── Connections ─────── list_connections, use_connection
    ├── Ops (optional) ──── process_list, slow_query_status, kill_query,
    │                        read_audit_log, read_slow_query_log
    ├── Batch ───────────── batch_execute, batch_insert
    ├── DDL ─────────────── create_table
    ├── Resources ───────── schema/overview, schema/table/{name},
    │                      databases, status/pool
    └── Prompts ─────────── analyze-table, generate-query, optimize-query, data-overview
    ▼
Executor (executor.ts) ← timeout / retry / guards / audit
    ▼
Connection pool (connection.ts) ← multi-pool, read-only session, mysql2
    ▼
MySQL / MariaDB
```

---

## Quick start

### npx (recommended)

```bash
npx -y @yclenove/mysql-mcp-server
```

### Global install

```bash
npm install -g @yclenove/mysql-mcp-server
mysql-mcp-server
```

### From source

```bash
git clone https://github.com/yclenove/mysql-mcp-server.git
cd mysql-mcp-server
npm install
npm run build
npm start
```

### Publish / rename package

The published name comes from `package.json` → `name` (currently `@yclenove/mysql-mcp-server`). You need scope permission to publish; to use another username, change `name` and run `npm publish --access public`, then update client `npx` args.

**GitHub Actions (`npm error code EOTP`)**: use a **Granular** or **Automation** npm token in secret `NPM_TOKEN`. See comments at the top of `.github/workflows/publish.yml`.

---

## Tools

### Query and analysis

| Tool            | Description                                                                            | Parameters                                       |
| --------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `query`         | Read-only SELECT/SHOW/DESCRIBE/EXPLAIN; `?` placeholders; `limit` or `page`+`pageSize` | `sql`, `params?`, `limit?`, `page?`, `pageSize?` |
| `explain_query` | Execution plan; row EXPLAIN + warnings; `MYSQL_MCP_EXPLAIN_JSON=true` uses FORMAT=JSON | `sql`                                            |

### Metadata and connections

| Tool                | Description                                      | Parameters      |
| ------------------- | ------------------------------------------------ | --------------- |
| `test_connection`   | Ping, version, current `connectionId` / database | —               |
| `use_database`      | `USE` database (allowlist applies)               | `database`      |
| `show_databases`    | List databases (filtered by allowlist)           | —               |
| `list_tables`       | Tables with metadata                             | `database?`     |
| `describe_table`    | Column structure                                 | `table`         |
| `show_indexes`      | Indexes                                          | `table`         |
| `show_create_table` | DDL                                              | `table`         |
| `list_connections`  | Configured connection ids (no passwords)         | —               |
| `use_connection`    | Switch active connection                         | `connection_id` |

### Writes and batch

| Tool                           | Description                                | Parameters              |
| ------------------------------ | ------------------------------------------ | ----------------------- |
| `insert` / `update` / `delete` | Parameterized; UPDATE/DELETE require WHERE | `sql`, `params?`        |
| `call_procedure`               | Stored procedure                           | `procedure`, `params?`  |
| `batch_execute`                | Transactional batch, max 50 statements     | `statements[]`          |
| `batch_insert`                 | Batch insert, max 50 rows                  | `table`, `records[]`    |
| `create_table`                 | DDL (disabled when read-only)              | `table`, `columns[]`, … |

### Optional ops (env required)

| Tool                  | Prerequisites                                                    |
| --------------------- | ---------------------------------------------------------------- |
| `process_list`        | `MYSQL_MCP_OPS_TOOLS=true`; row cap `MYSQL_MCP_PROCESS_LIST_MAX` |
| `slow_query_status`   | `MYSQL_MCP_OPS_TOOLS=true`                                       |
| `kill_query`          | `MYSQL_MCP_KILL_QUERY=true`; not allowed when `MYSQL_READONLY`   |
| `read_audit_log`      | `MYSQL_MCP_READ_AUDIT_TOOL=true` and `MCP_AUDIT_LOG`             |
| `read_slow_query_log` | `MYSQL_MCP_READ_SLOW_LOG=true` and `MYSQL_MCP_SLOW_LOG_PATH`     |

---

## Resources and Prompts

### MCP Resources

| URI                                | Description                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| `mysql://schema/overview`          | Table/column summary; large schemas: limit with `MCP_SCHEMA_OVERVIEW_MAX_TABLES` |
| `mysql://schema/table/{tableName}` | Single-table columns (JSON)                                                      |
| `mysql://databases`                | Database names (JSON array, allowlist filtered)                                  |
| `mysql://status/pool`              | Pool status                                                                      |

### MCP Prompts

| Prompt           | Description                                       |
| ---------------- | ------------------------------------------------- |
| `analyze-table`  | Structure, indexes, row counts                    |
| `generate-query` | Natural language → parameterized SELECT + `query` |
| `optimize-query` | EXPLAIN + index and rewrite hints                 |
| `data-overview`  | Database-level overview                           |

Manual checklist: [MCP_CURSOR_TEST.md](./MCP_CURSOR_TEST.md).

---

## Security and read-only

- **Parameterized** execution for all tools.
- **Dangerous SQL**: DELETE/UPDATE need WHERE; TRUNCATE/DROP/ALTER blocked.
- **`MYSQL_READONLY=true`**: (1) write tools rejected; (2) batch filters non-read-only; (3) executor validation; (4) new connections run `SET SESSION transaction_read_only = 1` (MySQL 5.6+ / MariaDB 10.0+; session scope only).

---

## Configuration

Create `.env` in the **project root** (copy [`.env.example`](./.env.example)); **do not commit `.env`**. Since **v1.4.2**, if that file exists, keys defined in it **override** inherited process/env vars (including system `MYSQL_*`). If no project `.env` is found, only the environment and defaults apply.

### Connection

| Variable                                | Default   | Description                                     |
| --------------------------------------- | --------- | ----------------------------------------------- |
| `MYSQL_HOST`                            | localhost | Host                                            |
| `MYSQL_PORT`                            | 3306      | Port                                            |
| `MYSQL_USER`                            | root      | User                                            |
| `MYSQL_PASSWORD`                        | —         | Password                                        |
| `MYSQL_DATABASE`                        | —         | Default database                                |
| `MYSQL_URL` / `MYSQL_CONNECTION_STRING` | —         | `mysql://` or `mysql2://`; URL-encode passwords |

### Safety and allowlist

| Variable                               | Description                                             |
| -------------------------------------- | ------------------------------------------------------- |
| `MYSQL_DATABASE_ALLOWLIST`             | Comma-separated DB names                                |
| `MYSQL_MCP_VALIDATE_EXTRA_CONNECTIONS` | `true` + allowlist → validate each extra DSN default DB |
| `MYSQL_MAX_SQL_LENGTH`                 | Max SQL chars (default 102400)                          |

### Execution and pool

| Variable                                | Default | Description          |
| --------------------------------------- | ------- | -------------------- |
| `MYSQL_MAX_ROWS`                        | 100     | Max rows             |
| `MYSQL_QUERY_TIMEOUT`                   | 30000   | Query timeout (ms)   |
| `MYSQL_RETRY_COUNT`                     | 2       | Read retry count     |
| `MYSQL_RETRY_DELAY_MS`                  | 200     | Retry backoff        |
| `MYSQL_CONNECTION_LIMIT`                | 10      | Pool size            |
| `MYSQL_TIMEOUT`                         | 60000   | Connect timeout (ms) |
| `MYSQL_SSL_CA` / `SSL_CERT` / `SSL_KEY` | —       | SSL                  |

### Read-only, debug, MCP

| Variable                         | Description                              |
| -------------------------------- | ---------------------------------------- |
| `MYSQL_READONLY`                 | `true` read-only                         |
| `MCP_DEBUG`                      | `true` → `executionTime` in tool results |
| `MCP_SCHEMA_OVERVIEW_MAX_TABLES` | Default 50; `0` names only               |
| `MCP_AUDIT_LOG`                  | Audit log path                           |
| `MCP_QUERY_RESULT_HINT`          | `true` → `approxChars` on `query`        |
| `MYSQL_MCP_EXPLAIN_JSON`         | `true` → JSON EXPLAIN parsing            |

### Multi-DSN

| Variable                      | Description                  |
| ----------------------------- | ---------------------------- |
| `MYSQL_MCP_EXTRA_CONNECTIONS` | JSON array of `{ id, url }`  |
| `MYSQL_MCP_CONNECTION_ID`     | Active id, default `default` |

### Ops (optional)

| Variable                     | Description                                         |
| ---------------------------- | --------------------------------------------------- |
| `MYSQL_MCP_OPS_TOOLS`        | `true` → `process_list`, `slow_query_status`        |
| `MYSQL_MCP_PROCESS_LIST_MAX` | Max rows for `process_list` (default 100, cap 5000) |
| `MYSQL_MCP_KILL_QUERY`       | `true` → `kill_query`                               |
| `MYSQL_MCP_READ_AUDIT_TOOL`  | + `MCP_AUDIT_LOG` → `read_audit_log`                |
| `MYSQL_MCP_READ_SLOW_LOG`    | + `MYSQL_MCP_SLOW_LOG_PATH` → `read_slow_query_log` |
| `MYSQL_MCP_SLOW_LOG_PATH`    | Slow log file path                                  |

---

## Client setup

### Claude Desktop

Edit `claude_desktop_config.json` ([macOS] `~/Library/Application Support/Claude/`, [Windows] `%APPDATA%/Claude/`):

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
        "MYSQL_DATABASE": "your_database"
      }
    }
  }
}
```

### Cursor

[![Add to Cursor](https://img.shields.io/badge/Add%20to-Cursor-6C47FF?logo=cursor&logoColor=white)](https://cursor.com/en/install-mcp?name=mysql-mcp-server&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkB5Y2xlbm92ZS9teXNxbC1tY3Atc2VydmVyQGxhdGVzdCJdfQ%3D%3D)

1. **Open this repo as the workspace root** (so `cwd` loads the project root `.env`).
2. **Global npm install**: `npm install -g @yclenove/mysql-mcp-server@latest` and ensure `mysql-mcp-server` is on `PATH` (Windows: npm global bin).
3. Put connection settings in **project root** `.env` (gitignored). **Do not** put production passwords in MCP `env` if you can rely on `.env`.
4. This repo **does not commit** `.cursor/`. Add the MCP server in Cursor settings, or create a **local** project-root `.cursor/mcp.json` (not committed) with **`mysql-mcp-server`** (no args). Enable `mysql-mcp` under **Settings → MCP** or reload the window.
5. **Env precedence (v1.4.2+)**: keys present in project `.env` override same-named variables from the OS, so you do not accidentally connect to `127.0.0.1`.
6. Full manual test: [MCP_CURSOR_TEST.md](./MCP_CURSOR_TEST.md).

Example (save as local `.cursor/mcp.json`, do not commit):

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

**Without global install**, use `npx`: `"command": "npx"`, `"args": ["-y", "@yclenove/mysql-mcp-server"]`.  
For **local source debugging**, switch to `node` + `${workspaceFolder}/dist/index.js` after `npm run build`.

### Production (read-only)

```json
{
  "mcpServers": {
    "mysql-prod": {
      "command": "npx",
      "args": ["-y", "@yclenove/mysql-mcp-server"],
      "env": {
        "MYSQL_HOST": "prod-db.example.com",
        "MYSQL_USER": "readonly_user",
        "MYSQL_PASSWORD": "password",
        "MYSQL_DATABASE": "production",
        "MYSQL_READONLY": "true"
      }
    }
  }
}
```

---

## Local development

1. **Build**

   ```bash
   npm install
   npm run build
   ```

2. **Option A — global `mysql-mcp-server`**  
   After global install, configure **`mysql-mcp-server`** in a self-created local `.cursor/mcp.json` (not committed). Reload MCP; connection still reads project root `.env`.

3. **Option B — debug this repo’s build**  
   Set MCP to **`node` + `${workspaceFolder}/dist/index.js`**, run `npm run build`, reload MCP.

4. **Verify**  
   Reload MCP in Cursor and follow [MCP_CURSOR_TEST.md](./MCP_CURSOR_TEST.md), or run `npm test` / `npm run inspector`.

---

## Development

Before changing tools/resources/prompts, read [`AGENTS.md`](./AGENTS.md).

### Project structure (excerpt)

```
src/
├── index.ts
├── server.ts
├── resources.ts
├── prompts.ts
├── audit.ts
├── explainWarnings.ts
├── schemaOverviewLimit.ts
├── db/
│   ├── connection.ts
│   ├── executor.ts
│   └── allowlist.ts
└── tools/
    ├── query.ts
    ├── modify.ts
    ├── schema.ts
    ├── connections.ts
    ├── ops.ts
    ├── batch.ts
    └── ddl.ts
test/                    # *.test.mjs
```

### Commands

```bash
npm run dev
npm run build
npm start
npm test
npm run lint
npm run format
npm run format:check
npm run inspector
```

### Docker

```bash
docker build -t mysql-mcp-server .
docker run -e MYSQL_HOST=host.docker.internal \
           -e MYSQL_USER=root \
           -e MYSQL_PASSWORD=password \
           -e MYSQL_DATABASE=mydb \
           mysql-mcp-server
```

---

## Troubleshooting

| Issue                                                            | What to check                                                                                               |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Connection failed                                                | MySQL up; host/port/user/password; remote: firewall, `bind-address`                                         |
| Log shows `.env` loaded but `MySQL:` still points to `127.0.0.1` | v1.4.2+: project `.env` overrides system `MYSQL_*`. Upgrade if needed; ensure `MYSQL_HOST` is set in `.env` |
| Query timeout                                                    | Raise `MYSQL_QUERY_TIMEOUT`; large results: `MYSQL_MAX_ROWS`                                                |
| Writes rejected                                                  | Expected if `MYSQL_READONLY=true`                                                                           |
| SSL                                                              | Set `MYSQL_SSL_*`                                                                                           |
| Local build not used                                             | Run `npm run build`; workspace root = this repo; MCP `node` path points to `dist/index.js`                  |

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## License

[MIT](./LICENSE)
