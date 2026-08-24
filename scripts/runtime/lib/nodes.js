'use strict';
const path = require('path');
const fs = require('fs');
const { parseFrontmatter } = require('./frontmatter');
const { topoOrder } = require('./workflow');

// options 合并：workflow override > config override > node options > atom-task 默认。
function mergeOptions(taskDefaults, nodeOptions, configOverride, workflowOverride) {
  const out = { ...taskDefaults };
  const stripMeta = (o) => {
    if (!o || typeof o !== 'object') return {};
    const r = {};
    for (const [k, v] of Object.entries(o)) {
      if (k === 'enabled' || k === 'model') continue;
      r[k] = v;
    }
    return r;
  };
  Object.assign(out, nodeOptions || {});
  Object.assign(out, stripMeta(configOverride));
  Object.assign(out, stripMeta(workflowOverride));
  return out;
}

// 选当前 stage 下一批（入度 0）节点，注入 {{inputs.*}} 并合并 options，输出自包含指令。
function nextNode({ state, workflow, skillRoot, config }) {
  const currentStage = state.currentStage;
  const stage = workflow.pipeline.find((s) => s.stage === currentStage);
  if (!stage || stage.enabled === false) return { stage: currentStage, done: true, batch: [] };

  const nodes = stage.atomTasks.nodes || {};
  const entry = stage.atomTasks.entry || [];
  const doneNodes = new Set(
    (state.history || []).filter((e) => e.event === 'node-done' && e.stage === currentStage).map((e) => e.node)
  );
  const remaining = Object.keys(nodes).filter((n) => !doneNodes.has(n));
  if (remaining.length === 0) return { stage: currentStage, done: true, batch: [] };

  const indegree = {};
  for (const n of remaining) indegree[n] = 0;
  for (const name of remaining) {
    for (const nxt of nodes[name].next || []) if (remaining.includes(nxt)) indegree[nxt]++;
    for (const pw of nodes[name].parallelWith || []) if (remaining.includes(pw)) indegree[pw]++;
  }
  const batch = remaining.filter((n) => indegree[n] === 0);

  const instructions = batch.map((nodeName) =>
    buildInstruction({ state, nodeName, node: nodes[nodeName], skillRoot, config, workflow })
  );
  return { stage: currentStage, done: false, batch: instructions };
}

function buildInstruction({ state, nodeName, node, skillRoot, config, workflow }) {
  const effectiveName = node.taskRef || nodeName;
  const mdPath = path.join(skillRoot, 'atom-tasks', effectiveName, `${effectiveName}.md`);
  let md = fs.readFileSync(mdPath, 'utf8');
  const fm = parseFrontmatter(md);

  const inputs = {};
  for (const c of fm.consumes || []) {
    const art = state.artifacts && state.artifacts[c.role];
    inputs[c.role] = art ? art.path : (c.role === 'stage-artifact' ? resolveStageArtifact(state) : null);
  }
  for (const [role, p] of Object.entries(inputs)) {
    md = md.split(`{{inputs.${role}}}`).join(p || `(缺失: ${role})`);
  }

  const taskDefaults = {};
  for (const o of fm.options || []) taskDefaults[o.key] = o.default;
  const nodeOptions = node.options || {};
  const configOverride = (config && config.atomTaskOverrides && config.atomTaskOverrides[effectiveName]) || {};
  const workflowOverride = (workflow.atomTaskOverrides && workflow.atomTaskOverrides[effectiveName]) || {};
  const options = mergeOptions(taskDefaults, nodeOptions, configOverride, workflowOverride);

  return { node: nodeName, task: effectiveName, consumes: inputs, options, instruction: md };
}

function resolveStageArtifact(state) {
  // 当前 stage 最近一个 primary 产物；简化：返回当前 stage 最近登记的 artifact path。
  let latest = null;
  for (const rec of Object.values(state.artifacts || {})) {
    if (rec.stage === state.currentStage && rec.at && (!latest || rec.at > latest.at)) latest = rec;
  }
  return latest ? latest.path : null;
}

module.exports = { nextNode, buildInstruction, mergeOptions };
