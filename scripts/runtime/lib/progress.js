'use strict';

const PROGRESS_KEYS = new Set(['selfCheckRound', 'actualModel', 'retryCount']);

function setIssueContext(state, issueContext) {
  return { issueContext };
}

function recordNodeProgress(state, { stage = state.currentStage, node, key, value }) {
  if (!PROGRESS_KEYS.has(key)) throw usageError(`不允许的 progress key: ${key}`);
  const stages = { ...(state.stages || {}) };
  const stageState = { ...(stages[stage] || {}) };
  const nodes = { ...(stageState.nodes || {}) };
  nodes[node] = { ...(nodes[node] || {}), [key]: value };
  stages[stage] = { ...stageState, nodes };
  return { stages };
}

function recordTaskResult(state, { stage = state.currentStage, taskId, status }) {
  if (!/^task-\d{2}$/.test(taskId)) throw usageError(`非法 task id: ${taskId}`);
  if (!['pending', 'running', 'done', 'failed'].includes(status)) throw usageError(`非法 task status: ${status}`);
  const stages = { ...(state.stages || {}) };
  const stageState = { ...(stages[stage] || {}) };
  stages[stage] = { ...stageState, tasks: { ...(stageState.tasks || {}), [taskId]: { status, at: new Date().toISOString() } } };
  return { stages };
}

function recordNodeFailure(state, { stage = state.currentStage, node, reason }) {
  const stages = { ...(state.stages || {}), [stage]: { ...((state.stages || {})[stage] || {}), status: 'failed' } };
  const history = [...(state.history || []), { event: 'node-failed', at: new Date().toISOString(), stage, node, note: reason || '' }];
  return { stages, history };
}

function markNodeWaitingHuman(state, { stage = state.currentStage, node, reason }) {
  const stages = { ...(state.stages || {}), [stage]: { ...((state.stages || {})[stage] || {}), status: 'waiting-human' } };
  const history = [...(state.history || []), { event: 'waiting-human', at: new Date().toISOString(), stage, node, note: reason || '' }];
  return { stages, history };
}

function requestRetry(state, workflow, { from, target, reason }) {
  const pipeline = workflow.pipeline || [];
  const fromIndex = pipeline.findIndex((stage) => stage.stage === from);
  const targetIndex = pipeline.findIndex((stage) => stage.stage === target);
  if (fromIndex < 0 || targetIndex < 0 || targetIndex >= fromIndex) throw usageError(`非法 retry 路径: ${from} -> ${target}`);
  const now = new Date().toISOString();
  const stages = { ...(state.stages || {}) };
  const history = [...(state.history || []), { event: 'retry-requested', at: now, stage: from, target, note: reason || '' }];
  for (let index = targetIndex; index <= fromIndex; index++) {
    const stage = pipeline[index];
    stages[stage.stage] = { ...(stages[stage.stage] || {}), status: stage.stage === target ? 'running' : 'pending' };
    for (const node of Object.keys(stage.atomTasks.nodes || {})) history.push({ event: 'node-reset', at: now, stage: stage.stage, node, target });
  }
  return { currentStage: target, stages, history };
}

function recordCleanupResult(state, { status, reason }) {
  if (!['done', 'skipped'].includes(status)) throw usageError(`非法 cleanup status: ${status}`);
  return { history: [...(state.history || []), { event: `cleanup-${status}`, at: new Date().toISOString(), stage: state.currentStage, note: reason || '' }] };
}

function usageError(message) { return Object.assign(new Error(message), { exitCode: 2 }); }

module.exports = { setIssueContext, recordNodeProgress, recordTaskResult, recordNodeFailure, markNodeWaitingHuman, requestRetry, recordCleanupResult };
