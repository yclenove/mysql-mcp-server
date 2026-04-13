# AI / 协作者约定

## MCP 与 Token 节约

修改 **Tools / Resources / Prompts**（`server.tool`、`server.resource`、`server.prompt`、工具描述、Zod 字段说明、`getToolsDescription`）时，须把 **LLM 上下文体积** 当作硬约束：在不影响安全与可理解性的前提下，优先更短的描述与更紧凑的返回。

要点：

- 工具 **description**：一句话，写清能力 + 关键约束（只读、须 WHERE、条数上限）；不写与 JSON Schema 重复的说明书。
- **Zod `.describe()`**：能短则短；参数含义在 schema 类型已明时可省略赘述。
- **工具返回**：紧凑 JSON；默认不附带调试字段。
- **Resources**：注册时的 `description` 保持短；正文避免堆砌与 `describe_table` 重复的长注释（需要注释再查表工具）。
- **Prompts**：元数据描述短；正文步骤够用即可，避免与工具描述逐字重复。
- **新增工具**：先评估能否合并进现有工具，避免 `list_tools` 体积膨胀。

若本机存在 `.cursor/rules/mcp-token-economy.mdc`，可与本文件对照（该目录默认不纳入 Git，以本文件为准）。
