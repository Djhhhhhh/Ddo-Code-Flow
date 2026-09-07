'use strict';
const fs = require('fs');
const { resolveEffectiveNode } = require('./effective-node');
const { resolveProtocol } = require('./protocol');

function completeNode({ state, workflow, effectiveConfig = {}, skillRoot, stageName = state.currentStage, nodeName }) {
  if (stageName !== state.currentStage) throw failure(`只能完成 currentStage=${state.currentStage} 的节点，收到 ${stageName}`);
  const resolved = resolveEffectiveNode({ skillRoot, workflow, effectiveConfig, stageName, nodeName });
  if (!resolved.enabled) throw failure(`disabled node 不能完成: ${nodeName}`);
  const latestLifecycle = latestNodeEvent(state, stageName, nodeName, ['node-failed', 'waiting-human', 'node-reset', 'node-done']);
  if (latestLifecycle && latestLifecycle.event === 'node-done') return { status: 'already-complete', node: nodeName, historyEvent: null };

  for (const output of resolved.produces) {
    const record = state.artifacts && state.artifacts[output.role];
    if (!record) throw failure(`node ${nodeName} 尚未登记产物 ${output.role}`);
    if (record.producer !== nodeName) throw failure(`产物 ${output.role} producer 应为 ${nodeName}，实际为 ${record.producer}`);
    if (record.stage !== stageName) throw failure(`产物 ${output.role} stage 应为 ${stageName}，实际为 ${record.stage}`);
    if (state.pendingOutputs && state.pendingOutputs[output.role]) throw failure(`产物 ${output.role} 仍处于 pending，不能完成节点`);
    const artifactPath = resolveProtocol(record.path, { skillRoot, projectRoot: state.projectRoot, worktreePath: state.worktreePath });
    if (!fs.existsSync(artifactPath)) throw failure(`产物 ${output.role} 路径不存在: ${record.path}`);
  }
  const latestBlocking = latestNodeEvent(state, stageName, nodeName, ['node-failed', 'waiting-human', 'node-reset', 'node-done']);
  if (latestBlocking && ['node-failed', 'waiting-human'].includes(latestBlocking.event)) {
    throw failure(`node ${nodeName} 仍处于 ${latestBlocking.event} 状态`);
  }
  const historyEvent = { event: 'node-done', stage: stageName, node: nodeName, task: resolved.taskName, at: new Date().toISOString() };
  return { status: 'complete', node: nodeName, historyEvent };
}

function latestNodeEvent(state, stageName, nodeName, eventNames) {
  let latest = null;
  for (const event of state.history || []) {
    if (event.stage === stageName && event.node === nodeName && eventNames.includes(event.event)) latest = event;
  }
  return latest;
}

function failure(message) { return Object.assign(new Error(message), { exitCode: 1 }); }

module.exports = { completeNode };
