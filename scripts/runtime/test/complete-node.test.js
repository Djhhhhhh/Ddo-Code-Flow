'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { makeSkillRoot, taskMd, tmp } = require('./_fixtures');
const { loadWorkflow } = require('../lib/workflow');
const { completeNode } = require('../lib/completion');

function fixture(produces, node = {}) {
  const roles = Object.fromEntries(produces.map((item) => [item.role, { kind: 'markdown', file: `${item.role}.md`, dynamic: false }]));
  const root = makeSkillRoot({ tasks: { task: { md: taskMd({ produces }) } }, roles, workflow: { pipeline: [{ stage: 'x', atomTasks: { entry: ['node'], nodes: { node: { taskRef: 'task', ...node } } } }] } });
  const worktreePath = tmp();
  const artifactDir = path.join(worktreePath, '.ddo', 'runs', 'feat', '2026-08-29-x');
  fs.mkdirSync(artifactDir, { recursive: true });
  return { root, workflow: loadWorkflow(root, 'workflows/test.json'), worktreePath, artifactDir };
}

function record(fixture, role, producer = 'node', stage = 'x') {
  const file = path.join(fixture.artifactDir, `${role}.md`);
  fs.writeFileSync(file, 'x');
  return { path: `run://${path.relative(fixture.worktreePath, file).split(path.sep).join('/')}`, producer, task: 'task', stage, at: '2026-08-29T00:00:00Z' };
}

describe('complete-node', () => {
  it('单产物、多产物和零产物按声明完成', () => {
    const one = fixture([{ role: 'a' }]);
    const state = { currentStage: 'x', projectRoot: tmp(), worktreePath: one.worktreePath, artifacts: { a: record(one, 'a') }, pendingOutputs: {}, history: [] };
    assert.equal(completeNode({ state, workflow: one.workflow, skillRoot: one.root, nodeName: 'node' }).historyEvent.event, 'node-done');
    const multi = fixture([{ role: 'a' }, { role: 'b' }]);
    assert.throws(() => completeNode({ state: { ...state, worktreePath: multi.worktreePath, artifacts: { a: record(multi, 'a') } }, workflow: multi.workflow, skillRoot: multi.root, nodeName: 'node' }), /尚未登记.*b/);
    const zero = fixture([]);
    assert.equal(completeNode({ state: { ...state, worktreePath: zero.worktreePath, artifacts: {} }, workflow: zero.workflow, skillRoot: zero.root, nodeName: 'node' }).status, 'complete');
  });
  it('拒绝 producer/stage 不匹配、pending、disabled 和未解决失败', () => {
    const item = fixture([{ role: 'a' }]);
    const base = { currentStage: 'x', projectRoot: tmp(), worktreePath: item.worktreePath, artifacts: { a: record(item, 'a') }, pendingOutputs: {}, history: [] };
    assert.throws(() => completeNode({ state: { ...base, artifacts: { a: record(item, 'a', 'other') } }, workflow: item.workflow, skillRoot: item.root, nodeName: 'node' }), /producer/);
    assert.throws(() => completeNode({ state: { ...base, artifacts: { a: record(item, 'a', 'node', 'y') } }, workflow: item.workflow, skillRoot: item.root, nodeName: 'node' }), /stage/);
    assert.throws(() => completeNode({ state: { ...base, pendingOutputs: { a: {} } }, workflow: item.workflow, skillRoot: item.root, nodeName: 'node' }), /pending/);
    assert.throws(() => completeNode({ state: base, workflow: item.workflow, effectiveConfig: { atomTaskOverrides: { task: { enabled: false } } }, skillRoot: item.root, nodeName: 'node' }), /disabled/);
    assert.throws(() => completeNode({ state: { ...base, history: [{ event: 'node-failed', stage: 'x', node: 'node', at: '2026-01-01T00:00:00Z' }] }, workflow: item.workflow, skillRoot: item.root, nodeName: 'node' }), /node-failed/);
  });
  it('重复 complete 幂等，reset 后允许重新完成', () => {
    const item = fixture([]);
    const done = { event: 'node-done', stage: 'x', node: 'node', at: '2026-01-01T00:00:00Z' };
    const base = { currentStage: 'x', projectRoot: tmp(), worktreePath: item.worktreePath, artifacts: {}, pendingOutputs: {}, history: [done] };
    assert.equal(completeNode({ state: base, workflow: item.workflow, skillRoot: item.root, nodeName: 'node' }).status, 'already-complete');
    const reset = { ...base, history: [done, { event: 'node-reset', stage: 'x', node: 'node', at: '2026-01-02T00:00:00Z' }] };
    assert.equal(completeNode({ state: reset, workflow: item.workflow, skillRoot: item.root, nodeName: 'node' }).status, 'complete');
  });
});
