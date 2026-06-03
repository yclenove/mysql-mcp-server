# MySQL MCP Server

> 让 AI 助手**安全、可控**地连接 MySQL —— 基于 [MCP](https://modelcontextprotocol.io/) 的生产级数据库工具服务

[![npm version](https://img.shields.io/npm/v/@yclenove/mysql-mcp-server.svg)](https://www.npmjs.com/package/@yclenove/mysql-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/@yclenove/mysql-mcp-server.svg)](https://www.npmjs.com/package/@yclenove/mysql-mcp-server)
[![CI](https://github.com/yclenove/mysql-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/yclenove/mysql-mcp-server/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-green.svg)](https://nodejs.org/)

**简体中文 | [English](./README_en.md)**

---

## 简介

**MySQL MCP Server** 是一个开源的 [Model Context Protocol](https://modelcontextprotocol.io/) 服务器，让 **Cursor、Claude Desktop** 等 AI 客户端通过 stdio 安全地查询、分析和管理 MySQL / MariaDB。

本项目在 [wenit/mysql-mcp-server](https://github.com/wenit/mysql-mcp-server) 基础上持续演进，面向**真实维护场景**补充了多层安全防护、多连接、EXPLAIN 分析、审计与运维工具，并配备 CI 与单元测试。

|            |                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------- |
| **npm 包** | [`@yclenove/mysql-mcp-server`](https://www.npmjs.com/package/@yclenove/mysql-mcp-server) |
| **协议**   | MCP over stdio（JSON-RPC）                                                               |
| **运行时** | Node.js ≥ 20                                                                             |
| **许可证** | [MIT](./LICENSE)                                                                         |

---

## 为什么选择本项目

AI 助手直接操作数据库时，最大的风险不是「连不上」，而是**误删、越权、Token 爆炸、缺乏可观测性**。本项目从设计之初就把这些当作一等公民：

| 能力           | 说明                                                                                    |
| -------------- | --------------------------------------------------------------------------------------- |
| **多层安全**   | 参数化查询 · DELETE/UPDATE 强制 WHERE · 拦截 TRUNCATE/DROP/ALTER · 可选库白名单         |
| **只读双保险** | `MYSQL_READONLY=true` 时工具层拒绝写入 + 连接池 `SET SESSION transaction_read_only = 1` |
| **生产可运维** | 多 DSN 切换 · 进程列表 · 慢查询状态 · 可选审计日志与慢日志尾部读取                      |
| **AI 友好**    | EXPLAIN 中文告警 · Schema Resources · 查询/优化 Prompts · 结果集与 Schema 展开上限      |
| **工程质量**   | TypeScript · ESLint · Prettier · **10+ 单元测试** · GitHub Actions CI                   |

---

## 快速开始

### 1. 安装并启动

```bash
# 方式 A：零安装（推荐试用）
npx -y @yclenove/mysql-mcp-server

# 方式 B：全局安装
npm install -g @yclenove/mysql-mcp-server
mysql-mcp-server
```

### 2. 配置数据库连接

在项目根目录创建 `.env`（参考 [`.env.example`](./.env.example)）：

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=your_database

# 生产环境强烈建议
MYSQL_READONLY=true
```

> 自 v1.4.2 起：若存在项目根 `.env`，其中 `MYSQL_*` 会**覆盖**系统环境中的同名变量，避免 AI 客户端误连本机。

### 3. 接入 Cursor

[![Add to Cursor](https://img.shields.io/badge/Add%20to-Cursor-6C47FF?logo=cursor&logoColor=white)](https://cursor.com/en/install-mcp?name=mysql-mcp-server&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkB5Y2xlbm92ZS9teXNxbC1tY3Atc2VydmVyQGxhdGVzdCJdfQ%3D%3D)

若一键安装后显示 `No tools, prompts, or resources`（部分 Cursor 版本会把 `args` 合并成单个字符串），请在本机创建 `.cursor/mcp.json`：

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

连接信息写在项目根 `.env`，**不要**把生产密码写进 MCP 配置的 `env`。完整接入步骤见 [客户端接入](#客户端接入)。

---

## 功能一览

```
┌─────────────────────────────────────────────────────────────┐
│  MCP Client（Cursor / Claude Desktop / Inspector）           │
└───────────────────────────┬─────────────────────────────────┘
                            │ stdio JSON-RPC
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  MySQL MCP Server                                            │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌───────┐ │
│  │ Query   │ │ Modify  │ │ Schema   │ │ Batch   │ │ Ops*  │ │
│  │ EXPLAIN │ │ DDL     │ │ Connect  │ │         │ │ Audit*│ │
│  └─────────┘ └─────────┘ └──────────┘ └─────────┘ └───────┘ │
│  Resources · Prompts · 超时/重试/截断 · 危险语句拦截          │
└───────────────────────────┬─────────────────────────────────┘
                            │ mysql2 连接池
                            ▼
                    MySQL / MariaDB
                    * 需显式环境变量启用
```

- **20+ MCP 工具**：查询、写入、元数据、批量、DDL、多连接、可选运维
- **4 个 Resource**：`schema/overview`、`schema/table/{name}`、`databases`、`status/pool`
- **4 个 Prompt**：`analyze-table`、`generate-query`、`optimize-query`、`data-overview`

---

## MCP 工具参考

<details>
<summary><strong>查询与分析</strong></summary>

| 工具            | 说明                                                   |
| --------------- | ------------------------------------------------------ |
| `query`         | 只读 SELECT/SHOW/DESCRIBE/EXPLAIN；支持 `?` 占位与分页 |
| `explain_query` | 执行计划 + 中文告警；可选 `MYSQL_MCP_EXPLAIN_JSON`     |

</details>

<details>
<summary><strong>元数据与连接</strong></summary>

| 工具                                                    | 说明                                     |
| ------------------------------------------------------- | ---------------------------------------- |
| `test_connection`                                       | Ping、版本、当前 connectionId / database |
| `use_database` / `show_databases` / `list_tables`       | 库表元数据（受白名单约束）               |
| `describe_table` / `show_indexes` / `show_create_table` | 表结构详情                               |
| `list_connections` / `use_connection`                   | 多 DSN 管理                              |

</details>

<details>
<summary><strong>写入与批量</strong></summary>

| 工具                           | 说明                                   |
| ------------------------------ | -------------------------------------- |
| `insert` / `update` / `delete` | 参数化写入；UPDATE/DELETE 必须含 WHERE |
| `call_procedure`               | 存储过程调用                           |
| `batch_execute`                | 事务批量执行（最多 50 条）             |
| `batch_insert`                 | 批量插入（最多 50 行）                 |
| `create_table`                 | 建表（只读模式禁用）                   |

</details>

<details>
<summary><strong>可选运维</strong>（需环境变量）</summary>

| 工具                  | 前置条件                                                   |
| --------------------- | ---------------------------------------------------------- |
| `process_list`        | `MYSQL_MCP_OPS_TOOLS=true`                                 |
| `slow_query_status`   | `MYSQL_MCP_OPS_TOOLS=true`                                 |
| `kill_query`          | `MYSQL_MCP_KILL_QUERY=true`（只读模式不可用）              |
| `read_audit_log`      | `MYSQL_MCP_READ_AUDIT_TOOL=true` + `MCP_AUDIT_LOG`         |
| `read_slow_query_log` | `MYSQL_MCP_READ_SLOW_LOG=true` + `MYSQL_MCP_SLOW_LOG_PATH` |

</details>

手动验收清单：[MCP_CURSOR_TEST.md](./MCP_CURSOR_TEST.md) · AI 扩展约定：[AGENTS.md](./AGENTS.md)

---

## 安全模型

本项目面向「AI 可能犯错」的场景设计，安全不是可选项：

```
请求 → 工具层校验 → 执行层校验 → MySQL 会话（可选 transaction_read_only）
         │                │
         ├─ 只读模式拦截    ├─ DELETE/UPDATE 须含 WHERE
         ├─ 危险 DDL 拦截   ├─ 标识符白名单校验
         └─ 库白名单        └─ SQL 长度 / 超时 / 行数上限
```

| 机制           | 行为                                            |
| -------------- | ----------------------------------------------- |
| **参数化查询** | 所有工具使用 `?` 占位，拒绝裸拼接用户输入       |
| **WHERE 强制** | 无 WHERE 的 DELETE/UPDATE 直接拒绝              |
| **DDL 拦截**   | TRUNCATE / DROP / ALTER 默认拒绝                |
| **库白名单**   | `MYSQL_DATABASE_ALLOWLIST` 限制可见与可切换的库 |
| **只读模式**   | 工具层 + 会话层 `transaction_read_only` 双保险  |
| **审计**       | 可选 `MCP_AUDIT_LOG` 记录工具调用               |

---

## 配置说明

复制 [`.env.example`](./.env.example) 并按需修改。常用变量：

| 分类   | 变量                                                     | 默认值   | 说明                            |
| ------ | -------------------------------------------------------- | -------- | ------------------------------- |
| 连接   | `MYSQL_HOST` / `PORT` / `USER` / `PASSWORD` / `DATABASE` | —        | 基本连接信息                    |
| 连接   | `MYSQL_URL`                                              | —        | `mysql://` 连接串，与分项二选一 |
| 安全   | `MYSQL_READONLY`                                         | `false`  | 只读模式                        |
| 安全   | `MYSQL_DATABASE_ALLOWLIST`                               | —        | 逗号分隔库名白名单              |
| 执行   | `MYSQL_MAX_ROWS`                                         | `100`    | 单次最大返回行数                |
| 执行   | `MYSQL_QUERY_TIMEOUT`                                    | `30000`  | 查询超时（ms）                  |
| 执行   | `MYSQL_MAX_SQL_LENGTH`                                   | `102400` | 单条 SQL 最大长度               |
| MCP    | `MCP_SCHEMA_OVERVIEW_MAX_TABLES`                         | `50`     | Resource 展开表数上限           |
| MCP    | `MCP_AUDIT_LOG`                                          | —        | 审计日志路径                    |
| 多连接 | `MYSQL_MCP_EXTRA_CONNECTIONS`                            | —        | JSON 数组额外 DSN               |

完整变量列表见 [`.env.example`](./.env.example) 内注释。

---

## 客户端接入

### Cursor

1. 以**本仓库根目录**打开工作区（使 `cwd` 能加载 `.env`）
2. 全局安装：`npm install -g @yclenove/mysql-mcp-server@latest`
3. 在本机创建 `.cursor/mcp.json`（仓库不提交 `.cursor/`，见 `.gitignore`）
4. 重载窗口或在 **Settings → MCP** 启用 `mysql-mcp`

不装全局时可用 npx：`"command": "npx"`, `"args": ["-y", "@yclenove/mysql-mcp-server"]`  
调试源码：`"command": "node"`, `"args": ["${workspaceFolder}/dist/index.js"]`（需先 `npm run build`）

### Claude Desktop

编辑 `claude_desktop_config.json`（macOS: `~/Library/Application Support/Claude/`，Windows: `%APPDATA%/Claude/`）：

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

## 开发与贡献

### 从源码运行

```bash
git clone https://github.com/yclenove/mysql-mcp-server.git
cd mysql-mcp-server
npm install
cp .env.example .env   # 编辑连接信息
npm run build
npm start
```

### 质量保障

每次 PR / push 到 `main` 都会运行 CI：

```bash
npm run typecheck   # TypeScript 类型检查
npm run lint        # ESLint
npm run format:check
npm run build
npm test            # 10+ 单元测试（node --test）
npm run inspector   # MCP Inspector 交互调试
```

### 目录结构

```
src/
├── index.ts              # 入口，加载 .env
├── server.ts             # MCP Server 注册
├── resources.ts          # MCP Resources
├── prompts.ts            # MCP Prompts
├── db/
│   ├── connection.ts     # 连接池、多 DSN、只读会话
│   ├── executor.ts       # 执行、超时、重试、安全校验
│   └── allowlist.ts      # 库白名单
└── tools/                # query · modify · schema · batch · ops · ddl · connections
test/                     # *.test.mjs
```

扩展工具 / Resource / Prompt 前请阅读 [AGENTS.md](./AGENTS.md)。

欢迎通过 [Issue](https://github.com/yclenove/mysql-mcp-server/issues) 反馈问题或提交 PR。

---

## 故障排查

| 现象                            | 处理                                                                     |
| ------------------------------- | ------------------------------------------------------------------------ |
| 连接失败                        | 检查 MySQL 服务、`host/port/user/password`、防火墙与 `bind-address`      |
| `.env` 已加载但连到 `127.0.0.1` | v1.4.2+ 项目 `.env` 覆盖系统 `MYSQL_*`；确认 `.env` 中 `MYSQL_HOST` 正确 |
| 一键安装 Cursor 无工具          | 改用手动 `.cursor/mcp.json` + `mysql-mcp-server` 命令                    |
| 查询超时                        | 增大 `MYSQL_QUERY_TIMEOUT`；大结果配合 `MYSQL_MAX_ROWS`                  |
| 只读模式下写入报错              | 预期行为；确认 `MYSQL_READONLY=true`                                     |

---

## 相关链接

| 文档                                                  | 说明                                        |
| ----------------------------------------------------- | ------------------------------------------- |
| [CHANGELOG.md](./CHANGELOG.md)                        | 版本更新记录                                |
| [MCP_CURSOR_TEST.md](./MCP_CURSOR_TEST.md)            | Cursor 全功能手动测试清单                   |
| [AGENTS.md](./AGENTS.md)                              | AI 助手扩展约定（Token 经济、工具描述规范） |
| [上游仓库](https://github.com/wenit/mysql-mcp-server) | 原始 fork 来源                              |

---

## License

[MIT](./LICENSE) · Copyright (c) 2026 [yclenove](https://github.com/yclenove)
