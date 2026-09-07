'use strict';
const fs = require('fs');
const path = require('path');
const { readJson } = require('./json');
const { validate } = require('./jsonschema');
const { resolveEffectiveNode } = require('./effective-node');
const { validateOutputSchema } = require('./output-validator');
const { resolveProtocol } = require('./protocol');

function loadDefaults(skillRoot) {
  return readJson(path.join(skillRoot, 'config.default.json'));
}

function selectWorkflow({ skillRoot, effectiveConfig, model, feature, bugfix, text }) {
  if (feature && bugfix) throw usageError('--feature 与 --bugfix 不能同时使用');
  const config = effectiveConfig || loadDefaults(skillRoot);
  const workflows = config.workflows;
  const items = workflows.items || [];
  let selected = null;

  if (model !== undefined && model !== null && model !== '') {
    if (!workflows.selection.allowUserOverride) throw usageError('当前配置禁止 --model 覆盖 workflow');
    selected = items.find((item) => item.id === model);
    if (!selected) throw usageError(`未知 workflow id: ${model}`);
  }
  if (!selected && text) {
    const normalizedText = String(text).toLowerCase();
    for (const rule of workflows.selection.rules || []) {
      if (rule.fallback) continue;
      const matches = (rule.matchAny || []).some((needle) => normalizedText.includes(String(needle).toLowerCase()));
      if (matches) {
        selected = items.find((item) => item.id === rule.workflow);
        if (!selected) throw failure(`workflow selection 指向未登记 id: ${rule.workflow}`);
        break;
      }
    }
  }
  if (!selected) {
    const fallbackRule = (workflows.selection.rules || []).find((rule) => rule.fallback);
    const fallbackId = (fallbackRule && fallbackRule.workflow) || workflows.default;
    selected = items.find((item) => item.id === fallbackId);
    if (!selected) throw failure(`默认 workflow 未登记: ${fallbackId}`);
  }

  loadWorkflow(skillRoot, selected.path);
  let runType;
  if (feature) runType = 'feat';
  else if (bugfix) runType = 'fix';
  else if (text && /bug|fix|修复|缺陷/i.test(text)) runType = 'fix';
  else runType = config.base.defaultRunType;
  return { workflowId: selected.id, name: selected.name, workflowPath: selected.path, runType };
}

function loadWorkflow(skillRoot, workflowPath) {
  const root = path.resolve(skillRoot);
  const filePath = path.resolve(root, workflowPath);
  const relative = path.relative(root, filePath);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw usageError(`workflow 路径越界: ${workflowPath}`);
  }
  if (!fs.existsSync(filePath)) throw failure(`workflow 文件不存在: ${filePath}`);
  const workflow = readJson(filePath);
  const configSchema = readJson(path.join(root, 'config.schema.json'));
  const workflowSchema = { ...configSchema.$defs.workflowDefinition, $defs: configSchema.$defs };
  const result = validate(workflowSchema, workflow);
  if (!result.valid) throw failure(`${filePath}: workflow schema 校验失败\n${result.errors.join('\n')}`);
  return workflow;
}

function topoOrder(nodes, entry = []) {
  const names = Object.keys(nodes);
  const indegree = Object.fromEntries(names.map((name) => [name, 0]));
  const adjacent = Object.fromEntries(names.map((name) => [name, []]));
  for (const [name, node] of Object.entries(nodes)) {
    for (const target of [...(node.next || []), ...(node.parallelWith || [])]) {
      if (!nodes[target]) continue;
      adjacent[name].push(target);
      indegree[target]++;
    }
  }
  const roots = names.filter((name) => indegree[name] === 0);
  const queue = [...new Set([...(entry || []).filter((name) => roots.includes(name)), ...roots])];
  const order = [];
  while (queue.length) {
    const name = queue.shift();
    order.push(name);
    for (const target of adjacent[name]) {
      indegree[target]--;
      if (indegree[target] === 0) queue.push(target);
    }
  }
  return { order, cycle: order.length < names.length };
}

function validateDag({ skillRoot, workflowPath, effectiveConfig }) {
  let workflow;
  try { workflow = loadWorkflow(skillRoot, workflowPath); } catch (error) {
    return { valid: false, errors: [error.message] };
  }
  const config = effectiveConfig || loadDefaults(skillRoot);
  const catalog = readJson(path.join(skillRoot, 'atom-tasks', 'artifacts.json'));
  const roles = catalog.roles || {};
  const errors = [];
  const stageNames = new Set();
  const produced = new Map();

  for (const stage of workflow.pipeline || []) {
    if (stageNames.has(stage.stage)) errors.push(`stage 名重复: ${stage.stage}`);
    stageNames.add(stage.stage);
    if (stage.stage === 'done') errors.push('stage 名 done 是 runtime 保留终态，不能出现在 pipeline 中');
    if (stage.enabled === false) continue;
    const nodes = (stage.atomTasks && stage.atomTasks.nodes) || {};
    const entry = (stage.atomTasks && stage.atomTasks.entry) || [];
    if (Object.keys(nodes).length === 0) errors.push(`stage ${stage.stage}: enabled stage 不能为空`);
    for (const name of entry) if (!nodes[name]) errors.push(`stage ${stage.stage}: entry 指向不存在的 node ${name}`);
    for (const [name, node] of Object.entries(nodes)) {
      for (const target of [...(node.next || []), ...(node.parallelWith || [])]) {
        if (!nodes[target]) errors.push(`stage ${stage.stage}: node ${name} 指向不存在或跨 stage 的 node ${target}`);
      }
    }

    const effectiveNodes = {};
    for (const nodeName of Object.keys(nodes)) {
      try {
        const resolved = resolveEffectiveNode({ skillRoot, workflow, effectiveConfig: config, stageName: stage.stage, nodeName });
        if (resolved.enabled) effectiveNodes[nodeName] = resolved;
      } catch (error) {
        errors.push(`stage ${stage.stage}, node ${nodeName}: ${error.message}`);
      }
    }
    const activeGraph = {};
    for (const [name, resolved] of Object.entries(effectiveNodes)) {
      activeGraph[name] = {
        ...resolved.node,
        next: (resolved.node.next || []).filter((target) => effectiveNodes[target]),
        parallelWith: (resolved.node.parallelWith || []).filter((target) => effectiveNodes[target]),
      };
    }
    const topo = topoOrder(activeGraph, entry.filter((name) => effectiveNodes[name]));
    if (topo.cycle) { errors.push(`stage ${stage.stage}: 存在环`); continue; }
    const stageOutputs = new Map();
    for (const [nodeName, resolved] of Object.entries(effectiveNodes)) {
      for (const output of resolved.produces) {
        if (!roles[output.role]) errors.push(`node ${nodeName}: 产物 role "${output.role}" 未登记 artifacts.json`);
        if (produced.has(output.role) || stageOutputs.has(output.role)) errors.push(`node ${nodeName}: role "${output.role}" 重复生产（同 run 歧义）`);
        else stageOutputs.set(output.role, { stage: stage.stage, node: nodeName, primary: output.primary === true });
      }
    }
    for (const nodeName of topo.order) {
      const resolved = effectiveNodes[nodeName];
      for (const consume of resolved.consumes) {
        if (!roles[consume.role]) errors.push(`node ${nodeName}: 消费 role "${consume.role}" 未登记 artifacts.json`);
        if (!consume.required) continue;
        if (consume.role === 'stage-artifact') {
          const hasPrimaryAncestor = [...stageOutputs.values()].some((output) => output.primary && isReachable(activeGraph, output.node, nodeName));
          if (!hasPrimaryAncestor) errors.push(`node ${nodeName}: required consume "stage-artifact" 没有本 stage 的拓扑先行 primary 产物`);
        } else if (!produced.has(consume.role)) {
          const localProducer = stageOutputs.get(consume.role);
          if (!localProducer || !isReachable(activeGraph, localProducer.node, nodeName)) {
            errors.push(`node ${nodeName}: required consume "${consume.role}" 无拓扑先行产出`);
          }
        }
      }
      if (resolved.outputSchemaRef) {
        try {
          const schemaPath = resolveProtocol(resolved.outputSchemaRef, { skillRoot });
          if (!fs.existsSync(schemaPath)) errors.push(`node ${nodeName}: outputSchemaRef 不存在: ${resolved.outputSchemaRef}`);
          else {
            const schemaResult = validateOutputSchema({ outputSchema: readJson(schemaPath), skillRoot, schemaPath });
            if (!schemaResult.valid) errors.push(...schemaResult.errors.map((error) => `node ${nodeName}: ${error}`));
          }
        } catch (error) {
          errors.push(`node ${nodeName}: outputSchemaRef 非法: ${error.message}`);
        }
      }
    }
    for (const [role, producer] of stageOutputs) if (!produced.has(role)) produced.set(role, producer);
  }
  for (const gateStage of workflow.confirmationGates || []) {
    if (!stageNames.has(gateStage)) errors.push(`confirmation gate 指向不存在的 stage: ${gateStage}`);
  }
  return { valid: errors.length === 0, errors };
}

function isReachable(nodes, source, target) {
  if (!nodes[source] || source === target) return false;
  const queue = [source];
  const seen = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);
    for (const next of [...(nodes[current].next || []), ...(nodes[current].parallelWith || [])]) {
      if (next === target) return true;
      if (!seen.has(next)) queue.push(next);
    }
  }
  return false;
}

function failure(message) { return Object.assign(new Error(message), { exitCode: 1 }); }
function usageError(message) { return Object.assign(new Error(message), { exitCode: 2 }); }

module.exports = { loadDefaults, selectWorkflow, loadWorkflow, topoOrder, validateDag };
