# MySQL MCP Server

[![npm version](https://img.shields.io/npm/v/@yclenove/mysql-mcp-server.svg)](https://www.npmjs.com/package/@yclenove/mysql-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-green.svg)](https://nodejs.org/)

**[简体中文](./README.md) | English**

A MySQL database tool server based on MCP (Model Context Protocol), enabling AI assistants to safely query and operate MySQL databases.

## Features

- **16 tools + 4 Prompts** — query, CRUD, DDL, stored procedures, batch, metadata, connection diagnostics
- **Parameterized queries** — prevents SQL injection attacks
- **Safety guards** — DELETE/UPDATE require WHERE; TRUNCATE/DROP/ALTER auto-blocked
- **Read-only mode** — one switch for production safety
- **Transaction protection** — batch operations auto-transact with rollback on failure
- **Context-friendly** — compact JSON output, built-in pagination, saves LLM token usage
- **MCP Resources** — auto-discover database schema and pool status
- **MCP Prompts** — pre-built prompts for table analysis, query generation, and optimization
- **Audit logging** — optional SQL execution logging to file
- **Docker support** — built-in Dockerfile for one-command deployment
- **Friendly error messages** — common MySQL error codes mapped to clear diagnostics
- **SQL length protection** — 100KB default limit to prevent oversized SQL attacks
- **Query timeout & retry** — configurable timeout and auto-retry strategy
- **SSL support** — secure connections to remote databases

## Architecture

```
MCP Client (Claude/Cursor)
    │  stdio JSON-RPC
    ▼
MCP Server (server.ts)
    ├── Query Tools ──────── query, explain_query
    ├── Modify Tools ─────── insert, update, delete
    ├── DDL Tools ─────────── create_table
    ├── Batch Tools ──────── batch_execute, batch_insert
    ├── Schema Tools ─────── test_connection, use_database,
    │                         show_databases, list_tables,
    │                         describe_table, show_indexes,
    │                         show_create_table
    ├── Resources ─────────── schema/overview, schema/table/{name},
    │                          databases, status/pool
    └── Prompts ──────────── analyze-table, generate-query,
                               optimize-query, data-overview
    │
    ▼
SQL Executor (executor.ts) ← timeout/retry/safety/audit
    │
    ▼
Connection Pool (connection.ts) ← mysql2 pool
    │
    ▼
MySQL Database
```

## Quick Start

### Using npx (Recommended)

No installation needed:

```bash
npx -y @yclenove/mysql-mcp-server
```

### Global Install

```bash
npm install -g @yclenove/mysql-mcp-server
mysql-mcp-server
```

### Build from Source

```bash
git clone https://github.com/yclenove/mysql-mcp-server.git
cd mysql-mcp-server
npm install
npm run build
npm start
```

### Publish under your npm account

The published package name comes from `package.json` → `name` (currently `@yclenove/mysql-mcp-server`). You must be logged into npm as a user **allowed to publish under that scope**. If your npm username differs, change `name` to `@your-npm-username/mysql-mcp-server`, then run `npm publish --access public`. Update MCP client configs (`npx` args) to match.

#### GitHub Actions publishing (avoid `npm error code EOTP`)

If 2FA is enabled on your npm account, the **`NPM_TOKEN`** secret cannot be a token that still requires an interactive OTP on every publish. Use one of:

1. **Granular Access Token** with Read and Write on the package (or user) and enable the option to **bypass 2FA for publishing** in automation/CI (wording on npm may vary).
2. **Classic token** with type **Automation** (intended for CI; no OTP prompt on publish).

Paste the token into **GitHub → Repository → Settings → Secrets → `NPM_TOKEN`**, then re-run the workflow. See comments at the top of `.github/workflows/publish.yml`.

## Tool API

| Tool                | Description                                                       | Parameters                                              |
| ------------------- | ----------------------------------------------------------------- | ------------------------------------------------------- |
| `query`             | Read-only queries (SELECT/SHOW/DESCRIBE/EXPLAIN)                  | `sql`, `params?`, `limit?`, `page?`, `pageSize?`        |
| `explain_query`     | Analyze SQL query execution plan                                  | `sql`                                                   |
| `insert`            | Execute INSERT                                                    | `sql`, `params?`                                        |
| `update`            | Execute UPDATE (WHERE required)                                   | `sql`, `params?`                                        |
| `delete`            | Execute DELETE (WHERE required)                                   | `sql`, `params?`                                        |
| `call_procedure`    | Call a stored procedure                                           | `procedure`, `params?`                                  |
| `create_table`      | Create a new table (disabled in read-only mode)                   | `table`, `columns[]`, `comment?`, `engine?`, `charset?` |
| `batch_execute`     | Batch SQL execution (auto-transaction), max 50                    | `statements[]`                                          |
| `batch_insert`      | Batch insert records (multi-row VALUES, auto-transaction), max 50 | `table`, `records[]`                                    |
| `test_connection`   | Test database connection status and server version                | none                                                    |
| `use_database`      | Switch current database                                           | `database`                                              |
| `show_databases`    | List all databases                                                | none                                                    |
| `list_tables`       | List tables with info                                             | `database?`                                             |
| `describe_table`    | Get table column structure                                        | `table`                                                 |
| `show_indexes`      | Get table indexes                                                 | `table`                                                 |
| `show_create_table` | Get CREATE TABLE SQL                                              | `table`                                                 |

### MCP Resources

| Resource URI                       | Description                                                                |
| ---------------------------------- | -------------------------------------------------------------------------- |
| `mysql://schema/overview`          | Tables and columns (no column comments; use `describe_table` for comments) |
| `mysql://schema/table/{tableName}` | Single-table column structure (JSON)                                       |
| `mysql://databases`                | Database names as a JSON array                                             |
| `mysql://status/pool`              | Pool queue and connection counts                                           |

### MCP Prompts

| Prompt           | Description                                                | Arguments                |
| ---------------- | ---------------------------------------------------------- | ------------------------ |
| `analyze-table`  | Structure, indexes, row count analysis and tuning hints    | `table`                  |
| `generate-query` | Natural language → parameterized SELECT + run with `query` | `description`, `tables?` |
| `optimize-query` | EXPLAIN + index review + rewrite suggestions               | `sql`                    |
| `data-overview`  | Database-level: table list, row counts, sample rows        | none                     |

## Security

### Parameterized Queries

All tools use parameterized queries to prevent SQL injection:

```json
{ "sql": "SELECT * FROM users WHERE id = ?", "params": [1] }
```

### Dangerous Operation Interception

| Operation       | Rule                  |
| --------------- | --------------------- |
| DELETE / UPDATE | WHERE clause required |
| TRUNCATE        | Always blocked        |
| DROP            | Always blocked        |
| ALTER           | Always blocked        |

### Read-Only Mode

Set `MYSQL_READONLY=true` for three-layer protection:

1. **Tool layer**: insert/update/delete tools reject directly
2. **Batch layer**: batch_execute filters non-query statements
3. **Executor layer**: final validation at SQL execution level

## Configuration

Create a `.env` file in the **project root** (copy from [`.env.example`](./.env.example)); it is loaded on startup. **Do not commit `.env`.** If `MYSQL_*` variables are already set in your shell or OS, those take precedence (dotenv does not override existing values by default).

### Environment Variables

| Variable                 | Default   | Description                                                   |
| ------------------------ | --------- | ------------------------------------------------------------- |
| `MYSQL_HOST`             | localhost | MySQL host                                                    |
| `MYSQL_PORT`             | 3306      | Port                                                          |
| `MYSQL_USER`             | root      | Username                                                      |
| `MYSQL_PASSWORD`         | -         | Password                                                      |
| `MYSQL_DATABASE`         | -         | Default database                                              |
| `MYSQL_URL`              | -         | `mysql://` or `mysql2://` URI; alternative to discrete vars; URL-encode passwords |
| `MYSQL_CONNECTION_STRING`| -         | Alias for `MYSQL_URL` (naming compatibility)                    |
| `MYSQL_READONLY`         | false     | Read-only mode                                                |
| `MYSQL_MAX_ROWS`         | 100       | Max rows per query                                            |
| `MYSQL_QUERY_TIMEOUT`    | 30000     | Query timeout (ms)                                            |
| `MYSQL_RETRY_COUNT`      | 2         | Read-only query retry count                                   |
| `MYSQL_RETRY_DELAY_MS`   | 200       | Base retry delay (exponential backoff)                        |
| `MYSQL_CONNECTION_LIMIT` | 10        | Connection pool size                                          |
| `MYSQL_TIMEOUT`          | 60000     | Connection timeout (ms)                                       |
| `MYSQL_SSL_CA`           | -         | SSL CA certificate path                                       |
| `MYSQL_SSL_CERT`         | -         | SSL client certificate path                                   |
| `MYSQL_SSL_KEY`          | -         | SSL client key path                                           |
| `MYSQL_MAX_SQL_LENGTH`   | 102400    | Max SQL length (chars), rejects if exceeded                   |
| `MCP_DEBUG`              | false     | Enable debug info (returns executionTime)                     |
| `MCP_AUDIT_LOG`          | -         | Audit log file path (e.g. `./audit.log`), disabled if not set |

### MCP Client Configuration

#### Claude Desktop

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

#### Cursor

1. **Recommended (this repo includes a template)**: Use [`.cursor/mcp.json`](./.cursor/mcp.json) at the project root (or copy it to `~/.cursor/mcp.json`). It expects a globally installed `mysql-mcp-server`; put connection settings in a **project root** `.env` (see **Configuration** above)—do not commit secrets.
2. **Alternative**: In **Settings → Tools & MCP**, add a server with command `npx -y @yclenove/mysql-mcp-server` and the same environment variables.
3. **Manual MCP verification in Cursor**: See [MCP_CURSOR_TEST.md](./MCP_CURSOR_TEST.md) (checklist for tools, resources, and prompts).

#### Production (Read-Only Mode)

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

## Development

Before changing MCP tools/resources/prompts, read [`AGENTS.md`](./AGENTS.md) (**token economy** and authoring notes).

### Project Structure

```
src/
├── index.ts           # Entry point, .env loading & startup
├── server.ts          # MCP Server creation & registration
├── resources.ts       # MCP Resources (schema/pool status)
├── prompts.ts         # MCP Prompts (pre-built guidance)
├── audit.ts           # Query audit logging
├── db/
│   ├── connection.ts  # Connection pool, config
│   └── executor.ts    # SQL executor, safety checks, timeout/retry
├── tools/
│   ├── query.ts       # Query tools (query, explain_query)
│   ├── modify.ts      # Modify tools (insert/update/delete)
│   ├── batch.ts       # Batch tools (batch_execute/batch_insert)
│   ├── ddl.ts         # DDL tools (create_table)
│   └── schema.ts      # Metadata tools
└── types/
    └── index.ts       # TypeScript type definitions
test/
├── executor.test.mjs  # Unit tests (executor)
└── audit.test.mjs     # Audit log tests
AGENTS.md              # AI collaboration & MCP token guidelines
Dockerfile             # Container deployment
```

### Commands

```bash
npm run dev        # Development mode (auto-compile)
npm run build      # Build
npm start          # Start server
npm test           # Run unit tests
npm run lint       # Lint check
npm run format     # Format code
npm run inspector  # MCP Inspector debug
```

### Docker Deployment

```bash
docker build -t mysql-mcp-server .
docker run -e MYSQL_HOST=host.docker.internal \
           -e MYSQL_USER=root \
           -e MYSQL_PASSWORD=password \
           -e MYSQL_DATABASE=mydb \
           mysql-mcp-server
```

## Troubleshooting

**Connection failed**: Verify MySQL is running and host/port/user/password are correct. For remote connections, check firewall rules and MySQL `bind-address` config.

**Query timeout**: Increase `MYSQL_QUERY_TIMEOUT` (default 30s). For large datasets, use `MYSQL_MAX_ROWS` to limit returned rows.

**Write rejected in read-only mode**: Expected behavior. Check if `MYSQL_READONLY` is set to `true`.

**SSL connection**: Set `MYSQL_SSL_CA` to point to your CA certificate file. For mutual TLS, also set `MYSQL_SSL_CERT` and `MYSQL_SSL_KEY`.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## License

[MIT](./LICENSE)
