'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ROOT } = require('./_fixtures');
const { loadAtomTask } = require('../lib/atom-task');
const { loadWorkflow, validateDag } = require('../lib/workflow');
const { advanceStage } = require('../lib/advance');

describe('issue-driven workflow', () => {
  const workflow = loadWorkflow(ROOT, 'workflows/issue-driven.json');

  it('三个远端确认节点复用零产物任务且 DAG 无重复生产者', () => {
    const remoteNodes = workflow.pipeline.flatMap((stage) => Object.entries(stage.atomTasks.nodes)
      .filter(([, node]) => node.taskRef === 'remote-gate')
      .map(([name, node]) => ({ stage: stage.stage, name, node })));
    assert.equal(remoteNodes.length, 3);
    assert.deepEqual(remoteNodes.map((item) => item.stage), ['spec', 'planning', 'test-plan']);
    assert.deepEqual(loadAtomTask({ skillRoot: ROOT, taskName: 'remote-gate' }).frontmatter.produces, []);
    const result = validateDag({ skillRoot: ROOT, workflowPath: 'workflows/issue-driven.json' });
    assert.equal(result.valid, true, result.errors.join('\n'));
  });

  it('cleanup 是最后真实 stage，完成后 runtime 才进入 done', () => {
    const cleanup = workflow.pipeline.at(-1);
    assert.equal(cleanup.stage, 'cleanup');
    assert.equal(cleanup.atomTasks.entry[0], 'cleanup-worktree');
    const cleanupWorkflow = { ...workflow, confirmationGates: [], pipeline: [cleanup] };
    const state = {
      currentStage: 'cleanup', stages: { cleanup: { status: 'running' } },
      artifacts: { 'worktree-info': { path: 'project://README.md', producer: 'git-worktree', stage: 'requirement', at: '2026-08-29T00:00:00Z' } }, pendingOutputs: {},
      history: [], projectRoot: ROOT, worktreePath: ROOT,
    };
    assert.throws(() => advanceStage(state, cleanupWorkflow, { skillRoot: ROOT }), /未完成/);
    const completed = { ...state, history: [{ event: 'node-done', stage: 'cleanup', node: 'cleanup-worktree', at: '2026-08-29T00:00:00Z' }] };
    assert.equal(advanceStage(completed, cleanupWorkflow, { skillRoot: ROOT }).currentStage, 'done');
  });
});
