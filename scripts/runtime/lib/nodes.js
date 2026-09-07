'use strict';
const { resolveEffectiveNode } = require('./effective-node');
const { topoOrder } = require('./workflow');

function nextNode({ state, workflow, skillRoot, config = {} }) {
  const currentStage = state.currentStage;
  const stage = (workflow.pipeline || []).find((item) => item.stage === currentStage);
  if (!stage || stage.enabled === false) return { stage: currentStage, done: true, batch: [], optionalMissingRoles: [], historyEvents: [] };
  const allNodes = stage.atomTasks.nodes || {};
  const effectiveNodes = {};
  for (const nodeName of Object.keys(allNodes)) {
    const resolved = resolveEffectiveNode({ skillRoot, workflow, effectiveConfig: config, stageName: currentStage, nodeName });
    if (resolved.enabled) effectiveNodes[nodeName] = resolved;
  }
  const doneNodes = completedNodeNames(state, currentStage);
  const remaining = Object.keys(effectiveNodes).filter((name) => !doneNodes.has(name));
  if (remaining.length === 0) return { stage: currentStage, done: true, batch: [], optionalMissingRoles: [], historyEvents: [] };

  const remainingGraph = {};
  for (const name of remaining) {
    const node = effectiveNodes[name].node;
    remainingGraph[name] = {
      ...node,
      next: (node.next || []).filter((target) => remaining.includes(target)),
      parallelWith: (node.parallelWith || []).filter((target) => remaining.includes(target)),
    };
  }
  const topo = topoOrder(remainingGraph, stage.atomTasks.entry || []);
  if (topo.cycle) throw failure(`stage ${currentStage} 存在未解决的节点环`);
  const indegree = Object.fromEntries(remaining.map((name) => [name, 0]));
  for (const node of Object.values(remainingGraph)) {
    for (const target of [...(node.next || []), ...(node.parallelWith || [])]) indegree[target]++;
  }
  const batchNames = topo.order.filter((name) => indegree[name] === 0);
  const optionalMissingRoles = [];
  const batch = batchNames.map((name) => {
    const built = buildInstruction({ state, effectiveNode: effectiveNodes[name], workflow, skillRoot, config });
    optionalMissingRoles.push(...built.optionalMissingRoles.map((role) => ({ node: name, role })));
    return built.instruction;
  });
  const now = new Date().toISOString();
  const historyEvents = optionalMissingRoles.map(({ node, role }) => ({
    event: 'optional-input-missing', at: now, stage: currentStage, node, role,
  }));
  return { stage: currentStage, done: false, batch, optionalMissingRoles, historyEvents };
}

function buildInstruction({ state, effectiveNode, workflow, skillRoot, config }) {
  const inputs = {};
  const optionalMissingRoles = [];
  let instructionBody = effectiveNode.task.instructionBody;
  for (const consume of effectiveNode.consumes) {
    let artifact = state.artifacts && state.artifacts[consume.role];
    if (consume.role === 'stage-artifact') artifact = resolveStageArtifact({ state, workflow, skillRoot, config });
    const value = artifact && artifact.path ? artifact.path : null;
    if (!value && consume.required) {
      throw failure(`stage ${effectiveNode.stageName}, node ${effectiveNode.nodeName}: required input "${consume.role}" 缺失`);
    }
    if (!value) optionalMissingRoles.push(consume.role);
    inputs[consume.role] = value;
    instructionBody = instructionBody.split(`{{inputs.${consume.role}}}`).join(value || '');
  }
  const runtime = {
    projectRoot: state.projectRoot || '',
    worktreePath: state.worktreePath || '',
    runType: state.type || '',
    runId: state.runId || '',
    dateDescription: state.dateDescription || '',
    artifactDir: state.artifactDir || '',
    createdAt: state.createdAt || '',
    currentStage: state.currentStage || '',
    issueContext: state.issueContext ? JSON.stringify(state.issueContext) : '',
    args: JSON.stringify(state.args || {}),
    stages: JSON.stringify(state.stages || {}),
    artifacts: JSON.stringify(state.artifacts || {}),
    history: JSON.stringify(state.history || []),
  };
  for (const [key, value] of Object.entries(runtime)) instructionBody = instructionBody.split(`{{runtime.${key}}}`).join(value);
  return {
    optionalMissingRoles,
    instruction: {
      node: effectiveNode.nodeName,
      task: effectiveNode.taskName,
      consumes: inputs,
      options: effectiveNode.options,
      instruction: instructionBody,
    },
  };
}

function resolveStageArtifact({ state, workflow, skillRoot, config }) {
  let latest = null;
  for (const [role, record] of Object.entries(state.artifacts || {})) {
    if (record.stage !== state.currentStage) continue;
    let resolved;
    try {
      resolved = resolveEffectiveNode({ skillRoot, workflow, effectiveConfig: config, stageName: state.currentStage, nodeName: record.producer });
    } catch { continue; }
    const declaration = resolved.produces.find((output) => output.role === role && output.primary === true);
    if (declaration && (!latest || record.at > latest.at)) latest = record;
  }
  return latest;
}

function completedNodeNames(state, stageName) {
  const latest = new Map();
  for (const event of state.history || []) {
    if (event.stage !== stageName || !event.node) continue;
    if (['node-done', 'node-reset', 'node-failed', 'waiting-human'].includes(event.event)) latest.set(event.node, event.event);
  }
  return new Set([...latest.entries()].filter(([, event]) => event === 'node-done').map(([node]) => node));
}

function failure(message) { return Object.assign(new Error(message), { exitCode: 1 }); }

module.exports = { nextNode, buildInstruction, resolveStageArtifact, completedNodeNames };
