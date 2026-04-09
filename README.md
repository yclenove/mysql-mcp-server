# MySQL MCP Server

[![npm version](https://img.shields.io/npm/v/@wenit/mysql-mcp-server.svg)](https://www.npmjs.com/package/@wenit/mysql-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-green.svg)](https://nodejs.org/)

**简体中文 | [English](./README_en.md)**

基于 MCP（Model Context Protocol）协议的 MySQL 数据库工具服务器，让 AI 助手能够安全地查询和操作 MySQL 数据库。

## 特性

- **10 个精简工具** — 查询、增删改、批量操作、元数据一应俱全
- **参数化查询** — 防止 SQL 注入攻击
- **安全防护** — DELETE/UPDATE 必须带 WHERE，TRUNCATE/DROP/ALTER 自动拦截
- **只读模式** — 一键开启，适合生产环境
- **事务保护** — 批量操作自动事务，失败即回滚
- **上下文友好** — 紧凑 JSON 输出，节省 LLM token 消耗
- **查询超时与重试** — 可配置超时时间和自动重试策略
- **SSL 支持** — 安全连接到远程数据库

## 架构

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
SQL Executor (executor.ts) ← 超时/重试/安全检查
    │
    ▼
Connection Pool (connection.ts) ← mysql2 连接池
    │
    ▼
MySQL Database
```

## 快速开始

### 使用 npx（推荐）

无需安装，直接运行：

```bash
npx -y @wenit/mysql-mcp-server
```

### 全局安装

```bash
npm install -g @wenit/mysql-mcp-server
mysql-mcp-server
```

### 从源码构建

```bash
git clone https://github.com/yclenove/mysql-mcp-server.git
cd mysql-mcp-server
npm install
npm run build
npm start
```

## 工具 API

| 工具 | 说明 | 参数 |
|------|------|------|
| `query` | 只读查询（SELECT/SHOW/DESCRIBE/EXPLAIN） | `sql`, `params?` |
| `insert` | 执行 INSERT | `sql`, `params?` |
| `update` | 执行 UPDATE（必须含 WHERE） | `sql`, `params?` |
| `delete` | 执行 DELETE（必须含 WHERE） | `sql`, `params?` |
| `batch_execute` | 批量执行 SQL（自动事务），最多 50 条 | `statements[]` |
| `batch_insert` | 批量插入记录（自动事务），最多 50 条 | `table`, `records[]` |
| `show_databases` | 列出所有数据库 | 无 |
| `list_tables` | 列出表及其信息 | `database?` |
| `describe_table` | 获取表字段结构 | `table` |
| `show_indexes` | 获取表索引 | `table` |
| `show_create_table` | 获取建表 SQL | `table` |

## 安全特性

### 参数化查询

所有工具均使用参数化查询防止 SQL 注入：

```json
{ "sql": "SELECT * FROM users WHERE id = ?", "params": [1] }
```

### 危险操作拦截

| 操作 | 拦截规则 |
|------|----------|
| DELETE / UPDATE | 必须包含 WHERE 子句 |
| TRUNCATE | 始终拦截 |
| DROP | 始终拦截 |
| ALTER | 始终拦截 |

### 只读模式

设置 `MYSQL_READONLY=true` 启用只读模式，三层防护确保安全：

1. **工具层**：insert/update/delete 工具直接拒绝
2. **批量层**：batch_execute 过滤非查询语句
3. **执行层**：底层执行器最终校验

## 配置

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `MYSQL_HOST` | localhost | MySQL 主机 |
| `MYSQL_PORT` | 3306 | 端口 |
| `MYSQL_USER` | root | 用户名 |
| `MYSQL_PASSWORD` | - | 密码 |
| `MYSQL_DATABASE` | - | 默认数据库 |
| `MYSQL_READONLY` | false | 只读模式 |
| `MYSQL_MAX_ROWS` | 100 | 单次返回最大行数 |
| `MYSQL_QUERY_TIMEOUT` | 30000 | 查询超时（毫秒） |
| `MYSQL_RETRY_COUNT` | 2 | 只读查询重试次数 |
| `MYSQL_RETRY_DELAY_MS` | 200 | 重试基础延时（指数退避） |
| `MYSQL_CONNECTION_LIMIT` | 10 | 连接池大小 |
| `MYSQL_TIMEOUT` | 60000 | 连接超时（毫秒） |
| `MYSQL_SSL_CA` | - | SSL CA 证书路径 |
| `MYSQL_SSL_CERT` | - | SSL 客户端证书路径 |
| `MYSQL_SSL_KEY` | - | SSL 客户端密钥路径 |
| `MCP_DEBUG` | false | 开启调试信息（返回 executionTime） |

### MCP 客户端配置

#### Claude Desktop

编辑 `claude_desktop_config.json`（[macOS] `~/Library/Application Support/Claude/`、[Windows] `%APPDATA%/Claude/`）：

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

在 Cursor 设置中添加 MCP 服务器，命令为 `npx -y @wenit/mysql-mcp-server`，配置对应的环境变量。

#### 生产环境（只读模式）

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

## 开发

### 项目结构

```
src/
├── index.ts           # 入口，.env 加载与启动
├── server.ts          # MCP Server 创建与工具注册
├── db/
│   ├── connection.ts  # 连接池管理、配置读取
│   └── executor.ts    # SQL 执行器、安全检查、超时重试
├── tools/
│   ├── query.ts       # 查询工具 (query)
│   ├── modify.ts      # 修改工具 (insert/update/delete)
│   ├── batch.ts       # 批量工具 (batch_execute/batch_insert)
│   └── schema.ts      # 元数据工具
└── types/
    └── index.ts       # TypeScript 类型定义
```

### 常用命令

```bash
npm run dev        # 开发模式（自动编译）
npm run build      # 编译
npm start          # 启动
npm run lint       # 代码检查
npm run format     # 格式化
npm run inspector  # MCP Inspector 调试
```

## 故障排查

**连接失败**：检查 MySQL 服务是否运行，确认 host/port/user/password 正确。远程连接注意防火墙和 MySQL 的 `bind-address` 配置。

**查询超时**：调大 `MYSQL_QUERY_TIMEOUT`（默认 30s）。大量数据查询建议配合 `MYSQL_MAX_ROWS` 限制返回行数。

**只读模式下写入报错**：这是预期行为。检查 `MYSQL_READONLY` 是否为 `true`。

**SSL 连接**：设置 `MYSQL_SSL_CA` 指向 CA 证书文件路径。如需双向认证，同时设置 `MYSQL_SSL_CERT` 和 `MYSQL_SSL_KEY`。

## 更新日志

详见 [CHANGELOG.md](./CHANGELOG.md)。

## License

[MIT](./LICENSE)
