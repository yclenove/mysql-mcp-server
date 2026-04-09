/**
 * EXPLAIN 结果行启发式告警（短句中文，供 explain_query 附加）
 */

export const EXPLAIN_LARGE_ROWS_THRESHOLD = 10000;

type ExplainRow = Record<string, unknown>;

function str(row: ExplainRow, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return String(v);
    }
  }
  return undefined;
}

function num(row: ExplainRow, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === 'number' && Number.isFinite(v)) {
      return v;
    }
    if (typeof v === 'string' && v.trim() !== '') {
      const n = parseInt(v, 10);
      if (Number.isFinite(n)) {
        return n;
      }
    }
  }
  return undefined;
}

/**
 * 对 EXPLAIN 结果行生成告警列表（去重后按出现顺序）
 */
export function explainRowsToWarnings(rows: unknown[]): string[] {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const out: string[] = [];

  const push = (msg: string) => {
    if (!seen.has(msg)) {
      seen.add(msg);
      out.push(msg);
    }
  };

  for (const raw of rows) {
    const row = raw as ExplainRow;
    const accessType = str(row, 'type', 'Type')?.toLowerCase();
    const keyVal = str(row, 'key', 'Key');
    const extra = str(row, 'Extra', 'extra') ?? '';
    const rowsEst = num(row, 'rows', 'Rows');

    if (accessType === 'all') {
      push('存在 access=ALL（全表扫描）');
    }

    if (accessType && !['const', 'system', 'eq_ref'].includes(accessType)) {
      if (!keyVal || keyVal === 'NULL') {
        push('某行未使用索引（key 为空且非 const/system）');
      }
    }

    const extraLower = extra.toLowerCase();
    if (extraLower.includes('using filesort')) {
      push('Extra 含 Using filesort（可能需排序优化）');
    }
    if (extraLower.includes('using temporary')) {
      push('Extra 含 Using temporary（可能使用临时表）');
    }

    if (rowsEst !== undefined && rowsEst >= EXPLAIN_LARGE_ROWS_THRESHOLD) {
      push(`估算扫描行数较大（rows≥${EXPLAIN_LARGE_ROWS_THRESHOLD}）`);
    }
  }

  return out;
}
