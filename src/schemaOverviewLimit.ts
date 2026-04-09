/**
 * Resource mysql://schema/overview 的体积控制（减少 token 与 information_schema 查询次数）。
 */

const DEFAULT_MAX_EXPAND = 50;
/** 未展开表名在正文中的最大列出数量，超出用省略提示 */
export const SCHEMA_OVERVIEW_NAMES_TAIL_CAP = 80;
/** maxExpand=0 时仅表名模式下列出的最大数量 */
export const SCHEMA_OVERVIEW_NAMES_ONLY_CAP = 300;

/**
 * 最多为多少张表拉取列信息。未设置默认 50；0 表示仅输出表名、不查列；非法值按 50。
 */
export function getSchemaOverviewMaxExpandTables(): number {
  const raw = process.env.MCP_SCHEMA_OVERVIEW_MAX_TABLES;
  if (raw === undefined || String(raw).trim() === '') {
    return DEFAULT_MAX_EXPAND;
  }
  const n = parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n) || n < 0) {
    return DEFAULT_MAX_EXPAND;
  }
  return n;
}

export function splitTablesForSchemaOverview(
  tableNames: string[],
  maxExpand: number
): { expand: string[]; namesOnly: string[] } {
  if (maxExpand <= 0) {
    return { expand: [], namesOnly: tableNames };
  }
  if (tableNames.length <= maxExpand) {
    return { expand: tableNames, namesOnly: [] };
  }
  return {
    expand: tableNames.slice(0, maxExpand),
    namesOnly: tableNames.slice(maxExpand),
  };
}

/**
 * 逗号分隔表名；超过 maxListed 条时截断并提示总数。
 */
export function formatTableNamesTail(names: string[], maxListed: number): string {
  if (names.length === 0) {
    return '';
  }
  if (names.length <= maxListed) {
    return names.join(', ');
  }
  return `${names.slice(0, maxListed).join(', ')} …（共 ${names.length} 张，其余请用 list_tables 或 Resource mysql://schema/table/{表名}）`;
}
