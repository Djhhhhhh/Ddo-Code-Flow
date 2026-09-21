'use strict';
// .state.json 读写：现读不缓存（四通道契约），原子写，基本结构校验。

const fs = require('fs');
const { atomicWrite } = require('./fsutil');

const REQUIRED_TOP = ['runId', 'title', 'startedAt', 'currentStage', 'stages'];
const STATUS_ENUM = new Set([
  'pending', 'running', 'done', 'failed',
  'skipped', 'rework', 'waiting-human', 'waiting-remote-gate',
]);

function readState(statePath) {
  const raw = fs.readFileSync(statePath, 'utf8');
  return JSON.parse(raw);
}

function writeState(statePath, state) {
  atomicWrite(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

/** 结构断言：缺必填字段/非法枚举直接抛错（硬失败 exit 1）。 */
function assertState(state) {
  for (const k of REQUIRED_TOP) {
    if (state[k] === undefined) throw new Error(`state missing required field: ${k}`);
  }
  if (typeof state.runId !== 'string' || !state.runId) throw new Error('state.runId must be a non-empty string');
  if (typeof state.title !== 'string' || !state.title) throw new Error('state.title must be a non-empty string');
  if (!Array.isArray(state.currentStage)) throw new Error('state.currentStage must be an array');
  for (const [id, st] of Object.entries(state.stages || {})) {
    if (!STATUS_ENUM.has(st.status)) throw new Error(`stages[${id}].status invalid: ${st.status}`);
    if (!Array.isArray(st.dependOn)) throw new Error(`stages[${id}].dependOn must be an array`);
    if (typeof st.at !== 'string') throw new Error(`stages[${id}].at must be an ISO 8601 string`);
  }
  return true;
}

module.exports = { readState, writeState, assertState, STATUS_ENUM };
