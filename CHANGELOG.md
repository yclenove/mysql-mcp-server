# 更新日志

本项目的所有重要变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [未发布]

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
