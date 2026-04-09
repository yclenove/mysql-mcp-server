# MySQL MCP Server

**简体中文 | [English](./README_en.md)**

一个基于 Node.js 的 MySQL MCP (Model Context Protocol) 服务器，支持通过 MCP 协议操作 MySQL 数据库。

## 快速开始（1 分钟）

```bash
npm install
cp .env.example .env
npm run build
npm start
```

默认启动后会从当前工作目录加载 `.env`，并在 stderr 输出连接信息。

## 功能特性

### 查询类工具
- **select / query** - 执行 SELECT 查询

### 修改类工具
- **insert** - 执行 INSERT 插入
- **update** - 执行 UPDATE 更新  
- **delete** - 执行 DELETE 删除
- **execute** - 通用执行（INSERT/UPDATE/DELETE）

### 批量操作工具
- **batch_execute** - 批量执行 SQL（自动使用事务）
- **batch_query** - 批量查询（只读）
- **batch_insert** - 批量插入

### 元数据工具
- **show_databases** - 获取所有数据库
- **list_tables** - 获取表列表
- **describe_table** - 获取表结构
- **show_indexes** - 获取表索引
- **show_create_table** - 获取建表语句

## 安全特性

### 🔒 参数化查询防 SQL 注入
所有工具均使用参数化查询，有效防止 SQL 注入攻击：
```javascript
// ✅ 安全：使用参数化查询
{ "sql": "SELECT * FROM users WHERE id = ?", "params": [1] }

// ❌ 危险：直接拼接 SQL（本工具不支持）
{ "sql": "SELECT * FROM users WHERE id = 1 OR 1=1" }
```

### 🛡️ 危险操作拦截
DELETE 和 UPDATE 语句必须包含 WHERE 条件，否则自动拒绝执行：
```javascript
// ❌ 被拒绝：缺少 WHERE 条件
{ "sql": "DELETE FROM users" }
// 错误：危险操作：DELETE 或 UPDATE 语句缺少 WHERE 子句，拒绝执行

// ✅ 允许执行
{ "sql": "DELETE FROM users WHERE id = ?", "params": [1] }
```

### 📖 只读模式（MYSQL_READONLY）
通过环境变量启用只读模式，禁止一切写入操作，适合生产环境查询：

```bash
# 启用只读模式
MYSQL_READONLY=true
```

**只读模式的防护层级：**

| 层级 | 防护机制 | 说明 |
|------|----------|------|
| 第一层 | 工具层拦截 | `insert`/`update`/`delete`/`execute` 工具直接拒绝执行 |
| 第二层 | 批量过滤 | `batch_execute` 自动过滤非查询语句 |
| 第三层 | 执行层检查 | 底层执行器最终校验，只允许 SELECT/SHOW/DESCRIBE |

**示例 - 只读模式下的行为：**
```javascript
// ❌ 被拒绝（工具层）
{ "sql": "INSERT INTO users (name) VALUES ('test')" }
// 错误：当前处于只读模式，禁止执行 INSERT/UPDATE/DELETE 操作

// ❌ 被拒绝（批量操作）
{ "statements": [
  { "sql": "SELECT * FROM users" },
  { "sql": "DELETE FROM logs WHERE id = 1" }
]}
// 错误：只读模式下禁止执行 1 条写入语句

// ✅ 允许执行
{ "sql": "SELECT * FROM users WHERE id = 1" }
{ "sql": "SHOW TABLES" }
{ "sql": "DESCRIBE users" }
```

### 🔗 批量操作事务保护
批量操作自动使用事务，任一语句失败则全部回滚，保证数据一致性：
```javascript
// 两条语句在同一个事务中执行
{ "statements": [
  { "sql": "INSERT INTO orders (user_id) VALUES (?)", "params": [1] },
  { "sql": "UPDATE users SET order_count = order_count + 1 WHERE id = ?", "params": [1] }
]}
// 如果第二条失败，第一条自动回滚
```

## 安装

### 通过 npm 安装（推荐）

```bash
# 全局安装
npm install -g @wenit/mysql-mcp-server

# 或在项目中安装
npm install @wenit/mysql-mcp-server
```

### 从源码安装

```bash
# 克隆或下载项目
cd mysql-mcp-server

# 安装依赖
npm install

# 编译 TypeScript
npm run build
```

## 配置

### 环境变量

创建 `.env` 文件或设置以下环境变量：

```bash
# 必需配置
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=test

# 可选配置
MYSQL_CONNECTION_LIMIT=10
MYSQL_QUERY_TIMEOUT=30000   # 单条查询超时（毫秒）
MYSQL_RETRY_COUNT=2         # 可重试错误重试次数
MYSQL_RETRY_DELAY_MS=200    # 重试基础延时（毫秒，指数退避）
MYSQL_MAX_ROWS=1000         # 单次返回最大行数（超出会截断）

# 安全相关配置
MYSQL_READONLY=false        # 启用只读模式（true/false）

# SSL 配置（可选）
MYSQL_SSL_CA=/path/to/ca.pem
```

### Claude Desktop 配置

编辑 `claude_desktop_config.json`：

#### 方式一：使用 npx（推荐，无需全局安装）

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

#### 方式二：使用全局安装的包

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

#### 方式三：使用本地路径

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

配置文件位置：
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

#### 只读模式配置示例

生产环境建议启用只读模式，防止误操作：

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

## 使用示例

### 查询数据
```javascript
// 使用 select 工具
{
  "sql": "SELECT * FROM users WHERE age > ?",
  "params": [18]
}
```

### 插入数据
```javascript
// 使用 insert 工具
{
  "sql": "INSERT INTO users (name, email) VALUES (?, ?)",
  "params": ["张三", "zhangsan@example.com"]
}

// 或使用批量插入
{
  "table": "users",
  "records": [
    { "name": "张三", "email": "zs@example.com" },
    { "name": "李四", "email": "ls@example.com" }
  ]
}
```

### 更新数据
```javascript
// 使用 update 工具
{
  "sql": "UPDATE users SET age = ? WHERE id = ?",
  "params": [25, 1]
}
```

### 查看表结构
```javascript
// 使用 describe_table 工具
{
  "table": "users"
}
```

### 批量执行
```javascript
// 使用 batch_execute 工具
{
  "statements": [
    { "sql": "INSERT INTO logs (action) VALUES (?)", "params": ["login"] },
    { "sql": "UPDATE users SET last_login = NOW() WHERE id = ?", "params": [1] }
  ]
}
```

## 开发

```bash
# 开发模式（自动编译）
npm run dev

# 启动服务器
npm start

# 使用 MCP Inspector 测试
npm run inspector
```

## 注意事项

1. **安全性**：
   - 生产环境强烈建议启用 `MYSQL_READONLY=true` 只读模式
   - 即使是开发环境，也建议先使用只读模式熟悉数据结构
   - 所有写入操作都有 WHERE 条件检查，防止误删全表数据

2. **连接池**：默认连接池大小为 10，可通过 `MYSQL_CONNECTION_LIMIT` 调整

3. **超时**：默认连接超时为 60 秒，可通过 `MYSQL_TIMEOUT` 调整
4. **查询保护**：
   - 单条查询支持 `MYSQL_QUERY_TIMEOUT` 超时保护
   - 只读查询在瞬时错误下会自动退避重试
   - 单次返回结果受 `MYSQL_MAX_ROWS` 限制，超出时返回 `truncated=true`

5. **只读模式限制**：
   - 只允许执行 `SELECT`、`SHOW`、`DESCRIBE`、`DESC`、`EXPLAIN` 语句
   - `batch_execute` 中的写入语句会被自动过滤
   - 修改类工具（insert/update/delete/execute）会直接返回错误

## License

MIT
