'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { gate } = require('../lib/gate');

function baseState() { return { currentStage: 'spec', issueContext: { issueNumber: 42, repo: 'o/r' }, stages: { spec: { status: 'running' } }, history: [{ event: 'created', at: '2026-08-24T00:00:00Z' }] }; }

describe('gate', () => {
  it('pending 写 gatePending/history 且不改 currentStage', () => {
    const state = baseState();
    const result = gate(state, { stage: 'spec', action: 'pending', monitorId: 'm' });
    assert.equal(result.next, 'pending');
    assert.equal(result.patch.gatePending.status, 'pending');
    assert.equal(result.patch.gatePending.issueNumber, 42);
    assert.equal(result.patch.history.at(-1).event, 'gate-pending');
    assert.equal(result.patch.stages.spec.status, 'waiting-remote-gate');
    assert.equal(state.currentStage, 'spec');
  });
  it('approved/rejected 清理 pending，反馈只保存不执行', () => {
    const pending = gate(baseState(), { stage: 'spec', action: 'pending', enteredAt: '2026-08-29T00:00:00Z' });
    const state = { ...baseState(), ...pending.patch };
    const approved = gate(state, { stage: 'spec', action: 'approved' });
    assert.equal(approved.patch.gatePending, null);
    assert.equal(approved.patch.history.at(-1).event, 'gate-approved');
    const rejected = gate(state, { stage: 'spec', action: 'rejected', feedback: '$(do not run)' });
    assert.equal(rejected.patch.gatePending, null);
    assert.equal(rejected.patch.history.at(-1).feedback, '$(do not run)');
    assert.equal(rejected.patch.stages.spec.status, 'rework');
  });
  it('同 cycle 同 action 重放幂等', () => {
    const first = gate(baseState(), { stage: 'spec', action: 'pending', enteredAt: '2026-08-29T00:00:00Z' });
    const state = { ...baseState(), ...first.patch };
    assert.equal(gate(state, { stage: 'spec', action: 'pending' }).patch, null);
    const approved = gate(state, { stage: 'spec', action: 'approved' });
    const approvedState = { ...state, ...approved.patch };
    assert.equal(gate(approvedState, { stage: 'spec', action: 'approved' }).patch, null);
  });
  it('未知 action 返回 exit 2', () => assert.throws(() => gate(baseState(), { stage: 'spec', action: 'bogus' }), (error) => error.exitCode === 2));
});
