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

/**
 * 遍历 EXPLAIN FORMAT=JSON 文档，复用行式告警规则（嵌套 table 节点）
 */
export function explainJsonDocumentToWarnings(doc: unknown): string[] {
  const seen = new Set<string>();
  const acc: string[] = [];

  const visit = (node: unknown): void => {
    if (node === null || typeof node !== 'object') {
      return;
    }
    const o = node as Record<string, unknown>;
    const accessType = typeof o.access_type === 'string' ? o.access_type.toLowerCase() : undefined;
    const keyRaw = o.key;
    const keyStr =
      keyRaw === null || keyRaw === undefined
        ? ''
        : typeof keyRaw === 'string'
          ? keyRaw
          : String(keyRaw);
    const rowsExamined =
      typeof o.rows_examined_per_scan === 'number'
        ? o.rows_examined_per_scan
        : typeof o.rows === 'number'
          ? o.rows
          : undefined;
    let extraStr = '';
    if (Array.isArray(o.extra)) {
      extraStr = o.extra.join(' ');
    } else if (typeof o.extra === 'string') {
      extraStr = o.extra;
    }
    if (accessType) {
      const synthetic = {
        type: accessType,
        key: keyStr || undefined,
        rows: rowsExamined,
        Extra: extraStr,
      };
      for (const w of explainRowsToWarnings([synthetic])) {
        if (!seen.has(w)) {
          seen.add(w);
          acc.push(w);
        }
      }
    }
    for (const v of Object.values(o)) {
      if (typeof v === 'object' && v !== null) {
        visit(v);
      }
    }
  };

  visit(doc);
  return acc;
}

export function explainJsonStringToWarnings(jsonStr: string): string[] {
  try {
    const doc = JSON.parse(jsonStr) as unknown;
    return explainJsonDocumentToWarnings(doc);
  } catch {
    return [];
  }
}
