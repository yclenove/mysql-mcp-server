# 在 Cursor 中用手动对话测试 MySQL MCP（全功能清单）

> **English**: Use this checklist in Cursor **Agent** chat with the MySQL MCP enabled. Do not commit secrets; write/DDL only on disposable test tables.

## 前置条件

1. **MCP 已启用**：**Settings → Tools & MCP** 中 `mysql-mcp`（或你在 [`.cursor/mcp.json`](./.cursor/mcp.json) 里的 `mcpServers` 名称）为开启状态。
2. **运行方式（与仓库默认配置一致）**  
   - 全局安装：`npm install -g @yclenove/mysql-mcp-server@latest`，确保终端可执行 `mysql-mcp-server`。  
   - 本仓库 `.cursor/mcp.json` 默认使用上述命令；若改用 **`npx`**，见 [README.md](./README.md)「客户端接入 → Cursor」。若调试**本仓库源码**，可改为 `node` + `${workspaceFolder}/dist/index.js` 并先 `npm run build`。
3. **工作区**：用本仓库**根目录**作为工作区打开，使进程 `cwd` 能加载项目根下的 **`.env`**（连接信息写在此文件，**勿**把密码写进 `mcp.json` 的 `env`）。详见 [README.md](./README.md)「配置说明」。
4. **环境变量**：自 **v1.4.2** 起，项目根 `.env` 中的键会**覆盖**系统里同名的 `MYSQL_*`。若日志已写加载 `.env` 但连接地址仍不对，见 README「故障排查」。
5. **对话**：使用支持 MCP 工具的模型；必要时开启「使用 MCP 工具」类选项。

## 分步测试（可复制给 Cursor）

| 类别 | 你对 Cursor 的示例指令 | 预期能力 |
|------|------------------------|----------|
| 连接 | 请用 MCP 调用 `test_connection`，并说明返回的 version / database。 | `test_connection` |
| 库元数据 | 列出所有数据库；再列出当前库下所有表；任选一张表做 `describe_table`、`show_indexes`、`show_create_table`。 | `show_databases`、`list_tables`、`describe_table`、`show_indexes`、`show_create_table` |
| 切换库 | 若账号有权限，用 `use_database` 切到某个库再 `list_tables`。 | `use_database` |
| 只读查询 | 用 `query` 执行 `SELECT 1`；再对某表做带 `LIMIT` 的分页查询。 | `query` |
| 计划 | 对一条 SELECT 使用 `explain_query`。 | `explain_query` |
| 写入（谨慎） | 仅在**测试表**上：`insert` 一行，`update`（必须带 WHERE），`delete`（必须带 WHERE）。勿在生产表操作。 | `insert`、`update`、`delete` |
| 批量 | 用 `batch_execute` 执行两条只读 SQL；若有测试表再用 `batch_insert` 插入两行。 | `batch_execute`、`batch_insert` |
| DDL | 非只读且非生产时，用 `create_table` 建一张列尽量少的临时表。 | `create_table` |
| 存储过程 | 若库中存在存储过程，用 `call_procedure` 调用；否则说明跳过。 | `call_procedure`（可选） |
| 多连接（可选） | 若已配置 `MYSQL_MCP_EXTRA_CONNECTIONS`，调用 `list_connections`，再 `use_connection` 切换后做一次 `query` 或 `test_connection`。 | `list_connections`、`use_connection` |
| 运维（可选） | 若已开启 `MYSQL_MCP_OPS_TOOLS` 等，可测 `process_list`、`slow_query_status`；`kill_query` / `read_audit_log` / `read_slow_query_log` 需各自环境变量，见 README。 | 按需 |
| Resources | 读取 MCP 资源：`mysql://databases`、`mysql://status/pool`、`mysql://schema/overview`（大库默认仅前 50 张表含列，可调 `MCP_SCHEMA_OVERVIEW_MAX_TABLES`）、`mysql://schema/table/{表名}`。 | 四类 Resource |
| Prompts | 使用 MCP Prompts：`analyze-table`（指定表名）、`generate-query`、`optimize-query`（给一条 SELECT）、`data-overview`。 | 四个 Prompt |

## 一条「总控」提示（可整段粘贴）

下面两段内容一致：**纯文本块**适合整段复制；**编号列表**在仓库里更易读。

### 纯文本（一键复制）

```text
请通过已启用的 MySQL MCP 依次完成下列步骤，每步简要说明结果。

1. test_connection
2. show_databases 与 list_tables
3. 任选一表执行 describe_table、show_indexes、show_create_table
4. query 执行 SELECT 1 与一次分页查询
5. explain_query
6. 读取资源 mysql://databases、mysql://status/pool、mysql://schema/overview 及一张表的 mysql://schema/table/{表名}
7. 调用四个 Prompts（analyze-table、generate-query、optimize-query、data-overview）
8. 若确认测试库可写，再在临时表上演示 insert / update / delete、batch_execute、batch_insert，必要时 create_table
9. 若有存储过程则 call_procedure，否则说明跳过
10. （可选）若你配置了多 DSN 或运维类环境变量，再按 README 测 list_connections / use_connection 或 process_list 等
```

### 带反引号（与上文等价）

请通过已启用的 MySQL MCP **依次**完成：

1. `test_connection`
2. `show_databases` 与 `list_tables`
3. 任选一表执行 `describe_table`、`show_indexes`、`show_create_table`
4. `query` 执行 `SELECT 1` 与一次分页查询
5. `explain_query`
6. 读取资源 `mysql://databases`、`mysql://status/pool`、`mysql://schema/overview` 及一张表的 `mysql://schema/table/{表名}`
7. 调用四个 Prompts（`analyze-table`、`generate-query`、`optimize-query`、`data-overview`）
8. 若确认测试库可写，再在临时表上演示 `insert` / `update` / `delete`、`batch_execute`、`batch_insert`，必要时 `create_table`
9. 若有存储过程则 `call_procedure`，否则说明跳过
10. （可选）若你配置了多 DSN 或运维类环境变量，再按 README 测 `list_connections` / `use_connection` 或 `process_list` 等

## 安全与预期失败

- `MYSQL_READONLY=true` 时写入与 `create_table` 会失败，属预期。
- 无存储过程时跳过 `call_procedure`。
- 未注册的工具（如未开 `MYSQL_MCP_OPS_TOOLS` 时的 `process_list`）调用会失败或不可用，属预期。
- 可单独要求「尝试无 WHERE 的 UPDATE」验证拦截策略（应被拒绝）。
- **勿**在本文档或 Git 中写入真实密码。
