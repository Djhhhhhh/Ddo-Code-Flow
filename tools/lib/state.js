'use strict';
// .state.json 读写：现读不缓存（四通道契约），原子写，基本结构校验（02 基线 §5）。

const fs = require('fs');
const path = require('path');
const { atomicWrite } = require('./fsutil');

const REQUIRED_TOP = ['runId', 'title', 'startedAt', 'currentStage', 'stages'];
// 实际使用的 5 值（12 D4 收敛）：v4 遗留的 skipped/rework/waiting-remote-gate 无写入方无消费方，移除
const STATUS_ENUM = new Set(['pending', 'running', 'done', 'failed', 'waiting-human']);

function readState(statePath) {
  return JSON.parse(fs.readFileSync(statePath, 'utf8'));
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
    if (st.gate !== undefined) assertGate(id, st.gate);
  }
  if (state.dirs !== undefined) assertDirs(state.dirs);
  return true;
}

/** 目录声明校验（11 §1.2，可选字段）：两绝对路径，runDir 须位于 projectRoot 之内。缺失容错（历史 state）。 */
function assertDirs(dirs) {
  if (!dirs || typeof dirs !== 'object') throw new Error('state.dirs must be an object');
  if (typeof dirs.projectRoot !== 'string' || !path.isAbsolute(dirs.projectRoot)) {
    throw new Error('state.dirs.projectRoot must be an absolute path');
  }
  if (typeof dirs.runDir !== 'string' || !path.isAbsolute(dirs.runDir)) {
    throw new Error('state.dirs.runDir must be an absolute path');
  }
  const rel = path.relative(dirs.projectRoot, dirs.runDir);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('state.dirs.runDir 必须位于 projectRoot 之内');
  }
  if (dirs.tasksDir !== undefined && (typeof dirs.tasksDir !== 'string' || !path.isAbsolute(dirs.tasksDir))) {
    throw new Error('state.dirs.tasksDir must be an absolute path'); // 12 D1：可选，出现即须绝对路径
  }
}

/** 确认门形态校验（07 plan §3.2：可选字段，出现即须完整）。 */
function assertGate(id, gate) {
  const where = `stages[${id}].gate`;
  if (!gate || typeof gate !== 'object') throw new Error(`${where} must be an object`);
  if (typeof gate.phase !== 'string' || !/^\d{2}$/.test(gate.phase)) throw new Error(`${where}.phase must be a two-digit phase id`);
  if (typeof gate.openedAt !== 'string') throw new Error(`${where}.openedAt must be an ISO 8601 string`);
  if (!Array.isArray(gate.options) || !gate.options.length) throw new Error(`${where}.options must be a non-empty array`);
  for (const t of gate.options) {
    if (!t || typeof t.name !== 'string' || !t.name) throw new Error(`${where}.options[] missing name`);
    if (typeof t.desc !== 'string' || !t.desc) throw new Error(`${where}.options[${t.name}] missing desc`);
    if (typeof t.action !== 'string' || !t.action) throw new Error(`${where}.options[${t.name}] missing action`);
  }
  if (gate.decision !== undefined && typeof gate.decision !== 'string') throw new Error(`${where}.decision must be a string`);
  if (gate.closedAt !== undefined && typeof gate.closedAt !== 'string') throw new Error(`${where}.closedAt must be an ISO 8601 string`);
}

module.exports = { readState, writeState, assertState, STATUS_ENUM };
