# MySQL MCP Server

[![npm version](https://img.shields.io/npm/v/@wenit/mysql-mcp-server.svg)](https://www.npmjs.com/package/@wenit/mysql-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-green.svg)](https://nodejs.org/)

**[简体中文](./README.md) | English**

A MySQL database tool server based on MCP (Model Context Protocol), enabling AI assistants to safely query and operate MySQL databases.

## Features

- **10 streamlined tools** — query, CRUD, batch operations, and metadata
- **Parameterized queries** — prevents SQL injection attacks
- **Safety guards** — DELETE/UPDATE require WHERE; TRUNCATE/DROP/ALTER auto-blocked
- **Read-only mode** — one switch for production safety
- **Transaction protection** — batch operations auto-transact with rollback on failure
- **Context-friendly** — compact JSON output, saves LLM token usage
- **Query timeout & retry** — configurable timeout and auto-retry strategy
- **SSL support** — secure connections to remote databases

## Architecture

```
MCP Client (Claude/Cursor)
    │  stdio JSON-RPC
    ▼
MCP Server (server.ts)
    ├── Query Tools ──────── query
    ├── Modify Tools ─────── insert, update, delete
    ├── Batch Tools ──────── batch_execute, batch_insert
    └── Schema Tools ─────── show_databases, list_tables,
                              describe_table, show_indexes,
                              show_create_table
    │
    ▼
SQL Executor (executor.ts) ← timeout/retry/safety checks
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
npx -y @wenit/mysql-mcp-server
```

### Global Install

```bash
npm install -g @wenit/mysql-mcp-server
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

## Tool API

| Tool | Description | Parameters |
|------|-------------|------------|
| `query` | Read-only queries (SELECT/SHOW/DESCRIBE/EXPLAIN) | `sql`, `params?` |
| `insert` | Execute INSERT | `sql`, `params?` |
| `update` | Execute UPDATE (WHERE required) | `sql`, `params?` |
| `delete` | Execute DELETE (WHERE required) | `sql`, `params?` |
| `batch_execute` | Batch SQL execution (auto-transaction), max 50 | `statements[]` |
| `batch_insert` | Batch insert records (auto-transaction), max 50 | `table`, `records[]` |
| `show_databases` | List all databases | none |
| `list_tables` | List tables with info | `database?` |
| `describe_table` | Get table column structure | `table` |
| `show_indexes` | Get table indexes | `table` |
| `show_create_table` | Get CREATE TABLE SQL | `table` |

## Security

### Parameterized Queries

All tools use parameterized queries to prevent SQL injection:

```json
{ "sql": "SELECT * FROM users WHERE id = ?", "params": [1] }
```

### Dangerous Operation Interception

| Operation | Rule |
|-----------|------|
| DELETE / UPDATE | WHERE clause required |
| TRUNCATE | Always blocked |
| DROP | Always blocked |
| ALTER | Always blocked |

### Read-Only Mode

Set `MYSQL_READONLY=true` for three-layer protection:

1. **Tool layer**: insert/update/delete tools reject directly
2. **Batch layer**: batch_execute filters non-query statements
3. **Executor layer**: final validation at SQL execution level

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MYSQL_HOST` | localhost | MySQL host |
| `MYSQL_PORT` | 3306 | Port |
| `MYSQL_USER` | root | Username |
| `MYSQL_PASSWORD` | - | Password |
| `MYSQL_DATABASE` | - | Default database |
| `MYSQL_READONLY` | false | Read-only mode |
| `MYSQL_MAX_ROWS` | 100 | Max rows per query |
| `MYSQL_QUERY_TIMEOUT` | 30000 | Query timeout (ms) |
| `MYSQL_RETRY_COUNT` | 2 | Read-only query retry count |
| `MYSQL_RETRY_DELAY_MS` | 200 | Base retry delay (exponential backoff) |
| `MYSQL_CONNECTION_LIMIT` | 10 | Connection pool size |
| `MYSQL_TIMEOUT` | 60000 | Connection timeout (ms) |
| `MYSQL_SSL_CA` | - | SSL CA certificate path |
| `MYSQL_SSL_CERT` | - | SSL client certificate path |
| `MYSQL_SSL_KEY` | - | SSL client key path |
| `MCP_DEBUG` | false | Enable debug info (returns executionTime) |

### MCP Client Configuration

#### Claude Desktop

Edit `claude_desktop_config.json` ([macOS] `~/Library/Application Support/Claude/`, [Windows] `%APPDATA%/Claude/`):

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["-y", "@wenit/mysql-mcp-server"],
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

Add MCP server in Cursor settings with command `npx -y @wenit/mysql-mcp-server` and configure environment variables accordingly.

#### Production (Read-Only Mode)

```json
{
  "mcpServers": {
    "mysql-prod": {
      "command": "npx",
      "args": ["-y", "@wenit/mysql-mcp-server"],
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

### Project Structure

```
src/
├── index.ts           # Entry point, .env loading & startup
├── server.ts          # MCP Server creation & tool registration
├── db/
│   ├── connection.ts  # Connection pool, config
│   └── executor.ts    # SQL executor, safety checks, timeout/retry
├── tools/
│   ├── query.ts       # Query tool (query)
│   ├── modify.ts      # Modify tools (insert/update/delete)
│   ├── batch.ts       # Batch tools (batch_execute/batch_insert)
│   └── schema.ts      # Metadata tools
└── types/
    └── index.ts       # TypeScript type definitions
```

### Commands

```bash
npm run dev        # Development mode (auto-compile)
npm run build      # Build
npm start          # Start server
npm run lint       # Lint check
npm run format     # Format code
npm run inspector  # MCP Inspector debug
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
