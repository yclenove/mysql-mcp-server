import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  explainJsonDocumentToWarnings,
  explainJsonStringToWarnings,
} from '../dist/explainWarnings.js';

describe('explainJsonDocumentToWarnings', () => {
  it('应识别嵌套 access_type ALL', () => {
    const doc = {
      query_block: {
        table: {
          access_type: 'ALL',
          key: null,
          rows_examined_per_scan: 5,
        },
      },
    };
    const w = explainJsonDocumentToWarnings(doc);
    assert.ok(w.some((x) => x.includes('ALL')));
  });

  it('explainJsonStringToWarnings 非法 JSON 应返回空', () => {
    assert.deepEqual(explainJsonStringToWarnings('not json'), []);
  });
});
