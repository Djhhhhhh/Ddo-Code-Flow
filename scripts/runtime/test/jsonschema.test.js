'use strict';
// 最小 draft-2020-12 子集校验器（G9 / DEC-3）。
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { ROOT } = require('./_fixtures');
const { validate } = require('../lib/jsonschema');
const { readJson } = require('../lib/json');

describe('最小 JSON Schema 子集校验器（G9 / DEC-3）', () => {
  it('type/required/properties/additionalProperties 生效', () => {
    const schema = { type: 'object', required: ['a'], properties: { a: { type: 'string' } }, additionalProperties: false };
    assert.equal(validate(schema, { a: 'x' }).valid, true);
    assert.equal(validate(schema, { a: 1 }).valid, false);
    assert.equal(validate(schema, { b: 1 }).valid, false);
    assert.equal(validate(schema, { a: 'x', extra: 1 }).valid, false);
  });

  it('$ref 局部解析 + enum/const/pattern/minLength/minItems/items/oneOf', () => {
    const schema = {
      type: 'object',
      properties: {
        s: { $ref: '#/$defs/s' },
        e: { enum: ['a', 'b'] },
        c: { const: 'k' },
        p: { pattern: '^[0-9]+$' },
        l: { minLength: 2 },
        arr: { type: 'array', minItems: 1, items: { type: 'integer' } },
        o: { oneOf: [{ type: 'string' }, { type: 'integer' }] },
      },
      $defs: { s: { type: 'string' } },
    };
    assert.equal(validate(schema, { s: 'ok', e: 'a', c: 'k', p: '123', l: 'ab', arr: [1], o: 'x' }).valid, true);
    assert.equal(validate(schema, { s: 5 }).valid, false);
    assert.equal(validate(schema, { e: 'z' }).valid, false);
    assert.equal(validate(schema, { c: 'nope' }).valid, false);
    assert.equal(validate(schema, { p: 'abc' }).valid, false);
    assert.equal(validate(schema, { l: 'a' }).valid, false);
    assert.equal(validate(schema, { arr: [] }).valid, false);
    assert.equal(validate(schema, { arr: ['x'] }).valid, false);
    assert.equal(validate(schema, { o: true }).valid, false);
  });

  it('format:date-time 用轻量正则校验', () => {
    const schema = { type: 'string', format: 'date-time' };
    assert.equal(validate(schema, '2026-08-24T10:30:00.000Z').valid, true);
    assert.equal(validate(schema, 'not-a-date').valid, false);
  });

  it('未知关键字忽略而不报错', () => {
    const schema = { type: 'string', 'x-ddo-writer': 'runtime', description: 'x' };
    assert.equal(validate(schema, 'x').valid, true);
  });

  it('全部现有 schema 文件为合法 JSON 对象', () => {
    const files = [
      'state.schema.json',
      'config.schema.json',
      'atom-tasks/_schema/atom-task-md.schema.json',
      'atom-tasks/_schema/artifact-catalog.schema.json',
      'atom-tasks/_schema/output-schema.schema.json',
    ];
    for (const f of files) {
      const schema = readJson(path.join(ROOT, f));
      assert.ok(schema && typeof schema === 'object', `${f} 应为对象`);
    }
  });
});
