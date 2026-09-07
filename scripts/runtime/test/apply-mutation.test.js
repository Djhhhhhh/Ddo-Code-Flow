'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { ROOT, tmp } = require('./_fixtures');
const { readJson } = require('../lib/json');
const { initState, applyMutation, buildFieldOwner } = require('../lib/state');

const schema = readJson(path.join(ROOT, 'state.schema.json'));
function baseState() { return initState({ workflowId: 'guarded', projectRoot: tmp(), skillName: 'ddo-code-flow', skillVersion: '5.0.0', skillRoot: ROOT, workflowPath: 'workflows/guarded.json', runType: 'feat', args: {}, initialStage: 'context', stateSchema: schema }); }

describe('applyMutation writer guard', () => {
  it('越权、自造字段和缺 writer 均拒绝', () => {
    const state = baseState();
    assert.throws(() => applyMutation(state, { runId: 'x' }, 'runtime', schema), /越权/);
    assert.throws(() => applyMutation(state, { foo: 1 }, 'runtime', schema), /自造/);
    assert.throws(() => applyMutation(state, { currentStage: 'x' }, '', schema), /writer/);
  });
  it('schema property 缺失或空 x-ddo-writer 时拒绝', () => {
    const broken = JSON.parse(JSON.stringify(schema));
    delete broken.properties.history['x-ddo-writer'];
    assert.throws(() => buildFieldOwner(broken), /history.*x-ddo-writer/);
    broken.properties.history['x-ddo-writer'] = '';
    assert.throws(() => buildFieldOwner(broken), /history.*x-ddo-writer/);
  });
  it('gatePending/type 仅 runtime，issueContext 仅 issue-fetch', () => {
    const state = baseState();
    assert.equal(applyMutation(state, { type: 'fix' }, 'runtime', schema).type, 'fix');
    assert.throws(() => applyMutation(state, { type: 'fix' }, 'git-worktree', schema), /越权/);
    const issueContext = { issueNumber: 42, repo: 'o/r' };
    assert.deepEqual(applyMutation(state, { issueContext }, 'issue-fetch', schema).issueContext, issueContext);
    assert.throws(() => applyMutation(state, { issueContext }, 'runtime', schema), /越权/);
  });
});
