/**
 * MySQL MCP Server 类型定义
 */

// 数据库连接配置
export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database?: string;
  connectionLimit?: number;
  queueLimit?: number;
  timeout?: number;
  queryTimeout?: number;
  retryCount?: number;
  retryDelayMs?: number;
  maxRows?: number;
  ssl?: {
    ca?: string;
    cert?: string;
    key?: string;
  };
}

// SQL 执行结果
export interface QueryResult {
  success: boolean;
  data?: any[];
  truncated?: boolean;
  totalRows?: number;
  affectedRows?: number;
  insertId?: number;
  changedRows?: number;
  message?: string;
  error?: string;
  executionTime?: number;
}

// 批量执行结果
export interface BatchResult {
  success: boolean;
  results: QueryResult[];
  totalStatements: number;
  successCount: number;
  errorCount: number;
  error?: string;
}

// 表结构信息
export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  default: any;
  comment: string;
  isPrimaryKey: boolean;
  isAutoIncrement: boolean;
}

// 表信息
export interface TableInfo {
  name: string;
  engine: string;
  rows: number;
  dataLength: number;
  createTime: Date;
  updateTime: Date;
  comment: string;
}

// 执行模式
export enum ExecutionMode {
  READONLY = 'readonly',
  READWRITE = 'readwrite',
}
