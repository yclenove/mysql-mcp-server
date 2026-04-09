# MySQL MCP Server

[![npm version](https://img.shields.io/npm/v/@yclenove/mysql-mcp-server.svg)](https://www.npmjs.com/package/@yclenove/mysql-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-green.svg)](https://nodejs.org/)

**简体中文 | [English](./README_en.md)**

基于 [MCP（Model Context Protocol）](https://modelcontextprotocol.io/) 的 MySQL 数据库工具服务，供 Claude / Cursor 等客户端通过 stdio 安全地查询与（可选）写入数据。

---

## 目录

- [特性概览](#特性概览)
- [架构](#架构)
- [快速开始](#快速开始)
- [工具一览](#工具一览)
- [Resources 与 Prompts](#resources-与-prompts)
- [安全与只读](#安全与只读)
- [配置说明](#配置说明)
- [客户端接入](#客户端接入)
- [本地开发与本仓库调试](#本地开发与本仓库调试)
- [开发与构建](#开发与构建)
- [故障排查](#故障排查)
- [更新日志](#更新日志)

---

## 特性概览

- **工具**：核心约 **20+** 个 MCP 工具；另可按环境变量启用多连接、运维、慢日志尾部等（见 [工具一览](#工具一览)）。
- **安全**：参数化查询；DELETE/UPDATE 须带 WHERE；拦截 TRUNCATE / DROP / ALTER；可选库白名单 `MYSQL_DATABASE_ALLOWLIST`。
- **只读模式**：`MYSQL_READONLY=true` 时工具层 + 会话层 `transaction_read_only` 双保险。
- **多 DSN**：`MYSQL_MCP_EXTRA_CONNECTIONS` + `list_connections` / `use_connection`。
- **EXPLAIN**：行式计划 + 中文告警；可选 `MYSQL_MCP_EXPLAIN_JSON` 解析 `FORMAT=JSON`。
- **Token**：`schema/overview` 可限制展开表数；`MCP_QUERY_RESULT_HINT` 可返回结果近似字符数。
- **审计 / 运维**：可选审计日志、进程列表、慢查询变量、慢日志文件尾部等（均需显式开关）。
- **资源与提示**：4 类 Resource、4 个 Prompt；详见下文。

---

## 架构

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
    ├── Ops（可选）──────── process_list, slow_query_status, kill_query,
    │                        read_audit_log, read_slow_query_log
    ├── Batch ───────────── batch_execute, batch_insert
    ├── DDL ─────────────── create_table
    ├── Resources ───────── schema/overview, schema/table/{name},
    │                      databases, status/pool
    └── Prompts ─────────── analyze-table, generate-query, optimize-query, data-overview
    ▼
Executor (executor.ts) ← 超时 / 重试 / 危险语句 / 审计
    ▼
Connection Pool (connection.ts) ← 多池、只读会话、mysql2
    ▼
MySQL / MariaDB
```

---

## 快速开始

### npx（推荐）

```bash
npx -y @yclenove/mysql-mcp-server
```

### 全局安装

```bash
npm install -g @yclenove/mysql-mcp-server
mysql-mcp-server
```

### 从源码

```bash
git clone https://github.com/yclenove/mysql-mcp-server.git
cd mysql-mcp-server
npm install
npm run build
npm start
```

### 自行发布 / 换包名

包名由 `package.json` 的 `name` 决定（当前为 `@yclenove/mysql-mcp-server`）。发布需对应 npm 作用域权限；换用户名请改 `name` 后 `npm publish --access public`，客户端 `npx` 参数需同步。

**GitHub Actions 发布（避免 `npm error code EOTP`）**：若开启 2FA，请在 npm 创建 **Granular** 或 **Automation** 类 token，写入仓库 Secret `NPM_TOKEN`。详见 `.github/workflows/publish.yml` 顶部注释。

---

## 工具一览

### 查询与分析

| 工具 | 说明 | 参数 |
| --- | --- | --- |
| `query` | 只读 SELECT/SHOW/DESCRIBE/EXPLAIN；? 占位；`limit` 或 `page`+`pageSize` | `sql`, `params?`, `limit?`, `page?`, `pageSize?` |
| `explain_query` | 执行计划；默认行式 EXPLAIN + 告警；`MYSQL_MCP_EXPLAIN_JSON=true` 时用 FORMAT=JSON | `sql` |

### 元数据与连接

| 工具 | 说明 | 参数 |
| --- | --- | --- |
| `test_connection` | Ping、version、当前 `connectionId` / database | 无 |
| `use_database` | `USE` 切换库（受白名单约束） | `database` |
| `show_databases` | 列出库（受白名单过滤） | 无 |
| `list_tables` | 表列表与元数据 | `database?` |
| `describe_table` | 列结构 | `table` |
| `show_indexes` | 索引 | `table` |
| `show_create_table` | 建表语句 | `table` |
| `list_connections` | 已配置连接 id / host / port / database（无密码） | 无 |
| `use_connection` | 切换活动连接 | `connection_id` |

### 写入与批量

| 工具 | 说明 | 参数 |
| --- | --- | --- |
| `insert` / `update` / `delete` | 参数化；UPDATE/DELETE 必须含 WHERE | `sql`, `params?` |
| `call_procedure` | 存储过程 | `procedure`, `params?` |
| `batch_execute` | 事务批量，最多 50 条 | `statements[]` |
| `batch_insert` | 批量插入，最多 50 行 | `table`, `records[]` |
| `create_table` | 建表（只读模式禁用） | `table`, `columns[]`, … |

### 可选运维（需环境变量）

| 工具 | 前置条件 |
| --- | --- |
| `process_list` | `MYSQL_MCP_OPS_TOOLS=true`；行数上限 `MYSQL_MCP_PROCESS_LIST_MAX` |
| `slow_query_status` | `MYSQL_MCP_OPS_TOOLS=true` |
| `kill_query` | `MYSQL_MCP_KILL_QUERY=true`；`MYSQL_READONLY` 时不可用 |
| `read_audit_log` | `MYSQL_MCP_READ_AUDIT_TOOL=true` 且已设 `MCP_AUDIT_LOG` |
| `read_slow_query_log` | `MYSQL_MCP_READ_SLOW_LOG=true` 且已设 `MYSQL_MCP_SLOW_LOG_PATH` |

---

## Resources 与 Prompts

### MCP Resources

| 资源 URI | 说明 |
| --- | --- |
| `mysql://schema/overview` | 当前库表与列摘要；大库可限制展开表数 `MCP_SCHEMA_OVERVIEW_MAX_TABLES` |
| `mysql://schema/table/{tableName}` | 单表列 JSON |
| `mysql://databases` | 库名 JSON 数组（受白名单过滤） |
| `mysql://status/pool` | 连接池状态 |

### MCP Prompts

| Prompt | 说明 |
| --- | --- |
| `analyze-table` | 表结构 / 索引 / 行数分析 |
| `generate-query` | 自然语言 → 参数化 SELECT + `query` |
| `optimize-query` | EXPLAIN + 索引与改写建议 |
| `data-overview` | 库级概览 |

手动验收清单见 [MCP_CURSOR_TEST.md](./MCP_CURSOR_TEST.md)。

---

## 安全与只读

- **参数化**：所有工具使用参数化执行，防止 SQL 注入。
- **危险语句**：DELETE/UPDATE 须含 WHERE；TRUNCATE / DROP / ALTER 拦截。
- **只读模式** `MYSQL_READONLY=true`：
  1. 写入类工具拒绝；
  2. 批量中非只读语句拒绝；
  3. 执行层校验；
  4. 新建池连接执行 `SET SESSION transaction_read_only = 1`（MySQL 5.6+ / MariaDB 10.0+；仅会话级，与全局 `read_only` 无关）。


---

## 配置说明

在**项目根目录**放置 `.env`（可复制 [`.env.example`](./.env.example)），启动时自动加载；**勿提交 `.env`**。自 **v1.4.2** 起：若该文件存在，其中出现的键会**覆盖**进程已继承的环境变量（含系统里的 `MYSQL_*`）；若未找到项目 `.env`，则仍仅使用环境变量与默认行为。

### 连接与账号

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `MYSQL_HOST` | localhost | 主机 |
| `MYSQL_PORT` | 3306 | 端口 |
| `MYSQL_USER` | root | 用户 |
| `MYSQL_PASSWORD` | - | 密码 |
| `MYSQL_DATABASE` | - | 默认库 |
| `MYSQL_URL` / `MYSQL_CONNECTION_STRING` | - | `mysql://` 或 `mysql2://`；与分项二选一；密码请 URL 编码 |

### 安全与白名单

| 变量 | 说明 |
| --- | --- |
| `MYSQL_DATABASE_ALLOWLIST` | 逗号分隔库名；影响启动校验、`use_database`、`list_tables`（指定库）、`show_databases`、Resource `mysql://databases` |
| `MYSQL_MCP_VALIDATE_EXTRA_CONNECTIONS` | `true` 且已设白名单时，校验每个额外 DSN 的默认库 |
| `MYSQL_MAX_SQL_LENGTH` | 单条 SQL 最大字符数（默认 102400） |

### 执行与连接池

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `MYSQL_MAX_ROWS` | 100 | 单次最大返回行数 |
| `MYSQL_QUERY_TIMEOUT` | 30000 | 查询超时（毫秒） |
| `MYSQL_RETRY_COUNT` | 2 | 只读重试次数 |
| `MYSQL_RETRY_DELAY_MS` | 200 | 重试退避基数 |
| `MYSQL_CONNECTION_LIMIT` | 10 | 连接池大小 |
| `MYSQL_TIMEOUT` | 60000 | 连接超时（毫秒） |
| `MYSQL_SSL_CA` / `SSL_CERT` / `SSL_KEY` | - | SSL |

### 只读、调试与 MCP

| 变量 | 说明 |
| --- | --- |
| `MYSQL_READONLY` | `true` 只读模式 |
| `MCP_DEBUG` | `true` 时工具返回 `executionTime` |
| `MCP_SCHEMA_OVERVIEW_MAX_TABLES` | 默认 50；`0` 仅表名；Resource `schema/overview` |
| `MCP_AUDIT_LOG` | 审计日志文件路径 |
| `MCP_QUERY_RESULT_HINT` | `true` 时 `query` 返回 `approxChars` |
| `MYSQL_MCP_EXPLAIN_JSON` | `true` 时 `explain_query` 使用 `EXPLAIN FORMAT=JSON` |

### 多 DSN

| 变量 | 说明 |
| --- | --- |
| `MYSQL_MCP_EXTRA_CONNECTIONS` | JSON 数组，如 `[{"id":"replica","url":"mysql://..."}]` |
| `MYSQL_MCP_CONNECTION_ID` | 当前活动连接 id，默认 `default` |

### 运维（可选）

| 变量 | 说明 |
| --- | --- |
| `MYSQL_MCP_OPS_TOOLS` | `true` → `process_list`、`slow_query_status` |
| `MYSQL_MCP_PROCESS_LIST_MAX` | `process_list` 最大行数（默认 100，上限 5000） |
| `MYSQL_MCP_KILL_QUERY` | `true` → `kill_query` |
| `MYSQL_MCP_READ_AUDIT_TOOL` | `true` 且已设 `MCP_AUDIT_LOG` → `read_audit_log` |
| `MYSQL_MCP_READ_SLOW_LOG` | `true` 且已设 `MYSQL_MCP_SLOW_LOG_PATH` → `read_slow_query_log` |
| `MYSQL_MCP_SLOW_LOG_PATH` | 慢查询日志文件路径（进程需可读） |

---

## 客户端接入

### Claude Desktop

编辑 `claude_desktop_config.json`（[macOS] `~/Library/Application Support/Claude/`、[Windows] `%APPDATA%/Claude/`）：

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

1. **打开本仓库为工作区根目录**（使进程 `cwd` 能加载项目根下的 `.env`；多文件夹工作区时请单独打开本仓库或将其设为根）。
2. **安装 npm 包（全局）**：`npm install -g @yclenove/mysql-mcp-server@latest`，确保终端里能执行 `mysql-mcp-server`（Windows 需保证 Node 的 npm 全局 `bin` 在 PATH 中）。
3. **连接信息**：写在**项目根目录** `.env`（已在 `.gitignore`，勿提交密码）。**不要**在 `.cursor/mcp.json` 的 `env` 里写密码；保持 `env: {}` 即可。
4. **本仓库已含** [`.cursor/mcp.json`](./.cursor/mcp.json)，使用 `mysql-mcp-server`（无额外 `args`）。保存后可在 **Cursor → Settings → MCP** 中启用 `mysql-mcp`，或重载窗口。
5. **环境变量优先级**（v1.4.2+）：若项目根存在 `.env`，其中出现的 `MYSQL_*` 等会**覆盖**你系统中已设置的同名变量，避免误连 `127.0.0.1`。若要用系统环境覆盖 `.env`，需临时重命名或移走项目 `.env`。
6. 全功能手动测试见 [MCP_CURSOR_TEST.md](./MCP_CURSOR_TEST.md)。

示例（与仓库内文件一致）：

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

**不装全局**时可用 `npx`：`"command": "npx"`，`"args": ["-y", "@yclenove/mysql-mcp-server"]`。  
本地改源码调试时，可把 `command` / `args` 改回 **`node` + `${workspaceFolder}/dist/index.js`**（需先 `npm run build`）。

### 生产只读示例

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

## 本地开发与本仓库调试

1. **安装与编译**

   ```bash
   npm install
   npm run build
   ```

2. **方式 A：本仓库 `.cursor/mcp.json`（与 npm 一致）**  
   默认使用 **`mysql-mcp-server`**（全局安装，见上文「Cursor」）。打开本仓库根目录后重载 MCP 即可；连接信息仍读项目根 `.env`。

3. **方式 B：调试当前仓库构建产物**  
   将 `.cursor/mcp.json` 改为 **`node` + `${workspaceFolder}/dist/index.js`**，执行 `npm run build` 后重载 MCP，无需发布到 npm。

4. **验证**  
   在 Cursor 中启用 MCP 后，按 [MCP_CURSOR_TEST.md](./MCP_CURSOR_TEST.md) 逐项调用工具；或执行 `npm test`、`npm run inspector` 调试。

---

## 开发与构建

扩展工具 / Resource / Prompt 前请阅读 [AGENTS.md](./AGENTS.md)（token 与描述约定）。

### 目录结构（节选）

```
src/
├── index.ts           # 入口，加载 .env
├── server.ts          # MCP Server 注册
├── resources.ts       # Resources
├── prompts.ts         # Prompts
├── audit.ts
├── explainWarnings.ts
├── schemaOverviewLimit.ts
├── db/
│   ├── connection.ts  # 多池、只读会话、配置
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

### 常用命令

```bash
npm run dev        # tsc --watch
npm run build        # 编译
npm start            # 启动 MCP
npm test             # 单元测试
npm run lint
npm run format
npm run format:check
npm run inspector    # MCP Inspector
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

## 故障排查

| 现象 | 处理 |
| --- | --- |
| 连接失败 | 检查 MySQL 与 `host/port/user/password`；远程注意防火墙与 `bind-address` |
| 日志已写「Loading .env from: …\\.env」，但下一行 `MySQL:` 仍是 `127.0.0.1` 等错误地址 | v1.4.2+：项目 `.env` 会覆盖系统里同名 `MYSQL_*`。若仍为旧行为，请升级依赖；或检查 `.env` 内是否缺少 `MYSQL_HOST` |
| 查询超时 | 增大 `MYSQL_QUERY_TIMEOUT`；大结果配合 `MYSQL_MAX_ROWS` |
| 只读下写入报错 | 预期行为；检查 `MYSQL_READONLY` |
| SSL | 设置 `MYSQL_SSL_CA` 等 |
| MCP 未加载本地构建 | 确认已 `npm run build`，工作区根为本仓库，且存在 `.cursor/mcp.json` 中的路径 |

---

## 更新日志

详见 [CHANGELOG.md](./CHANGELOG.md)。

## License

[MIT](./LICENSE)
