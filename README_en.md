# MySQL MCP Server

**[简体中文](./README.md) | English**

A Node.js-based MySQL MCP (Model Context Protocol) server that enables MySQL database operations through the MCP protocol.

## Quick Start (1 minute)

```bash
npm install
cp .env.example .env
npm run build
npm start
```

On startup, the server loads `.env` from the current working directory and logs runtime info to stderr.

## Features

### Query Tools
- **select / query** - Execute SELECT queries

### Modification Tools
- **insert** - Execute INSERT operations
- **update** - Execute UPDATE operations
- **delete** - Execute DELETE operations
- **execute** - General execution (INSERT/UPDATE/DELETE)

### Batch Operation Tools
- **batch_execute** - Batch SQL execution (automatic transaction)
- **batch_query** - Batch queries (read-only)
- **batch_insert** - Batch insert

### Metadata Tools
- **show_databases** - Get all databases
- **list_tables** - Get table list
- **describe_table** - Get table structure
- **show_indexes** - Get table indexes
- **show_create_table** - Get CREATE TABLE statement

## Security Features

### 🔒 Parameterized Queries Prevent SQL Injection
All tools use parameterized queries to effectively prevent SQL injection attacks:
```javascript
// ✅ Safe: Use parameterized queries
{ "sql": "SELECT * FROM users WHERE id = ?", "params": [1] }

// ❌ Dangerous: Direct SQL concatenation (not supported by this tool)
{ "sql": "SELECT * FROM users WHERE id = 1 OR 1=1" }
```

### 🛡️ Dangerous Operation Interception
DELETE and UPDATE statements must include WHERE conditions; otherwise execution is automatically rejected:
```javascript
// ❌ Rejected: Missing WHERE condition
{ "sql": "DELETE FROM users" }
// Error: Dangerous operation: DELETE or UPDATE statement missing WHERE clause, execution rejected

// ✅ Allowed
{ "sql": "DELETE FROM users WHERE id = ?", "params": [1] }
```

### 📖 Read-Only Mode (MYSQL_READONLY)
Enable read-only mode via environment variable to prohibit all write operations, suitable for production environment queries:

```bash
# Enable read-only mode
MYSQL_READONLY=true
```

**Read-Only Mode Protection Layers:**

| Layer | Protection Mechanism | Description |
|-------|---------------------|-------------|
| Layer 1 | Tool Layer Interception | `insert`/`update`/`delete`/`execute` tools directly reject execution |
| Layer 2 | Batch Filtering | `batch_execute` automatically filters non-query statements |
| Layer 3 | Execution Layer Check | Underlying executor final verification, only allows SELECT/SHOW/DESCRIBE |

**Example - Behavior in Read-Only Mode:**
```javascript
// ❌ Rejected (tool layer)
{ "sql": "INSERT INTO users (name) VALUES ('test')" }
// Error: Currently in read-only mode, INSERT/UPDATE/DELETE operations are prohibited

// ❌ Rejected (batch operation)
{ "statements": [
  { "sql": "SELECT * FROM users" },
  { "sql": "DELETE FROM logs WHERE id = 1" }
]}
// Error: Read-only mode prohibits execution of 1 write statement

// ✅ Allowed
{ "sql": "SELECT * FROM users WHERE id = 1" }
{ "sql": "SHOW TABLES" }
{ "sql": "DESCRIBE users" }
```

### 🔗 Batch Operation Transaction Protection
Batch operations automatically use transactions; if any statement fails, all operations rollback to ensure data consistency:
```javascript
// Both statements execute in the same transaction
{ "statements": [
  { "sql": "INSERT INTO orders (user_id) VALUES (?)", "params": [1] },
  { "sql": "UPDATE users SET order_count = order_count + 1 WHERE id = ?", "params": [1] }
]}
// If the second statement fails, the first statement automatically rolls back
```

## Installation

### Install via npm (Recommended)

```bash
# Global installation
npm install -g @wenit/mysql-mcp-server

# Or install in project
npm install @wenit/mysql-mcp-server
```

### Install from Source

```bash
# Clone or download project
cd mysql-mcp-server

# Install dependencies
npm install

# Compile TypeScript
npm run build
```

## Configuration

### Environment Variables

Create `.env` file or set the following environment variables:

```bash
# Required configuration
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=test

# Optional configuration
MYSQL_CONNECTION_LIMIT=10
MYSQL_QUERY_TIMEOUT=30000   # Per-query timeout in milliseconds
MYSQL_RETRY_COUNT=2         # Retry attempts for retriable read-only errors
MYSQL_RETRY_DELAY_MS=200    # Base retry delay (ms, exponential backoff)
MYSQL_MAX_ROWS=1000         # Max rows returned per query (truncated when exceeded)

# Security-related configuration
MYSQL_READONLY=false        # Enable read-only mode (true/false)

# SSL configuration (optional)
MYSQL_SSL_CA=/path/to/ca.pem
```

### Claude Desktop Configuration

Edit `claude_desktop_config.json`:

#### Method 1: Using npx (Recommended, no global installation needed)

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
        "MYSQL_DATABASE": "test",
        "MYSQL_READONLY": "false"
      }
    }
  }
}
```

#### Method 2: Using Globally Installed Package

**Windows:**
```json
{
  "mcpServers": {
    "mysql": {
      "command": "mysql-mcp-server",
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "root",
        "MYSQL_PASSWORD": "your_password",
        "MYSQL_DATABASE": "test",
        "MYSQL_READONLY": "false"
      }
    }
  }
}
```

**macOS/Linux:**
```json
{
  "mcpServers": {
    "mysql": {
      "command": "mysql-mcp-server",
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "root",
        "MYSQL_PASSWORD": "your_password",
        "MYSQL_DATABASE": "test"
      }
    }
  }
}
```

#### Method 3: Using Local Path

**Windows:**
```json
{
  "mcpServers": {
    "mysql": {
      "command": "node",
      "args": ["E:\\path\\to\\mysql-mcp-server\\dist\\index.js"],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "root",
        "MYSQL_PASSWORD": "your_password",
        "MYSQL_DATABASE": "test",
        "MYSQL_READONLY": "false"
      }
    }
  }
}
```

**macOS/Linux:**
```json
{
  "mcpServers": {
    "mysql": {
      "command": "node",
      "args": ["/path/to/mysql-mcp-server/dist/index.js"],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "root",
        "MYSQL_PASSWORD": "your_password",
        "MYSQL_DATABASE": "test"
      }
    }
  }
}
```

Configuration file location:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

#### Read-Only Mode Configuration Example

Production environments should enable read-only mode to prevent accidental operations:

```json
{
  "mcpServers": {
    "mysql-production": {
      "command": "npx",
      "args": ["-y", "@wenit/mysql-mcp-server"],
      "env": {
        "MYSQL_HOST": "prod-db.example.com",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "readonly_user",
        "MYSQL_PASSWORD": "password",
        "MYSQL_DATABASE": "production",
        "MYSQL_READONLY": "true"
      }
    }
  }
}
```

## Usage Examples

### Query Data
```javascript
// Using select tool
{
  "sql": "SELECT * FROM users WHERE age > ?",
  "params": [18]
}
```

### Insert Data
```javascript
// Using insert tool
{
  "sql": "INSERT INTO users (name, email) VALUES (?, ?)",
  "params": ["John", "john@example.com"]
}

// Or use batch insert
{
  "table": "users",
  "records": [
    { "name": "John", "email": "john@example.com" },
    { "name": "Jane", "email": "jane@example.com" }
  ]
}
```

### Update Data
```javascript
// Using update tool
{
  "sql": "UPDATE users SET age = ? WHERE id = ?",
  "params": [25, 1]
}
```

### View Table Structure
```javascript
// Using describe_table tool
{
  "table": "users"
}
```

### Batch Execution
```javascript
// Using batch_execute tool
{
  "statements": [
    { "sql": "INSERT INTO logs (action) VALUES (?)", "params": ["login"] },
    { "sql": "UPDATE users SET last_login = NOW() WHERE id = ?", "params": [1] }
  ]
}
```

## Development

```bash
# Development mode (auto compile)
npm run dev

# Start server
npm start

# Test with MCP Inspector
npm run inspector
```

## Notes

1. **Security**:
   - Production environments strongly recommend enabling `MYSQL_READONLY=true` read-only mode
   - Even in development, consider using read-only mode first to understand data structure
   - All write operations have WHERE condition checks to prevent accidental table-wide deletion

2. **Connection Pool**: Default connection pool size is 10, adjustable via `MYSQL_CONNECTION_LIMIT`

3. **Timeout**: Default connection timeout is 60 seconds, adjustable via `MYSQL_TIMEOUT`
4. **Query protection**:
   - Per-query timeout via `MYSQL_QUERY_TIMEOUT`
   - Automatic retry/backoff for retriable read-only failures
   - Response row cap via `MYSQL_MAX_ROWS`; when exceeded, response includes `truncated=true`

5. **Read-Only Mode Limitations**:
   - Only allows execution of `SELECT`, `SHOW`, `DESCRIBE`, `DESC`, `EXPLAIN` statements
   - Write statements in `batch_execute` are automatically filtered
   - Modification tools (insert/update/delete/execute) return errors directly

## License

MIT
