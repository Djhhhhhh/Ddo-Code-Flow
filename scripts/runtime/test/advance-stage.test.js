'use strict';
// advance-stage 终态硬检查后推进 currentStage（G8 / AC-8）。
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { advanceStage } = require('../lib/advance');

function workflow(gates = []) {
  return {
    pipeline: [
      { stage: 'spec', atomTasks: { nodes: { a: {} } } },
      { stage: 'planning', atomTasks: { nodes: { b: {} } } },
    ],
    confirmationGates: gates,
  };
}

describe('advance-stage（G8 / AC-8）', () => {
  it('未满足终态时 exit 1 且不推进 currentStage', () => {
    const w = workflow();
    const state = { currentStage: 'spec', stages: { spec: { status: 'running' } }, history: [] };
    assert.throws(() => advanceStage(state, w), (e) => e.exitCode === 1);
    assert.equal(state.currentStage, 'spec');
  });

  it('终态全满足时推进 currentStage（返回 patch，不原地改 state）', () => {
    const w = workflow();
    const state = {
      currentStage: 'spec',
      stages: { spec: { status: 'running' } },
      history: [{ event: 'node-done', stage: 'spec', node: 'a', at: '2026-08-24T00:00:00.000Z' }],
    };
    const r = advanceStage(state, w);
    assert.equal(r.currentStage, 'planning');
    assert.equal(r.patch.currentStage, 'planning');
    assert.equal(r.patch.stages.spec.status, 'done');
    assert.equal(r.patch.stages.planning.status, 'running');
    // 纯函数：原 state 未被原地修改
    assert.equal(state.currentStage, 'spec');
    assert.equal(state.stages.spec.status, 'running');
  });

  it('确认门未批准时 exit 1', () => {
    const w = workflow(['spec']);
    const state = {
      currentStage: 'spec',
      stages: { spec: { status: 'running' } },
      history: [{ event: 'node-done', stage: 'spec', node: 'a', at: '2026-08-24T00:00:00.000Z' }],
    };
    assert.throws(() => advanceStage(state, w), (e) => e.exitCode === 1 && /门/.test(e.message));
  });

  it('末阶段推进到 done 伪阶段时直接落终态，不把 done 标 running', () => {
    const w = {
      pipeline: [
        { stage: 'spec', atomTasks: { nodes: { a: {} } } },
        { stage: 'done', atomTasks: { nodes: {} } },
      ],
      confirmationGates: [],
    };
    const state = {
      currentStage: 'spec',
      stages: { spec: { status: 'running' } },
      history: [{ event: 'node-done', stage: 'spec', node: 'a', at: '2026-08-24T00:00:00.000Z' }],
    };
    const r = advanceStage(state, w);
    assert.equal(r.currentStage, 'done');
    assert.equal(r.patch.stages.spec.status, 'done');
    assert.equal(r.patch.stages.done.status, 'done');
  });
});
