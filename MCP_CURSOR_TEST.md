# 在 Cursor 中用手动对话测试 MySQL MCP（全功能清单）

> **English**: Use this checklist in Cursor **Agent** chat with the MySQL MCP enabled. Do not commit secrets; write/DDL only on disposable test tables.

## 前置条件

1. **Settings → Tools & MCP**：`mysql-mcp`（或你在 `.cursor/mcp.json` 中的名称）已启用。
2. **工作区**：打开本仓库**根目录**，使进程能加载项目根目录的 `.env`（见 [README.md](./README.md)「配置」）。
3. **对话**：使用支持 MCP 工具的模型；必要时开启「使用 MCP 工具」类选项。

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
| Resources | 读取 MCP 资源：`mysql://databases`、`mysql://status/pool`、`mysql://schema/overview`、`mysql://schema/table/{表名}`。 | 四类 Resource |
| Prompts | 使用 MCP Prompts：`analyze-table`（指定表名）、`generate-query`、`optimize-query`（给一条 SELECT）、`data-overview`。 | 四个 Prompt |

## 一条「总控」提示（可整段粘贴）

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

每步简要说明结果。

## 安全与预期失败

- `MYSQL_READONLY=true` 时写入与 `create_table` 会失败，属预期。
- 无存储过程时跳过 `call_procedure`。
- 可单独要求「尝试无 WHERE 的 UPDATE」验证拦截策略（应被拒绝）。
- **勿**在本文档或 Git 中写入真实密码。
