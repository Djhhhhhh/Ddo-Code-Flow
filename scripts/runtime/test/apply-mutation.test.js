'use strict';
// applyMutation 写守卫：x-ddo-writer → field→writer 表（G4 / AC-4）。
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { ROOT, tmp } = require('./_fixtures');
const { readJson } = require('../lib/json');
const { initState, applyMutation } = require('../lib/state');

const schema = readJson(path.join(ROOT, 'state.schema.json'));

function baseState() {
  return initState({
    workflowId: 'guarded',
    projectRoot: tmp(),
    skillName: 'ddo-code-flow',
    skillVersion: '4.0.0',
    skillRoot: ROOT,
    workflowPath: 'workflows/guarded.json',
    runType: 'feat',
    args: {},
  });
}

describe('applyMutation 写守卫（G4 / AC-4）', () => {
  it('越权写他人 x-ddo-writer 字段 exit 1', () => {
    const state = baseState();
    assert.throws(
      () => applyMutation(state, { runId: 'x' }, 'runtime', schema),
      (e) => e.exitCode === 1 && /越权/.test(e.message)
    );
  });

  it('自造顶层字段被 additionalProperties:false 拦截 exit 1', () => {
    const state = baseState();
    assert.throws(
      () => applyMutation(state, { foo: 1 }, 'runtime', schema),
      (e) => e.exitCode === 1 && /自造|additionalProperties/.test(e.message)
    );
  });

  it('合法写（writer 拥有字段）成功合并', () => {
    const state = baseState();
    const next = applyMutation(state, { currentStage: 'planning' }, 'runtime', schema);
    assert.equal(next.currentStage, 'planning');
  });
});
