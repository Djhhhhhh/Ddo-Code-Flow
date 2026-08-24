'use strict';
// validate-output 按 outputSchemaRef 硬校验节点产出（G2 / AC-2）。
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { ROOT, tmp, write } = require('./_fixtures');
const { validateOutput } = require('../lib/artifacts');
const { validate } = require('../lib/jsonschema');
const { initState } = require('../lib/state');
const { readJson } = require('../lib/json');

describe('validate-output（G2 / AC-2）', () => {
  it('json 产物缺必需字段 → valid:false', () => {
    const d = tmp();
    const artifact = path.join(d, 'out.json');
    write(artifact, JSON.stringify({ a: 1 }));
    const schemaPath = path.join(d, 'schema.json');
    write(schemaPath, JSON.stringify({
      outputFormat: 'json',
      jsonFields: [
        { name: 'a', type: 'integer', required: true },
        { name: 'b', type: 'string', required: true },
      ],
    }));
    const r = validateOutput({ artifactPath: artifact, outputSchemaRef: schemaPath, skillRoot: d });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes('b')));
  });

  it('markdown 含全部 required section → valid:true', () => {
    const d = tmp();
    const artifact = path.join(d, 'out.md');
    write(artifact, '# 标题\n\n## G1. 概述\n内容\n');
    const schemaPath = path.join(d, 'schema.json');
    write(schemaPath, JSON.stringify({ outputFormat: 'markdown', sections: [{ heading: 'G1.', required: true }] }));
    const r = validateOutput({ artifactPath: artifact, outputSchemaRef: schemaPath, skillRoot: d });
    assert.equal(r.valid, true);
  });

  it('markdown 缺 required section → valid:false', () => {
    const d = tmp();
    const artifact = path.join(d, 'out.md');
    write(artifact, '# 标题\n\n内容\n');
    const schemaPath = path.join(d, 'schema.json');
    write(schemaPath, JSON.stringify({ outputFormat: 'markdown', sections: [{ heading: 'G1.', required: true }] }));
    const r = validateOutput({ artifactPath: artifact, outputSchemaRef: schemaPath, skillRoot: d });
    assert.equal(r.valid, false);
  });

  it('.state.json 按 state.schema.json 校验，additionalProperties:false 拦截自造字段', () => {
    const schema = readJson(path.join(ROOT, 'state.schema.json'));
    const state = initState({
      workflowId: 'guarded',
      projectRoot: tmp(),
      skillName: 'ddo-code-flow',
      skillVersion: '4.0.0',
      skillRoot: ROOT,
      workflowPath: 'workflows/guarded.json',
      runType: 'feat',
      args: {},
    });
    assert.equal(validate(schema, state).valid, true);
    state.extraField = true;
    const r = validate(schema, state);
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes('extraField')));
  });
});
