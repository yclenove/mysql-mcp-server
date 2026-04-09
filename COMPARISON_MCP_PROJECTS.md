# 与主流 MySQL MCP 项目的实现对比与优化方向

本文基于在 `H:\aicoding\` 下 **clone 并阅读** 下列仓库（`git clone --depth 1`）后的源码级观察，对比对象为 **`@yclenove/mysql-mcp-server`（本仓库）**。

| 本地目录 | 上游仓库 | 说明 |
|----------|----------|------|
| `H:\aicoding\designcomputer-mysql_mcp_server` | [designcomputer/mysql_mcp_server](https://github.com/designcomputer/mysql_mcp_server) | Python + mysql-connector，stdio |
| `H:\aicoding\benborla-mcp-server-mysql` | [benborla/mcp-server-mysql](https://github.com/benborla/mcp-server-mysql) | Node + mysql2，**单工具 `mysql_query`**，可选 HTTP |
| `H:\aicoding\guangxiang-MySQL_MCP` | [guangxiangdebizi/MySQL_MCP](https://github.com/guangxiangdebizi/MySQL_MCP) | Node + mysql2，**Streamable HTTP**，多连接池 |
| `H:\aicoding\googleapis-mcp-toolbox` | [googleapis/mcp-toolbox](https://github.com/googleapis/mcp-toolbox) | **Go**，多引擎；MySQL 为预置 toolset 之一 |

---

## 1. 总览对比（实现 / 功能 / 效率）

| 维度 | designcomputer | benborla | guangxiang | mcp-toolbox (MySQL) | **本仓库 yclenove** |
|------|----------------|----------|------------|----------------------|---------------------|
| **语言与运行时** | Python，`mysql.connector` | TS，`mysql2/promise` 连接池 | TS，每连接独立 **Pool** | Go，`database/sql` | TS，`mysql2` 单连接池 |
| **MCP 传输** | stdio | stdio 或 Streamable HTTP | **HTTP + 会话 Map** | 独立二进制 + 配置 | **stdio** |
| **工具形态** | 1 个 `execute_sql` + 表 Resource | **1 个** `mysql_query`（SQL 字符串） | `execute_query` + 连接管理 + 元数据少量工具 | **YAML 声明**多工具：execute、list_tables、plan、活跃查询、碎片等 | **16 个细粒度工具** + Resources + Prompts |
| **安全模型** | 无细粒度拦截；`read_resource` 里表名拼进 SQL | 环境开关 + **schema 级权限** + 多库只读默认 | 依赖调用方与池隔离 | 企业向 source/tool 分离、注解 destructive | **WHERE/DDL 拦截**、只读模式、参数化、SQL 长度上限 |
| **连接效率** | **每次工具/资源常 `connect()` 短连接**（`with connect`） | 连接池 + `getConnection`  per 查询 | 多 Pool，活跃池切换 | 长连接池（Go） | 单例连接池，executor 统一重试/超时 |
| **多库/多实例** | 单 config | **Multi-DB 模式** + schema 权限 | **多 Pool + select_database** | 多 source（YAML） | 单池 + `use_database`；多主机需 **多个 MCP 进程** |
| **可观测/运维** | logging | 结构化 log | console + HTTP | 文档与云集成齐全 | 可选审计日志、中文错误码 |

**结论摘要**

- **designcomputer**：实现最短，适合「快速探库」；**无连接池复用**，`execute_sql` 与 Resource 路径重复建连，**高并发下效率最差**；安全面最弱。
- **benborla**：架构上「一个大 SQL 工具」+ 丰富 **env 与权限**；与本仓库「多工具 + 执行层统一校验」是**不同产品哲学**，适合要 **schema 级 ACL** 的团队。
- **guangxiang**：**多连接 + HTTP** 与 Cursor 常见 stdio 二选一；会话与 Express 常驻，**运维成本更高**，但 **多实例切换** 体验好。
- **mcp-toolbox**：MySQL 侧工具偏 **DBA/可观测**（活跃查询、碎片、缺唯一索引等），**声明式 tools.yaml**；与本仓库「应用侧 CRUD + 强安全」互补而非替代。

---

## 2. 分项目要点（源码依据）

### 2.1 designcomputer/mysql_mcp_server

- 核心文件：`src/mysql_mcp_server/server.py`。
- **工具**：仅 `execute_sql`；**资源**：`SHOW TABLES` 后 `mysql://{table}/data`，`read_resource` 内 `SELECT * FROM {table} LIMIT 100`（表名未参数化，依赖 URI 结构）。
- **效率**：`list_resources` / `call_tool` / `read_resource` 均 `connect()` 新建连接，无池化。
- **功能**：无 Prompts；无事务/批量/危险语句策略。

### 2.2 benborla/mcp-server-mysql

- 核心：`index.ts` 注册 **单一** `mysql_query`；`src/db/index.ts` 建 **单例 Pool**，`executeQuery`/`executeWriteQuery` 从池取连接，写路径带 **事务 + schema 提取 + 权限检查**（`permissions.ts`）。
- **功能**：支持 Unix socket、SSL、**MULTI_DB**、schema 级 INSERT/UPDATE/DELETE/DDL 开关；可选 **StreamableHTTPServerTransport** 与远程 MCP。
- **效率**：池化合理；单工具意味着 LLM 易塞长 SQL，**语义层安全**更依赖模型与权限配置。

### 2.3 guangxiangdebizi/MySQL_MCP

- 核心：`src/index.ts`（Express + **StreamableHTTP** + `sessions` Map）；`src/database.ts` **DatabaseConnectionManager** 多 `Pool`；`src/tools/` 仅 **connection + query** 两类。
- **功能**：`add_connection` / `list_connections` / `select_database` / `remove_connection`；`execute_query` 等走**当前活跃池**。
- **效率**：连接池 + keepAlive；多库场景下内存与连接数随配置上升。

### 2.4 googleapis/mcp-toolbox（MySQL 预置）

- 参考：`internal/prebuiltconfigs/tools/mysql.yaml`、`internal/tools/mysql/mysqlexecutesql/mysqlexecutesql.go`。
- **功能**：`execute_sql`、`list_tables`、`get_query_plan`、`list_active_queries`、`list_table_fragmentation`、`list_tables_missing_unique_indexes` 等；**toolsets** 分 data/monitor。
- **实现**：Go 插件式注册；**source** 与 **tool** 分离，适合平台化与多环境变量注入（含 `MYSQL_QUERY_PARAMS`）。

### 2.5 本仓库（yclenove）

- 核心：`src/server.ts` 注册多工具；`src/db/executor.ts` 统一 **危险操作检测**、只读、参数化、超时重试；`src/db/connection.ts` **单池**。
- **差异优势**：面向 **AI 误操作** 的硬拦截、**Prompts/Resources** 省 token、**审计** 与中文诊断。
- **差异短板**：无 **多连接 ID**（对比 guangxiang）；无 **schema 级 ACL**（对比 benborla）；无 toolbox 类 **纯运维** 工具（活跃会话、表碎片等）。

---

## 3. 本仓库优化计划（按优先级）

### P0（建议先做）

1. **文档**：在 README 增加指向本文的链接；保持「多主机 = 多个 MCP 配置」与「同实例多库 = `use_database`」说明清晰。
2. **可选连接串**：评估支持 `MYSQL_URL` 或单一 DSN（对齐 benborla / toolbox 体验），解析后填充 `mysql2` 配置；**禁止**在日志中打印密码。
3. **效率小优化**：审计 `list_resources` / 高频只读路径是否可复用池（本仓库已池化；仅需避免重复 `getPool` 以外的全表扫描类调用，按 profiler 再定）。

### P1（产品化）

1. **只读工具包（对标 toolbox monitor 子集）**：可选增加 **只读** 工具，例如「当前活跃查询列表」「EXPLAIN 已存在」可由 `explain_query` 覆盖；若需对齐 toolbox，再增加独立 `list_processlist` 类工具（默认关闭或仅 READONLY 下可用）。
2. **库级白名单**：环境变量 `MYSQL_DATABASE_ALLOWLIST`（逗号分隔），超出则 `use_database` / 跨库查询拒绝（吸收 benborla「权限」思路的轻量版）。

### P2（架构级，需单独设计）**

1. **单进程多连接**：引入 `connection_id` 与连接注册表（类似 guangxiang），与现有单池、审计、只读标志交互复杂，需独立 RFC。
2. **不重复造 mcp-toolbox**：多引擎、云管控场景直接推荐用户使用 [Google MCP Toolbox](https://github.com/googleapis/mcp-toolbox)，本仓库继续聚焦 **MySQL + stdio + 安全 CRUD**。

---

## 4. 本地复现对比环境

```text
H:\aicoding\designcomputer-mysql_mcp_server
H:\aicoding\benborla-mcp-server-mysql
H:\aicoding\guangxiang-MySQL_MCP
H:\aicoding\googleapis-mcp-toolbox
H:\aicoding\mysql-mcp-server          ← 本仓库
```

更新对比时：对上述仓库 `git pull` 或重新 `clone` 指定 tag 后，重点 diff **连接层**（`db`/`*pool*`）、**工具入口**（`execute`/`query`）、**权限与安全**。

---

*文档生成说明：基于克隆日期的 `--depth 1` 最新 main；若上游大版本升级请重新核对。*
