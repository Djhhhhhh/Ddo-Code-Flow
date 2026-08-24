'use strict';
const path = require('path');
const fs = require('fs');
const { readJson, writeJsonAtomic } = require('./json');
const { validate } = require('./jsonschema');

function buildFieldOwner(stateSchema) {
  const owner = {};
  for (const [field, schema] of Object.entries(stateSchema.properties || {})) {
    owner[field] = schema['x-ddo-writer'] || null;
  }
  return owner;
}

// 唯一写入口：拦截越权写与自造顶层字段，通过后合并返回新 state（不落盘）。
function applyMutation(state, patch, writer, stateSchema) {
  if (!stateSchema.properties) throw Object.assign(new Error('state.schema.json 缺少 properties'), { exitCode: 1 });
  for (const field of Object.keys(patch)) {
    if (!Object.prototype.hasOwnProperty.call(stateSchema.properties, field)) {
      throw Object.assign(new Error(`自造顶层字段 "${field}" 被 additionalProperties:false 拦截`), { exitCode: 1 });
    }
    const owner = stateSchema.properties[field]['x-ddo-writer'];
    if (owner && owner !== writer) {
      throw Object.assign(new Error(`越权写：字段 "${field}" 归属 ${owner}，当前 writer=${writer}`), { exitCode: 1 });
    }
  }
  const next = { ...state };
  for (const [k, v] of Object.entries(patch)) next[k] = v;
  const result = validate(stateSchema, next);
  if (!result.valid) {
    throw Object.assign(new Error(`state 校验失败: ${result.errors.join('; ')}`), { exitCode: 1 });
  }
  return next;
}

function initState({ workflowId, projectRoot, skillName, skillVersion, skillRoot, workflowPath, runType, args }) {
  const now = new Date().toISOString();
  return {
    runId: null,
    workflowId,
    createdAt: now,
    projectRoot,
    worktreePath: null,
    skillName,
    skillVersion,
    skillRoot,
    configPath: '.ddo/config.json',
    workflowPath,
    type: runType,
    dateDescription: null,
    artifactDir: null,
    args: args || {},
    currentStage: 'context',
    stages: {},
    artifacts: {},
    pendingOutputs: {},
    history: [{ event: 'created', at: now, note: `workflowId=${workflowId}` }],
  };
}

// 扫描可恢复 run。返回候选数组；多候选由调用方 exit 1 求选择。
function findResumable({ projectRoot, worktreeDir, stateSchema }) {
  const roots = [];
  if (worktreeDir) roots.push(worktreeDir);
  roots.push(path.dirname(projectRoot));

  const candidates = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const statePath of walkStateFiles(root)) {
      let state;
      try { state = readJson(statePath); } catch { continue; }
      if (state.currentStage === 'done') continue;
      if (state.projectRoot !== projectRoot) continue;
      if (!state.worktreePath || !fs.existsSync(state.worktreePath)) continue;
      if (state.artifactDir && !statePath.startsWith(path.resolve(state.artifactDir))) continue;
      candidates.push({ state, statePath });
    }
  }
  return candidates;
}

function walkStateFiles(root) {
  const out = [];
  const stack = [root];
  const seen = new Set();
  while (stack.length) {
    const dir = stack.pop();
    if (seen.has(dir)) continue;
    seen.add(dir);
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.git') continue;
        stack.push(full);
      } else if (e.name === '.state.json') {
        out.push(full);
      }
    }
  }
  return out;
}

module.exports = { buildFieldOwner, applyMutation, initState, findResumable };
