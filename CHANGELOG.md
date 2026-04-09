# 更新日志

本项目的所有重要变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.4.0] - 2026-04-09

### 新增

- `MYSQL_READONLY=true` 时连接池新建连接自动 `SET SESSION transaction_read_only = 1`（MySQL 5.6+ / MariaDB 10.0+）；README 说明版本差异
- 可选 `MYSQL_MCP_VALIDATE_EXTRA_CONNECTIONS=true`：在配置 `MYSQL_DATABASE_ALLOWLIST` 时校验每个额外 DSN 的默认库
- `MCP_QUERY_RESULT_HINT=true`：`query` 返回 JSON 增加 `approxChars`
- `MYSQL_MCP_EXPLAIN_JSON=true`：`explain_query` 使用 `EXPLAIN FORMAT=JSON` 并解析嵌套 JSON 告警（`explainJsonDocumentToWarnings` 等）
- 运维：`MYSQL_MCP_PROCESS_LIST_MAX` 限制 `process_list` 行数；`MYSQL_MCP_READ_SLOW_LOG` + `MYSQL_MCP_SLOW_LOG_PATH` 启用 `read_slow_query_log`
- CI 增加 `npm run format:check`；单测 `test/allowlist-extra.test.mjs`、`test/explain-json-warnings.test.mjs`、`test/startup-exit.test.mjs`

## [1.3.0] - 2026-04-09

### 新增

- 工具 `explain_query`：对 EXPLAIN 结果附加中文告警（全表扫描、可能无索引、文件排序/临时表、估算行数过大等）
- 多 DSN：`MYSQL_MCP_EXTRA_CONNECTIONS`（JSON 数组）+ 活动连接 `MYSQL_MCP_CONNECTION_ID`；工具 `list_connections`、`use_connection`；`use_database` 与 `list_tables` 等会话库按活动连接区分
- 运维工具（可选）：`MYSQL_MCP_OPS_TOOLS` 启用 `process_list`、`slow_query_status`；`MYSQL_MCP_KILL_QUERY` 启用 `kill_query`（`MYSQL_READONLY` 时禁用）；`MYSQL_MCP_READ_AUDIT_TOOL` + `MCP_AUDIT_LOG` 启用 `read_audit_log`
- 新增 `src/explainWarnings.ts`、`src/tools/connections.ts`、`src/tools/ops.ts`；单测 `test/explain-warnings.test.mjs`、`test/connections-config.test.mjs`

## [1.2.7] - 2026-04-09

### 优化

- Resource `mysql://schema/overview`：通过环境变量 `MCP_SCHEMA_OVERVIEW_MAX_TABLES` 限制带列信息的表数量（默认 50），超出部分仅列表名摘要，减少大库的 token 与 `information_schema` 查询；设为 `0` 时仅输出表名列表
- 新增 `src/schemaOverviewLimit.ts` 与 `test/schema-overview-limit.test.mjs`

## [1.2.6] - 2026-04-09

### 新增

- 环境变量 `MYSQL_DATABASE_ALLOWLIST`：逗号分隔的库名白名单；未设置则不限制。启动时校验默认库（含连接串解析出的库名）；`use_database`、带库参数的 `list_tables` 拒绝非白名单库；`show_databases` 工具与 `mysql://databases` 资源仅暴露白名单内的库名
- 新增 `src/db/allowlist.ts` 与 `test/database-allowlist.test.mjs`

## [1.2.5] - 2026-04-09

### 新增

- 支持通过 `MYSQL_URL` 或 `MYSQL_CONNECTION_STRING` 配置 `mysql://` / `mysql2://` 连接串；连接串中的主机/端口/用户/密码/路径库名优先于分项环境变量，未给出的字段仍可由 `MYSQL_HOST` 等补全
- `parseMysqlConnectionUrl` 导出供测试与扩展；新增 `test/connection-url.test.mjs`

## [1.2.4] - 2026-04-09

### 新增

- 项目内 [`.cursor/mcp.json`](./.cursor/mcp.json) 示例：使用全局 `mysql-mcp-server`，`MYSQL_PASSWORD` / `MYSQL_DATABASE` 通过环境变量注入；`.gitignore` 改为仅跟踪该文件、其余 `.cursor/*` 仍忽略

### 文档

- README / README_en：补充 Cursor 下通过 `.cursor/mcp.json` 配置的步骤；说明项目根目录 `.env` 加载方式；新增 [`.env.example`](./.env.example) 模板
- [MCP_CURSOR_TEST.md](./MCP_CURSOR_TEST.md)：在 Cursor 对话中逐项验证 MCP（工具 / Resources / Prompts）的手动清单与总控提示词

### 修复

- `npm run test`：在 Node.js 24（如 GitHub Actions）下传入目录 `test/` 会被误当作单文件入口导致 `Cannot find module '.../test'`；改为显式列出 `test/*.test.mjs`，与 Windows / Linux CI 行为一致

## [1.2.3] - 2026-04-09

### 变更

- 升级依赖：`@modelcontextprotocol/sdk`、`mysql2`、`@types/node` 等；`@typescript-eslint/*`、`prettier`、`eslint` / `@eslint/js` 等开发依赖同步至当前主版本线内较新版本（未升级至 ESLint 10、TypeScript 6、`dotenv` 17，以避免潜在破坏性变更）

## [1.2.2] - 2026-04-09

### 优化

- GitHub Actions：`ci.yml` / `publish.yml` 设置 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`，并将 `setup-node` 的 Node 版本改为 24，消除官方 Action 使用 Node 20 的弃用告警

### 文档

- README / README_en：说明 GitHub Actions 发布时 `NPM_TOKEN` 须使用 Granular（发布绕过 2FA）或 Classic **Automation** 令牌，避免 `EOTP`
- `publish.yml`：文件顶部与发布步骤补充 NPM_TOKEN 配置说明
- `publish.yml`：补充说明 `package.json` 的 `version` 须高于 npm 已发布版本，且打 tag 前需先 push 最新 `main`（避免 CI 仍用旧版号触发 `403 cannot publish over previously published versions`）

## [1.2.1] - 2026-04-09

### 变更

- 适配 `@modelcontextprotocol/sdk`：将已弃用的 `server.tool` / `server.resource` / `server.prompt` 全部改为 `registerTool` / `registerResource` / `registerPrompt`，消除 IDE 中划线（deprecated）提示；回调按 SDK 要求接收 `extra` 参数

## [1.2.0] - 2026-04-09

### 变更

- npm 包名由 `@wenit/mysql-mcp-server` 改为 `@yclenove/mysql-mcp-server`（与当前仓库维护者一致；若你的 npm 用户名不同，请自行修改 `package.json` 的 `name` 后再发布）

## [1.1.1] - 2026-04-09

### 新增

- 根目录 `AGENTS.md`：约定修改 MCP 时须兼顾 LLM token 节约

### 优化

- 压缩全部 Tools / Prompts 的注册描述与 Zod 字段说明，降低 `list_tools` 等场景的 token 占用
- `getToolsDescription` 改为极简短览
- MCP Resources：`schema/overview` 正文去掉列注释行以减小大库体积；各 resource 的 `description` 缩短
- `project-conventions.mdc` 增加 MCP/token 指引条目

## [1.1.0] - 2026-04-09

### 变更

- 工具精简：14 个工具合并为 10 个（删除冗余的 `select`、`execute`、`batch_query`）
- 工具描述精简为一句话，减少 LLM 上下文消耗
- 响应格式改为紧凑 JSON，节省约 40-60% token
- 移除响应中的冗余字段（`success`、`rowCount`、未截断时的 `totalRows`）
- `MYSQL_MAX_ROWS` 默认值从 1000 降低到 100，防止上下文溢出
- `executionTime` 默认不再返回，通过 `MCP_DEBUG=true` 开启
- 重构 README.md 和 README_en.md，新增架构图、API 表格、FAQ

### 修复

- 修复 `withTimeout` 中 setTimeout 定时器未清理导致的内存泄漏
- 新增 TRUNCATE/DROP/ALTER 语句拦截，防止破坏性 DDL 操作

### 新增

- 新增 `MCP_DEBUG` 环境变量，开启调试信息输出
- 新增 `CHANGELOG.md` 更新日志文件
- 新增 `.cursor/rules/project-conventions.mdc` 项目开发约定
- `query` 工具新增 `limit` 参数，LLM 可按需控制返回行数（1-10000）
- 新增 `explain_query` 工具，分析 SQL 查询执行计划用于性能优化
- 新增 MCP Resources：`mysql://schema/overview`（schema 概览）、`mysql://schema/table/{name}`（表结构）、`mysql://databases`（数据库列表）
- 新增 Dockerfile 和 .dockerignore，支持容器化部署
- 新增单元测试（30 个用例覆盖 executor 安全检查、标识符校验等）
- 新增 4 个 MCP Prompts：`analyze-table`（分析表结构）、`generate-query`（生成查询）、`optimize-query`（优化查询）、`data-overview`（数据库概览）
- 新增 `create_table` DDL 工具，受控建表（只读模式下禁用）
- `query` 工具新增 `page`/`pageSize` 分页参数，自动生成 LIMIT/OFFSET
- 新增查询审计日志功能，通过 `MCP_AUDIT_LOG` 环境变量指定日志文件路径
- 新增连接池状态监控 Resource：`mysql://status/pool`
- 新增 `use_database` 工具，运行时切换数据库
- 新增 `call_procedure` 工具，支持调用存储过程
- 版本升级至 1.1.0
- publish 工作流添加单元测试步骤
- 启动日志显示注册的工具数、Resources 数和 Prompts 数
- 新增审计日志单元测试（6 个用例），总计 36 个单元测试
- 新增 `test_connection` 工具，快速诊断数据库连接状态和服务器版本
- SQL 长度上限防护（默认 100KB），防止超大 SQL payload 攻击
- 常见 MySQL 错误码映射为友好中文提示（ER_NO_SUCH_TABLE、ER_DUP_ENTRY 等 15 个错误码）
- 审计模块新增 `resetAudit()` 导出函数，提升测试可靠性

### 优化

- `batch_insert` 优化为多行 `INSERT INTO ... VALUES (...), (...), ...` 语法，减少 SQL 往返次数
- 代码格式化（Prettier）修复 4 个文件格式问题
- 单元测试 `closePool` 清理，修复测试进程无法退出的问题

## [1.0.1] - 2026-04-09

### 新增

- 初始版本发布
- 支持 14 个 MCP 工具（查询、修改、批量、元数据）
- 参数化查询防 SQL 注入
- DELETE/UPDATE 无 WHERE 拦截
- 只读模式支持
- 批量操作事务保护
- SSL 连接支持
- 查询超时与自动重试
