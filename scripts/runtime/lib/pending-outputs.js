'use strict';
const fs = require('fs');
const path = require('path');
const { registerArtifact } = require('./artifacts');
const { applyMutation, isWithin } = require('./state');
const { readJson, writeJsonAtomic } = require('./json');

function getBootstrapStatePath(projectRoot, bootstrapId) {
  return path.join(path.resolve(projectRoot), '.ddo', 'runs', '.pending', bootstrapId, '.state.json');
}

function getFinalStatePath(artifactDir) {
  return path.join(path.resolve(artifactDir), '.state.json');
}

function enqueuePendingOutput({ state, pendingOutput, historyEvent, stateSchema }) {
  const existing = state.pendingOutputs && state.pendingOutputs[pendingOutput.role];
  if (existing && existing.contentHash !== pendingOutput.contentHash) throw failure(`pending role ${pendingOutput.role} 已存在不同内容`);
  if (existing) return state;
  return applyMutation(state, {
    pendingOutputs: { ...(state.pendingOutputs || {}), [pendingOutput.role]: pendingOutput },
    history: historyEvent ? [...(state.history || []), historyEvent] : state.history,
  }, 'runtime', stateSchema);
}

function flushPendingOutputs({ state, workflow, effectiveConfig, skillRoot, stateSchema }) {
  if (!state.artifactDir || !state.worktreePath) throw failure('flush pending outputs 前必须 attach worktree');
  let next = state;
  const entries = Object.values(state.pendingOutputs || {}).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const pending of entries) {
    const content = Buffer.from(pending.content, pending.encoding).toString('utf8');
    const result = registerArtifact({
      stdin: content,
      role: pending.role,
      state: next,
      skillRoot,
      workflow,
      effectiveConfig,
      producer: pending.producer,
      stage: pending.stage,
    });
    const pendingOutputs = { ...(next.pendingOutputs || {}) };
    delete pendingOutputs[pending.role];
    const history = [...(next.history || [])];
    if (result.historyEvent) history.push(result.historyEvent);
    history.push({ event: 'artifact-flushed', at: new Date().toISOString(), stage: pending.stage, node: pending.producer, task: pending.task, role: pending.role });
    next = applyMutation(next, {
      artifacts: { ...(next.artifacts || {}), [pending.role]: result.artifactRecord },
      pendingOutputs,
      history,
    }, 'runtime', stateSchema);
  }
  return next;
}

function attachWorktree({ statePath, state, runId, worktreePath, dateDescription, artifactDir, worktreeInfo, workflow, effectiveConfig, skillRoot, stateSchema }) {
  const absoluteWorktree = path.resolve(worktreePath);
  const absoluteArtifactDir = path.resolve(artifactDir);
  if (!path.isAbsolute(worktreePath) || !path.isAbsolute(artifactDir)) throw failure('worktreePath 和 artifactDir 必须是绝对路径');
  if (!isWithin(absoluteWorktree, absoluteArtifactDir)) throw failure('artifactDir 必须位于 worktreePath 内');
  const expectedSuffix = path.join('.ddo', 'runs', state.type, dateDescription);
  const expectedArtifactDir = path.resolve(absoluteWorktree, expectedSuffix);
  if (absoluteArtifactDir !== expectedArtifactDir) throw failure(`artifactDir 必须是 ${expectedArtifactDir}`);
  const finalStatePath = getFinalStatePath(absoluteArtifactDir);
  if (fs.existsSync(finalStatePath)) {
    const existing = readJson(finalStatePath);
    if (existing.bootstrapId !== state.bootstrapId) throw failure('最终 state 已属于其他 bootstrapId');
    if (existing.runId !== runId || path.resolve(existing.worktreePath || '') !== absoluteWorktree) {
      throw failure('重复 attach-worktree 的 runId 或 worktreePath 与最终 state 不一致');
    }
    relocateBootstrap(statePath, state.bootstrapId, finalStatePath);
    return { statePath: finalStatePath, state: existing };
  }
  fs.mkdirSync(absoluteArtifactDir, { recursive: true });

  let next = applyMutation(state, {
    runId,
    worktreePath: absoluteWorktree,
    dateDescription,
    artifactDir: absoluteArtifactDir,
  }, 'git-worktree', stateSchema);
  next = flushPendingOutputs({ state: next, workflow, effectiveConfig, skillRoot, stateSchema });

  const info = normalizeWorktreeInfo(worktreeInfo, next);
  const registration = registerArtifact({
    stdin: JSON.stringify(info, null, 2) + '\n',
    role: 'worktree-info',
    state: next,
    skillRoot,
    workflow,
    effectiveConfig,
    producer: 'git-worktree',
    stage: next.currentStage,
  });
  next = applyMutation(next, {
    artifacts: { ...(next.artifacts || {}), 'worktree-info': registration.artifactRecord },
    history: [...(next.history || []), registration.historyEvent],
  }, 'runtime', stateSchema);

  writeJsonAtomic(finalStatePath, next);
  relocateBootstrap(statePath, state.bootstrapId, finalStatePath);
  return { statePath: finalStatePath, state: next };
}

function relocateBootstrap(statePath, bootstrapId, finalStatePath) {
  const originalPath = statePath && path.resolve(statePath);
  if (!originalPath || originalPath === path.resolve(finalStatePath) || !fs.existsSync(originalPath)) return;
  writeJsonAtomic(path.join(path.dirname(originalPath), '.relocation.json'), {
    bootstrapId,
    relocatedTo: finalStatePath,
    at: new Date().toISOString(),
  });
  fs.rmSync(originalPath);
}

function normalizeWorktreeInfo(input, state) {
  if (typeof input === 'string' && input.trim()) {
    try { return JSON.parse(input); } catch (error) { throw failure(`worktree-info 不是合法 JSON: ${error.message}`); }
  }
  if (input && typeof input === 'object') return input;
  return {
    runId: state.runId,
    branchName: `${state.type}/${state.dateDescription}`,
    worktreePath: state.worktreePath,
    worktreeDir: path.dirname(state.worktreePath),
    type: state.type,
    dateDescription: state.dateDescription,
    baseRef: 'main',
    createdAt: new Date().toISOString(),
  };
}

function failure(message) { return Object.assign(new Error(message), { exitCode: 1 }); }

module.exports = { enqueuePendingOutput, flushPendingOutputs, attachWorktree, getBootstrapStatePath, getFinalStatePath };
