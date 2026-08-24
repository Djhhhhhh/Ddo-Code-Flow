'use strict';

// 确认门：approved 放行 / rejected 追加 gate-rejected 并标 rework / pending 轮询（exit 77）。
// 纯函数：不原地改 state，返回 { patch, ...result }，patch 为 delta 供 applyMutation 持久化。
function gate(state, { stage, action, feedback }) {
  const now = new Date().toISOString();
  const history = state.history || [];
  if (action === 'approved') {
    return {
      next: 'advance',
      stage,
      patch: {
        history: [...history, { event: 'gate-approved', at: now, stage, note: feedback || 'approved' }],
      },
    };
  }
  if (action === 'rejected') {
    const stages = { ...(state.stages || {}) };
    stages[stage] = { ...(stages[stage] || {}), status: 'rework' };
    return {
      next: 'rework',
      stage,
      feedback: feedback || '',
      patch: {
        history: [...history, { event: 'gate-rejected', at: now, stage, feedback: feedback || '' }],
        stages,
      },
    };
  }
  if (action === 'pending') {
    return { next: 'pending', stage };
  }
  throw Object.assign(new Error(`未知 gate action: ${action}`), { exitCode: 2 });
}

module.exports = { gate };
