'use strict';

// 终态硬检查：阶段全 done、门全批准、无 running/failed/pending，才推进 currentStage。
// 纯函数：返回 { currentStage, patch }，patch 为 delta 供 applyMutation 持久化，不原地改 state。
function advanceStage(state, workflow) {
  const stage = workflow.pipeline.find((s) => s.stage === state.currentStage);
  if (!stage) throw Object.assign(new Error(`未知 stage: ${state.currentStage}`), { exitCode: 1 });

  const nodes = Object.keys(stage.atomTasks.nodes || {});
  const doneNodes = new Set(
    (state.history || []).filter((e) => e.event === 'node-done' && e.stage === state.currentStage).map((e) => e.node)
  );
  const pendingNodes = nodes.filter((n) => !doneNodes.has(n));

  if (pendingNodes.length > 0) {
    throw Object.assign(new Error(`阶段 ${state.currentStage} 仍有未完成节点: ${pendingNodes.join(', ')}`), { exitCode: 1 });
  }

  const isGate = (workflow.confirmationGates || []).includes(state.currentStage);
  const gateApproved = !isGate ||
    (state.history || []).some((e) => e.event === 'gate-approved' && e.stage === state.currentStage);
  if (!gateApproved) {
    throw Object.assign(new Error(`阶段 ${state.currentStage} 是确认门且尚未批准`), { exitCode: 1 });
  }

  const now = new Date().toISOString();
  const idx = workflow.pipeline.findIndex((s) => s.stage === state.currentStage);
  const stages = { ...(state.stages || {}) };
  stages[state.currentStage] = { ...(stages[state.currentStage] || {}), status: 'done', finishedAt: now };
  const next = workflow.pipeline[idx + 1];
  let currentStage;
  if (!next || next.stage === 'done') {
    // 终端：到达 done 伪阶段，直接落终态，不把 done 当可运行阶段。
    currentStage = 'done';
    stages.done = { status: 'done', startedAt: now, finishedAt: now };
  } else {
    currentStage = next.stage;
    stages[next.stage] = { status: 'running', startedAt: now };
  }
  return { currentStage, patch: { currentStage, stages } };
}

module.exports = { advanceStage };
