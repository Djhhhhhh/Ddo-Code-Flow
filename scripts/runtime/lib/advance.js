'use strict';
const fs = require('fs');
const { resolveEffectiveNode } = require('./effective-node');
const { completedNodeNames, resolveStageArtifact } = require('./nodes');
const { resolveProtocol } = require('./protocol');

function advanceStage(state, workflow, { skillRoot, effectiveConfig = {} } = {}) {
  const pipeline = workflow.pipeline || [];
  const index = pipeline.findIndex((item) => item.stage === state.currentStage);
  const stage = pipeline[index];
  if (!stage || stage.enabled === false || stage.stage === 'done') throw failure(`currentStage 不是可执行 stage: ${state.currentStage}`);

  const enabledNodes = [];
  for (const nodeName of Object.keys(stage.atomTasks.nodes || {})) {
    if (!skillRoot || resolveEffectiveNode({ skillRoot, workflow, effectiveConfig, stageName: stage.stage, nodeName }).enabled) enabledNodes.push(nodeName);
  }
  const doneNodes = completedNodeNames(state, stage.stage);
  for (const nodeName of enabledNodes) {
    const latest = latestNodeLifecycle(state, stage.stage, nodeName);
    if (latest && ['node-running', 'node-failed', 'waiting-human'].includes(latest.event)) {
      throw failure(`node ${nodeName} 仍处于 ${latest.event}`);
    }
  }
  const pendingNodes = enabledNodes.filter((node) => !doneNodes.has(node));
  if (pendingNodes.length) throw failure(`阶段 ${stage.stage} 仍有未完成节点: ${pendingNodes.join(', ')}`);
  assertGateApproved(state, workflow, stage.stage);
  const stagePending = Object.values(state.pendingOutputs || {}).filter((item) => item.stage === stage.stage);
  if (stagePending.length) throw failure(`阶段 ${stage.stage} 仍有 pendingOutputs`);

  if (skillRoot) {
    for (const nodeName of enabledNodes) {
      const resolved = resolveEffectiveNode({ skillRoot, workflow, effectiveConfig, stageName: stage.stage, nodeName });
      for (const consume of resolved.consumes.filter((item) => item.required)) {
        const found = consume.role === 'stage-artifact'
          ? resolveStageArtifact({ state, workflow, skillRoot, config: effectiveConfig })
          : state.artifacts && state.artifacts[consume.role];
        if (!found) throw failure(`node ${nodeName} 的 required binding ${consume.role} 未解析`);
      }
    }
  }

  const now = new Date().toISOString();
  const stages = { ...(state.stages || {}) };
  stages[stage.stage] = { ...(stages[stage.stage] || {}), status: 'done', finishedAt: now };
  let nextIndex = index + 1;
  while (nextIndex < pipeline.length && pipeline[nextIndex].enabled === false) nextIndex++;
  const next = pipeline[nextIndex];
  let currentStage;
  if (next) {
    if (next.stage === 'done') throw failure('pipeline 不能声明保留 stage done');
    currentStage = next.stage;
    stages[currentStage] = { ...(stages[currentStage] || {}), status: 'running', startedAt: now };
  } else {
    assertRunTerminal(state, workflow, pipeline, stages, { skillRoot, effectiveConfig });
    currentStage = 'done';
  }
  return { currentStage, patch: { currentStage, stages } };
}

function assertGateApproved(state, workflow, stageName) {
  if (!(workflow.confirmationGates || []).includes(stageName)) return;
  let latest = null;
  for (const event of state.history || []) {
    if (event.stage === stageName && ['gate-approved', 'gate-rejected', 'gate-pending'].includes(event.event)) latest = event;
  }
  if (!latest || latest.event !== 'gate-approved') throw failure(`阶段 ${stageName} 是确认门且最新状态不是 approved`);
}

function assertRunTerminal(state, workflow, pipeline, stages, { skillRoot, effectiveConfig }) {
  if (Object.keys(state.pendingOutputs || {}).length) throw failure('仍有 pendingOutputs，不能进入 done');
  if (state.gatePending && state.gatePending.status === 'pending') throw failure('仍有 gatePending，不能进入 done');
  for (const stage of pipeline.filter((item) => item.enabled !== false)) {
    const status = stages[stage.stage] && stages[stage.stage].status;
    if (status !== 'done') throw failure(`stage ${stage.stage} 尚未完成，不能进入 done`);
  }
  for (const [name, value] of Object.entries(stages)) {
    if (['running', 'failed', 'waiting-human', 'waiting-remote-gate'].includes(value.status)) {
      throw failure(`stage ${name} 仍处于 ${value.status}`);
    }
  }
  if (!skillRoot) return;
  for (const stage of pipeline.filter((item) => item.enabled !== false)) {
    const completed = completedNodeNames(state, stage.stage);
    for (const nodeName of Object.keys(stage.atomTasks.nodes || {})) {
      const resolved = resolveEffectiveNode({ skillRoot, workflow, effectiveConfig, stageName: stage.stage, nodeName });
      if (!resolved.enabled) continue;
      if (!completed.has(nodeName)) throw failure(`stage ${stage.stage} 的 node ${nodeName} 未完成`);
      for (const output of resolved.produces) {
        const record = state.artifacts && state.artifacts[output.role];
        if (!record || record.producer !== nodeName || record.stage !== stage.stage) {
          throw failure(`node ${nodeName} 的产物 ${output.role} 未保持有效登记`);
        }
        const artifactPath = resolveProtocol(record.path, { skillRoot, projectRoot: state.projectRoot, worktreePath: state.worktreePath });
        if (!fs.existsSync(artifactPath)) throw failure(`node ${nodeName} 的产物 ${output.role} 路径不存在`);
      }
    }
  }
}

function latestNodeLifecycle(state, stageName, nodeName) {
  let latest = null;
  for (const event of state.history || []) {
    if (event.stage === stageName && event.node === nodeName && ['node-running', 'node-failed', 'waiting-human', 'node-done', 'node-reset'].includes(event.event)) latest = event;
  }
  return latest;
}

function failure(message) { return Object.assign(new Error(message), { exitCode: 1 }); }

module.exports = { advanceStage };
