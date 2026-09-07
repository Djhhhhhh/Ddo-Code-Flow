'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { makeSkillRoot, taskMd, tmp } = require('./_fixtures');
const { readJson, writeJsonAtomic } = require('../lib/json');
const { initState } = require('../lib/state');
const { loadWorkflow } = require('../lib/workflow');
const { registerArtifact } = require('../lib/artifacts');
const { enqueuePendingOutput, attachWorktree, getBootstrapStatePath } = require('../lib/pending-outputs');

function setup() {
  const root = makeSkillRoot({
    tasks: {
      context: { md: taskMd({ produces: [{ role: 'context-summary', primary: true }] }) },
      'git-worktree': { md: taskMd({ produces: [{ role: 'worktree-info', kind: 'json', primary: true }] }) },
    },
    roles: {
      'context-summary': { kind: 'markdown', file: 'context-summary.md', dynamic: false },
      'worktree-info': { kind: 'json', file: 'worktree-info.json', dynamic: false },
    },
    workflow: { pipeline: [
      { stage: 'context', atomTasks: { entry: ['context'], nodes: { context: {} } } },
      { stage: 'requirement', atomTasks: { entry: ['git-worktree'], nodes: { 'git-worktree': {} } } },
    ] },
  });
  const projectRoot = tmp();
  const stateSchema = readJson(path.join(root, 'state.schema.json'));
  let state = initState({ workflowId: 'test', projectRoot, skillName: 'ddo-code-flow', skillVersion: '5.0.0', skillRoot: root, workflowPath: 'workflows/test.json', runType: 'feat', args: {}, initialStage: 'context', stateSchema });
  const workflow = loadWorkflow(root, 'workflows/test.json');
  const pending = registerArtifact({ stdin: 'context', role: 'context-summary', producer: 'context', state, skillRoot: root, workflow });
  state = enqueuePendingOutput({ state, pendingOutput: pending.pendingOutput, historyEvent: pending.historyEvent, stateSchema });
  state = { ...state, currentStage: 'requirement', stages: { context: { status: 'done' }, requirement: { status: 'running' } } };
  const statePath = getBootstrapStatePath(projectRoot, state.bootstrapId);
  writeJsonAtomic(statePath, state);
  return { root, skillRoot: root, projectRoot, stateSchema, state, statePath, workflow };
}

describe('attach-worktree', () => {
  it('接入锚点、flush pending、登记 worktree-info 并迁移 state', () => {
    const fixture = setup();
    const worktreePath = tmp();
    const dateDescription = '2026-08-29-x';
    const artifactDir = path.join(worktreePath, '.ddo', 'runs', 'feat', dateDescription);
    const result = attachWorktree({ ...fixture, runId: 'project-feat-x', worktreePath, dateDescription, artifactDir, effectiveConfig: {} });
    assert.equal(result.state.worktreePath, path.resolve(worktreePath));
    assert.deepEqual(result.state.pendingOutputs, {});
    assert.ok(result.state.artifacts['context-summary']);
    assert.ok(result.state.artifacts['worktree-info']);
    assert.equal(result.statePath, path.join(path.resolve(artifactDir), '.state.json'));
    assert.equal(fs.existsSync(fixture.statePath), false);
    assert.equal(fs.existsSync(path.join(path.dirname(fixture.statePath), '.relocation.json')), true);
    writeJsonAtomic(fixture.statePath, fixture.state);
    const replay = attachWorktree({ ...fixture, runId: 'project-feat-x', worktreePath, dateDescription, artifactDir, effectiveConfig: {} });
    assert.deepEqual(replay, result);
    assert.equal(fs.existsSync(fixture.statePath), false);
  });
  it('拒绝 artifactDir 越出 worktree', () => {
    const fixture = setup();
    assert.throws(() => attachWorktree({ ...fixture, runId: 'x', worktreePath: tmp(), dateDescription: '2026-08-29-x', artifactDir: tmp(), effectiveConfig: {} }), /位于 worktreePath/);
  });
});
