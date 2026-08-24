'use strict';
const path = require('path');
const fs = require('fs');
const { readJson } = require('./json');
const { parseFrontmatter } = require('./frontmatter');

function loadDefaults(skillRoot) {
  return readJson(path.join(skillRoot, 'config.default.json'));
}

function selectWorkflow({ skillRoot, model, feature, bugfix, text }) {
  const defaults = loadDefaults(skillRoot);
  const workflows = defaults.workflows;
  const items = workflows.items;

  let selected = null;
  if (model && typeof model === 'string') {
    selected = items.find((it) => it.id === model) || null;
  }
  if (!selected) {
    const rules = workflows.selection.rules || [];
    for (const rule of rules) {
      if (rule.fallback) continue;
      const needles = (rule.matchAny || []).map((s) => s.toLowerCase());
      const haystack = [];
      if (model && typeof model === 'string') haystack.push(model.toLowerCase());
      if (text) haystack.push(text.toLowerCase());
      if (haystack.some((h) => needles.some((n) => h.includes(n) || n.includes(h)))) {
        selected = items.find((it) => it.id === rule.workflow) || null;
        if (selected) break;
      }
    }
  }
  if (!selected) {
    const fallbackRule = (workflows.selection.rules || []).find((r) => r.fallback);
    const fbId = (fallbackRule && fallbackRule.workflow) || workflows.default;
    selected = items.find((it) => it.id === fbId) || items[0];
  }

  let runType;
  if (feature) runType = 'feat';
  else if (bugfix) runType = 'fix';
  else if (text && /bug|fix|修复|缺陷/i.test(text)) runType = 'fix';
  else runType = (defaults.base && defaults.base.defaultRunType) || 'feat';

  return { workflowId: selected.id, name: selected.name, workflowPath: selected.path, runType };
}

function loadWorkflow(skillRoot, workflowPath) {
  return readJson(path.resolve(skillRoot, workflowPath));
}

function loadFrontmatter(skillRoot, taskName) {
  const p = path.join(skillRoot, 'atom-tasks', taskName, `${taskName}.md`);
  if (!fs.existsSync(p)) return null;
  return parseFrontmatter(fs.readFileSync(p, 'utf8'));
}

// Kahn 拓扑排序，仅在本 stage 的 nodes 内部（next 指向其它 stage 的边忽略）。
function topoOrder(nodes, entry) {
  const names = Object.keys(nodes);
  const indegree = {};
  const adj = {};
  for (const n of names) { indegree[n] = 0; adj[n] = []; }
  for (const [name, node] of Object.entries(nodes)) {
    for (const nxt of node.next || []) {
      if (nodes[nxt]) { adj[name].push(nxt); indegree[nxt] = (indegree[nxt] || 0) + 1; }
    }
    for (const pw of node.parallelWith || []) {
      if (nodes[pw]) { adj[name].push(pw); indegree[pw] = (indegree[pw] || 0) + 1; }
    }
  }
  const seeds = (entry && entry.length ? entry : names).filter((n) => nodes[n] && indegree[n] === 0);
  const queue = [...new Set(seeds)];
  const order = [];
  const visited = new Set();
  while (queue.length) {
    const n = queue.shift();
    if (visited.has(n)) continue;
    visited.add(n);
    order.push(n);
    for (const m of adj[n]) {
      indegree[m]--;
      if (indegree[m] === 0) queue.push(m);
    }
  }
  return { order, cycle: order.length < names.length };
}

// 角色可达性校验。
function validateDag({ skillRoot, workflowPath }) {
  const workflow = loadWorkflow(skillRoot, workflowPath);
  const catalog = readJson(path.join(skillRoot, 'atom-tasks', 'artifacts.json'));
  const roles = catalog.roles;
  const errors = [];
  const produced = new Set();

  for (const stage of workflow.pipeline) {
    if (stage.enabled === false) continue;
    const atomTasks = stage.atomTasks;
    const nodes = atomTasks.nodes || {};
    const entry = atomTasks.entry || [];
    const topo = topoOrder(nodes, entry);
    if (topo.cycle) { errors.push(`stage ${stage.stage}: 存在环`); continue; }

    for (const nodeName of topo.order) {
      const node = nodes[nodeName];
      const effectiveName = node.taskRef || nodeName;
      const fm = loadFrontmatter(skillRoot, effectiveName);
      if (!fm) { errors.push(`node ${nodeName}: 找不到 atom-task ${effectiveName}`); continue; }
      if (fm.enabled === false) continue;

      for (const p of fm.produces || []) {
        if (!roles[p.role]) { errors.push(`node ${nodeName}: 产物 role "${p.role}" 未登记 artifacts.json`); continue; }
        if (produced.has(p.role)) errors.push(`node ${nodeName}: role "${p.role}" 重复生产（同 run 歧义）`);
        produced.add(p.role);
      }
      for (const c of fm.consumes || []) {
        if (!roles[c.role]) { errors.push(`node ${nodeName}: 消费 role "${c.role}" 未登记 artifacts.json`); continue; }
        if (c.required && !produced.has(c.role) && c.role !== 'stage-artifact') {
          errors.push(`node ${nodeName}: required consume "${c.role}" 无上游产出`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { loadDefaults, selectWorkflow, loadWorkflow, loadFrontmatter, topoOrder, validateDag };
