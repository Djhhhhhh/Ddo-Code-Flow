'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { advanceStage } = require('../lib/advance');

function stage(name, nodes = ['node'], enabled = true) {
  return { stage: name, enabled, atomTasks: { nodes: Object.fromEntries(nodes.map((node) => [node, {}])) } };
}

function done(node, stageName, at = '2026-08-29T00:00:00Z') { return { event: 'node-done', node, stage: stageName, at }; }

describe('advance-stage', () => {
  it('推进到下一真实 stage，并跳过 disabled stage', () => {
    const workflow = { pipeline: [stage('a', ['one']), stage('skip', [], false), stage('b', ['two'])], confirmationGates: [] };
    const state = { currentStage: 'a', stages: { a: { status: 'running' } }, artifacts: {}, pendingOutputs: {}, history: [done('one', 'a')] };
    const result = advanceStage(state, workflow);
    assert.equal(result.currentStage, 'b');
    assert.equal(result.patch.stages.a.status, 'done');
    assert.equal(result.patch.stages.b.status, 'running');
    assert.equal(state.currentStage, 'a');
  });
  it('最后真实 stage 完成后进入 done，但不创建 done stage', () => {
    const workflow = { pipeline: [stage('cleanup', ['cleanup-worktree'])], confirmationGates: [] };
    const state = { currentStage: 'cleanup', stages: { cleanup: { status: 'running' } }, artifacts: {}, pendingOutputs: {}, history: [done('cleanup-worktree', 'cleanup')] };
    const result = advanceStage(state, workflow);
    assert.equal(result.currentStage, 'done');
    assert.equal(Object.prototype.hasOwnProperty.call(result.patch.stages, 'done'), false);
  });
  it('未完成、failed/running/waiting-human 均阻止推进', () => {
    const workflow = { pipeline: [stage('a', ['one'])], confirmationGates: [] };
    const base = { currentStage: 'a', stages: { a: { status: 'running' } }, artifacts: {}, pendingOutputs: {}, history: [] };
    assert.throws(() => advanceStage(base, workflow), /未完成/);
    for (const event of ['node-failed', 'node-running', 'waiting-human']) {
      assert.throws(() => advanceStage({ ...base, history: [done('one', 'a'), { event, node: 'one', stage: 'a', at: '2026-08-30T00:00:00Z' }] }, workflow), new RegExp(event));
    }
  });
  it('最新 gate 必须 approved，pendingOutputs 阻止终态', () => {
    const workflow = { pipeline: [stage('spec', ['one'])], confirmationGates: ['spec'] };
    const base = { currentStage: 'spec', stages: { spec: { status: 'running' } }, artifacts: {}, pendingOutputs: {}, history: [done('one', 'spec'), { event: 'gate-approved', stage: 'spec', at: '2026-08-29T00:00:01Z' }] };
    assert.equal(advanceStage(base, workflow).currentStage, 'done');
    assert.throws(() => advanceStage({ ...base, history: [...base.history, { event: 'gate-pending', stage: 'spec', at: '2026-08-29T00:00:02Z' }] }, workflow), /approved/);
    assert.throws(() => advanceStage({ ...base, pendingOutputs: { x: { stage: 'spec' } } }, workflow), /pendingOutputs/);
  });
});
