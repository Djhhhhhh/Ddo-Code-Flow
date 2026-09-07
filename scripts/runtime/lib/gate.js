'use strict';

function gate(state, { stage, action, feedback, issueNumber, repo, monitorId, enteredAt, timeoutAt }) {
  if (!['approved', 'rejected', 'pending'].includes(action)) throw usageError(`未知 gate action: ${action}`);
  const now = new Date().toISOString();
  const current = state.gatePending && state.gatePending.stage === stage ? state.gatePending : null;
  const eventName = `gate-${action}`;
  const latestEvent = (state.history || []).at(-1);
  const replayCycle = !current && !enteredAt && latestEvent && latestEvent.stage === stage && latestEvent.event === eventName
    ? latestEvent.cycleId : null;
  const cycleId = (current && current.cycleId) || replayCycle || `${stage}:${enteredAt || now}`;
  const duplicate = [...(state.history || [])].reverse().find((event) => event.stage === stage && event.cycleId === cycleId && event.event === eventName);
  if (duplicate) return { next: action === 'pending' ? 'pending' : action === 'approved' ? 'advance' : 'rework', stage, patch: null };
  const event = { event: eventName, at: now, stage, cycleId };
  if (feedback) event.feedback = feedback;
  const history = [...(state.history || []), event];
  if (action === 'pending') {
    const gatePending = {
      stage,
      issueNumber: numberOrNull(issueNumber !== undefined ? issueNumber : state.issueContext && state.issueContext.issueNumber),
      repo: repo || (state.issueContext && state.issueContext.repo) || null,
      monitorId: monitorId || null,
      enteredAt: enteredAt || now,
      timeoutAt: timeoutAt || null,
      status: 'pending',
      cycleId,
    };
    const stages = { ...(state.stages || {}), [stage]: { ...((state.stages || {})[stage] || {}), status: 'waiting-remote-gate' } };
    return { next: 'pending', stage, patch: { gatePending, stages, history } };
  }
  const stages = { ...(state.stages || {}) };
  stages[stage] = { ...(stages[stage] || {}), status: action === 'approved' ? 'running' : 'rework' };
  return { next: action === 'approved' ? 'advance' : 'rework', stage, feedback: feedback || '', patch: { gatePending: null, stages, history } };
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw usageError(`非法 issueNumber: ${value}`);
  return number;
}

function usageError(message) { return Object.assign(new Error(message), { exitCode: 2 }); }

module.exports = { gate };
