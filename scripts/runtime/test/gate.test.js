'use strict';
// gate 确认门：approved/rejected/pending 的返回契约（G4 / AC-4）。
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { gate } = require('../lib/gate');

function baseState() {
  return {
    currentStage: 'spec',
    stages: { spec: { status: 'running' } },
    history: [{ event: 'created', at: '2026-08-24T00:00:00.000Z' }],
  };
}

describe('gate 确认门（G4 / AC-4）', () => {
  it('approved 返回 next=advance 且 patch 追加 gate-approved', () => {
    const state = baseState();
    const r = gate(state, { stage: 'spec', action: 'approved' });
    assert.equal(r.next, 'advance');
    assert.equal(r.patch.history.at(-1).event, 'gate-approved');
    assert.equal(r.patch.history.at(-1).stage, 'spec');
    // 纯函数：不原地改 state
    assert.equal(state.history.length, 1);
  });

  it('rejected 返回 next=rework 且 patch 标 stage 为 rework', () => {
    const state = baseState();
    const r = gate(state, { stage: 'spec', action: 'rejected', feedback: '范围过大' });
    assert.equal(r.next, 'rework');
    assert.equal(r.patch.history.at(-1).event, 'gate-rejected');
    assert.equal(r.patch.history.at(-1).feedback, '范围过大');
    assert.equal(r.patch.stages.spec.status, 'rework');
    assert.equal(state.stages.spec.status, 'running');
  });

  it('pending 返回 next=pending 且无 patch（由 CLI 层 exit 77）', () => {
    const state = baseState();
    const r = gate(state, { stage: 'spec', action: 'pending' });
    assert.equal(r.next, 'pending');
    assert.equal(r.patch, undefined);
    assert.equal(state.history.length, 1);
  });

  it('未知 action 返回 exitCode 2', () => {
    assert.throws(
      () => gate(baseState(), { stage: 'spec', action: 'bogus' }),
      (e) => e.exitCode === 2 && /未知 gate action/.test(e.message)
    );
  });
});
