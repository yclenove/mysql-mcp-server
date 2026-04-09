import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { explainRowsToWarnings, EXPLAIN_LARGE_ROWS_THRESHOLD } from '../dist/explainWarnings.js';

describe('explainRowsToWarnings', () => {
  it('空或非数组应返回空', () => {
    assert.deepEqual(explainRowsToWarnings([]), []);
    assert.deepEqual(explainRowsToWarnings(null), []);
  });

  it('应识别 ALL 全表扫描', () => {
    const w = explainRowsToWarnings([{ type: 'ALL', table: 't1' }]);
    assert.ok(w.some((x) => x.includes('ALL')));
  });

  it('应识别无索引且非 const/system', () => {
    const w = explainRowsToWarnings([{ type: 'ALL', key: null }]);
    assert.ok(w.some((x) => x.includes('索引')));
  });

  it('const 不应因 key 空报无索引', () => {
    const w = explainRowsToWarnings([{ type: 'const', key: null }]);
    assert.equal(
      w.some((x) => x.includes('未使用索引')),
      false
    );
  });

  it('应识别 Extra 中 filesort / temporary', () => {
    const w = explainRowsToWarnings([
      { type: 'ref', key: 'idx', Extra: 'Using where; Using filesort' },
    ]);
    assert.ok(w.some((x) => x.includes('filesort')));
    const w2 = explainRowsToWarnings([{ type: 'ref', key: 'idx', Extra: 'Using temporary' }]);
    assert.ok(w2.some((x) => x.includes('temporary')));
  });

  it('应识别大 rows 估算', () => {
    const w = explainRowsToWarnings([
      { type: 'range', key: 'idx', rows: EXPLAIN_LARGE_ROWS_THRESHOLD },
    ]);
    assert.ok(w.some((x) => x.includes(String(EXPLAIN_LARGE_ROWS_THRESHOLD))));
  });

  it('应去重相同告警', () => {
    const w = explainRowsToWarnings([
      { type: 'ALL', table: 'a' },
      { type: 'ALL', table: 'b' },
    ]);
    assert.equal(w.filter((x) => x.includes('ALL')).length, 1);
  });
});
