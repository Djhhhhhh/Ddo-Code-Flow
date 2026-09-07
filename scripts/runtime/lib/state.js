'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { readJson } = require('./json');
const { validate } = require('./jsonschema');

function buildFieldOwner(stateSchema) {
  if (!stateSchema || !stateSchema.properties) throw failure('state.schema.json 缺少 properties');
  const owners = {};
  for (const [field, property] of Object.entries(stateSchema.properties)) {
    if (!Object.prototype.hasOwnProperty.call(property, 'x-ddo-writer') || !property['x-ddo-writer']) {
      throw failure(`state schema 字段 "${field}" 缺少唯一非空 x-ddo-writer`);
    }
    owners[field] = property['x-ddo-writer'];
  }
  return owners;
}

function applyMutation(state, patch, writer, stateSchema) {
  if (!writer) throw failure('state mutation 必须提供 writer');
  const owners = buildFieldOwner(stateSchema);
  for (const field of Object.keys(patch)) {
    if (!Object.prototype.hasOwnProperty.call(owners, field)) throw failure(`自造顶层字段 "${field}" 被 additionalProperties:false 拦截`);
    if (owners[field] !== writer) throw failure(`越权写：字段 "${field}" 归属 ${owners[field]}，当前 writer=${writer}`);
  }
  const next = { ...state, ...patch };
  const result = validate(stateSchema, next);
  if (!result.valid) throw failure(`state 校验失败: ${result.errors.join('; ')}`);
  return next;
}

function initState({ workflowId, projectRoot, skillName, skillVersion, skillRoot, workflowPath, runType, args, initialStage, stateSchema }) {
  const now = new Date().toISOString();
  const state = {
    runId: null,
    bootstrapId: crypto.randomUUID(),
    workflowId,
    createdAt: now,
    projectRoot: path.resolve(projectRoot),
    worktreePath: null,
    skillName,
    skillVersion,
    skillRoot: path.resolve(skillRoot),
    configPath: '.ddo/config.json',
    workflowPath,
    type: runType,
    dateDescription: null,
    artifactDir: null,
    args: args || {},
    currentStage: initialStage || 'context',
    stages: { [initialStage || 'context']: { status: 'running', startedAt: now } },
    artifacts: {},
    pendingOutputs: {},
    history: [{ event: 'created', at: now, note: `workflowId=${workflowId}` }],
  };
  if (stateSchema) {
    buildFieldOwner(stateSchema);
    const result = validate(stateSchema, state);
    if (!result.valid) throw failure(`初始 state 校验失败: ${result.errors.join('; ')}`);
  }
  return state;
}

function findResumable({ projectRoot, worktreeDir }) {
  const project = path.resolve(projectRoot);
  const pendingRoot = path.join(project, '.ddo', 'runs', '.pending');
  const roots = [pendingRoot];
  if (worktreeDir) roots.push(path.resolve(worktreeDir));
  roots.push(path.dirname(project));
  const byBootstrap = new Map();
  for (const root of [...new Set(roots)]) {
    if (!fs.existsSync(root)) continue;
    for (const statePath of walkStateFiles(root)) {
      let state;
      try { state = readJson(statePath); } catch { continue; }
      if (state.currentStage === 'done' || path.resolve(state.projectRoot || '') !== project) continue;
      const inPending = isWithin(pendingRoot, statePath);
      let phase;
      if (inPending && !state.worktreePath) phase = 'bootstrap';
      else if (state.worktreePath && fs.existsSync(state.worktreePath) && state.artifactDir && isWithin(path.resolve(state.artifactDir), statePath)) phase = 'worktree';
      else continue;
      const candidate = { phase, state, statePath };
      const key = state.bootstrapId || state.runId || statePath;
      const previous = byBootstrap.get(key);
      if (!previous || (previous.phase === 'bootstrap' && phase === 'worktree')) byBootstrap.set(key, candidate);
    }
  }
  return [...byBootstrap.values()];
}

function walkStateFiles(root) {
  const output = [];
  const stack = [path.resolve(root)];
  const seen = new Set();
  while (stack.length) {
    const directory = stack.pop();
    if (seen.has(directory)) continue;
    seen.add(directory);
    let entries;
    try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', '.git'].includes(entry.name)) stack.push(fullPath);
      } else if (entry.name === '.state.json') output.push(fullPath);
    }
  }
  return output;
}

function isWithin(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function failure(message) { return Object.assign(new Error(message), { exitCode: 1 }); }

module.exports = { buildFieldOwner, applyMutation, initState, findResumable, walkStateFiles, isWithin };
