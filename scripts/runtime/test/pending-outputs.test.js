'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { makeSkillRoot, taskMd, tmp } = require('./_fixtures');
const { readJson } = require('../lib/json');
const { initState } = require('../lib/state');
const { loadWorkflow } = require('../lib/workflow');
const { registerArtifact } = require('../lib/artifacts');
const { enqueuePendingOutput, flushPendingOutputs } = require('../lib/pending-outputs');

function setup() {
  const root = makeSkillRoot({
    tasks: { context: { md: taskMd({ produces: [{ role: 'context-summary', primary: true }] }) } },
    roles: { 'context-summary': { kind: 'markdown', file: 'context-summary.md', dynamic: false } },
    workflow: { pipeline: [{ stage: 'context', atomTasks: { entry: ['context'], nodes: { context: {} } } }] },
  });
  const stateSchema = readJson(path.join(root, 'state.schema.json'));
  const state = initState({ workflowId: 'test', projectRoot: tmp(), skillName: 'ddo-code-flow', skillVersion: '5.0.0', skillRoot: root, workflowPath: 'workflows/test.json', runType: 'feat', args: {}, initialStage: 'context', stateSchema });
  return { root, stateSchema, state, workflow: loadWorkflow(root, 'workflows/test.json') };
}

describe('pending outputs', () => {
  it('artifactDir=null 时 base64 enqueue，重复同内容幂等、不同内容拒绝', () => {
    const fixture = setup();
    const result = registerArtifact({ stdin: '中文\n内容', role: 'context-summary', producer: 'context', state: fixture.state, skillRoot: fixture.root, workflow: fixture.workflow });
    const pending = enqueuePendingOutput({ state: fixture.state, pendingOutput: result.pendingOutput, historyEvent: result.historyEvent, stateSchema: fixture.stateSchema });
    assert.equal(Buffer.from(pending.pendingOutputs['context-summary'].content, 'base64').toString('utf8'), '中文\n内容');
    assert.equal(enqueuePendingOutput({ state: pending, pendingOutput: result.pendingOutput, historyEvent: result.historyEvent, stateSchema: fixture.stateSchema }).history.length, pending.history.length);
    const changed = registerArtifact({ stdin: 'different', role: 'context-summary', producer: 'context', state: fixture.state, skillRoot: fixture.root, workflow: fixture.workflow });
    assert.throws(() => enqueuePendingOutput({ state: pending, pendingOutput: changed.pendingOutput, historyEvent: changed.historyEvent, stateSchema: fixture.stateSchema }), /不同内容/);
  });
  it('flush 后清空 pending、登记 artifact，重复 flush 可重入', () => {
    const fixture = setup();
    const result = registerArtifact({ stdin: '内容', role: 'context-summary', producer: 'context', state: fixture.state, skillRoot: fixture.root, workflow: fixture.workflow });
    let state = enqueuePendingOutput({ state: fixture.state, pendingOutput: result.pendingOutput, historyEvent: result.historyEvent, stateSchema: fixture.stateSchema });
    const worktreePath = tmp();
    state = { ...state, worktreePath, artifactDir: path.join(worktreePath, '.ddo', 'runs', 'feat', '2026-08-29-x') };
    state = flushPendingOutputs({ state, workflow: fixture.workflow, effectiveConfig: {}, skillRoot: fixture.root, stateSchema: fixture.stateSchema });
    assert.deepEqual(state.pendingOutputs, {});
    assert.ok(state.artifacts['context-summary']);
    assert.equal(fs.readFileSync(path.join(state.artifactDir, 'context-summary.md'), 'utf8'), '内容');
    assert.equal(flushPendingOutputs({ state, workflow: fixture.workflow, effectiveConfig: {}, skillRoot: fixture.root, stateSchema: fixture.stateSchema }).history.length, state.history.length);
  });
});
