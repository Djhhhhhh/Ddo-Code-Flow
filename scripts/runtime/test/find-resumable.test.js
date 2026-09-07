'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, tmp } = require('./_fixtures');
const { readJson, writeJsonAtomic } = require('../lib/json');
const { initState, findResumable } = require('../lib/state');
const { getBootstrapStatePath } = require('../lib/pending-outputs');

const schema = readJson(path.join(ROOT, 'state.schema.json'));

function state(projectRoot) {
  return initState({ workflowId: 'standard', projectRoot, skillName: 'ddo-code-flow', skillVersion: '5.0.0', skillRoot: ROOT, workflowPath: 'workflows/standard.json', runType: 'feat', args: {}, initialStage: 'context', stateSchema: schema });
}

describe('find-resumable', () => {
  it('找到 bootstrap candidate', () => {
    const projectRoot = tmp();
    const value = state(projectRoot);
    writeJsonAtomic(getBootstrapStatePath(projectRoot, value.bootstrapId), value);
    const result = findResumable({ projectRoot, worktreeDir: tmp() });
    assert.equal(result.length, 1);
    assert.equal(result[0].phase, 'bootstrap');
  });
  it('找到 worktree candidate，并按 bootstrapId 去重优先 final', () => {
    const projectRoot = tmp();
    const worktreeDir = tmp();
    const worktreePath = path.join(worktreeDir, 'worktree');
    fs.mkdirSync(worktreePath);
    const value = state(projectRoot);
    writeJsonAtomic(getBootstrapStatePath(projectRoot, value.bootstrapId), value);
    const artifactDir = path.join(worktreePath, '.ddo', 'runs', 'feat', '2026-08-29-x');
    const final = { ...value, runId: 'x', worktreePath, artifactDir, dateDescription: '2026-08-29-x' };
    writeJsonAtomic(path.join(artifactDir, '.state.json'), final);
    const result = findResumable({ projectRoot, worktreeDir });
    assert.equal(result.length, 1);
    assert.equal(result[0].phase, 'worktree');
  });
  it('忽略 done 与其他 projectRoot', () => {
    const projectRoot = tmp();
    const value = { ...state(projectRoot), currentStage: 'done' };
    writeJsonAtomic(getBootstrapStatePath(projectRoot, value.bootstrapId), value);
    assert.deepEqual(findResumable({ projectRoot, worktreeDir: tmp() }), []);
  });
});
