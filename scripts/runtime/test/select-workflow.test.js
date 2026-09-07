'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ROOT } = require('./_fixtures');
const { readJson } = require('../lib/json');
const { selectWorkflow } = require('../lib/workflow');

const config = readJson(`${ROOT}/config.default.json`);

describe('workflow selection', () => {
  it('model 精确命中，unknown/research 失败', () => {
    assert.equal(selectWorkflow({ skillRoot: ROOT, effectiveConfig: config, model: 'guarded' }).workflowId, 'guarded');
    assert.throws(() => selectWorkflow({ skillRoot: ROOT, effectiveConfig: config, model: 'research' }), /未知 workflow id/);
  });
  it('关键词只匹配 text，fallback 和 defaultRunType 生效', () => {
    assert.equal(selectWorkflow({ skillRoot: ROOT, effectiveConfig: config, text: 'remote gate issue driven' }).workflowId, 'issue-driven');
    assert.equal(selectWorkflow({ skillRoot: ROOT, effectiveConfig: config, text: '普通需求' }).workflowId, config.workflows.default);
    assert.equal(selectWorkflow({ skillRoot: ROOT, effectiveConfig: { ...config, base: { ...config.base, defaultRunType: 'fix' } } }).runType, 'fix');
  });
  it('禁止 override 与 feature+bugfix 冲突时失败', () => {
    const blocked = { ...config, workflows: { ...config.workflows, selection: { ...config.workflows.selection, allowUserOverride: false } } };
    assert.throws(() => selectWorkflow({ skillRoot: ROOT, effectiveConfig: blocked, model: 'standard' }), /禁止/);
    assert.throws(() => selectWorkflow({ skillRoot: ROOT, effectiveConfig: config, feature: true, bugfix: true }), /不能同时/);
  });
});
