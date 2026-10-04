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
  // 临时模式标记（runId 目录创建可配 DEC-5）：可选布尔，缺省 = 正常模式（存量 state 零迁移）
  if (state.ephemeral !== undefined && typeof state.ephemeral !== 'boolean') {
    throw new Error('state.ephemeral must be a boolean');
  }
  for (const [id, st] of Object.entries(state.stages || {})) {
    if (!STATUS_ENUM.has(st.status)) throw new Error(`stages[${id}].status invalid: ${st.status}`);
    if (!Array.isArray(st.dependOn)) throw new Error(`stages[${id}].dependOn must be an array`);
    if (typeof st.at !== 'string') throw new Error(`stages[${id}].at must be an ISO 8601 string`);
    if (st.gate !== undefined) assertGate(id, st.gate);
  }
  if (state.dirs !== undefined) assertDirs(state.dirs, state.ephemeral === true);
  if (state.git !== undefined) assertGit(state.git);
  // 不变量 I2：multi 模式下 dirs.projects 与 git.repos 工作树同序一致（两侧都出现时校验）
  if (state.git && state.git.multiRepo === true && state.dirs && state.dirs.projects !== undefined) {
    const expected = state.git.repos.map((r) => r.worktreePath);
    if (JSON.stringify(expected) !== JSON.stringify(state.dirs.projects)) {
      throw new Error('state.dirs.projects 须与 git.repos 的 worktreePath 同序一致');
    }
  }
  return true;
}

/** 多仓库可选段校验（multi 模式，出现即须完整；缺失 = 单仓库旧语义零迁移）。
 *  不变量：repos 主仓库首位且与 git.worktreePath 一致；worktreePath 全局唯一；
 *  dirs.projects 与 repos 工作树同序一致（I2/I3，两侧都出现时校验）。 */
function assertGit(git) {
  if (!git || typeof git !== 'object') throw new Error('state.git must be an object');
  if (git.multiRepo === undefined) return;
  if (typeof git.multiRepo !== 'boolean') throw new Error('state.git.multiRepo must be a boolean');
  if (git.multiRepo !== true) return;
  if (typeof git.container !== 'string' || !path.isAbsolute(git.container)) {
    throw new Error('state.git.container must be an absolute path');
  }
  if (!Array.isArray(git.repos) || !git.repos.length) {
    throw new Error('state.git.repos must be a non-empty array');
  }
  const seen = new Set();
  for (const [i, r] of git.repos.entries()) {
    const where = `state.git.repos[${i}]`;
    if (!r || typeof r !== 'object') throw new Error(`${where} must be an object`);
    if (r.role !== 'primary' && r.role !== 'member') throw new Error(`${where}.role must be "primary" | "member"`);
    for (const k of ['name', 'repoPath', 'worktreePath', 'branch', 'mainBranch']) {
      if (typeof r[k] !== 'string' || !r[k]) throw new Error(`${where}.${k} must be a non-empty string`);
    }
    if (!path.isAbsolute(r.repoPath) || !path.isAbsolute(r.worktreePath)) {
      throw new Error(`${where}.repoPath / worktreePath must be absolute paths`);
    }
    if (seen.has(r.worktreePath)) throw new Error(`${where} worktreePath 重复: ${r.worktreePath}`);
    seen.add(r.worktreePath);
  }
  if (git.repos[0].role !== 'primary') throw new Error('state.git.repos[0].role must be "primary"（主仓库首位）');
  if (git.repos[0].worktreePath !== git.worktreePath) {
    throw new Error('state.git.repos[0].worktreePath 须与 git.worktreePath 一致');
  }
}

/** 目录声明校验（11 §1.2，可选字段）：两绝对路径，runDir 须位于 projectRoot 之内——
 *  临时模式例外（spec I3 收窄）：ephemeral 时运行材料居 ~/.ddo/tmp 下，contain 检查放行，
 *  绝对路径校验保留。缺失容错（历史 state）。 */
function assertDirs(dirs, ephemeral = false) {
  if (!dirs || typeof dirs !== 'object') throw new Error('state.dirs must be an object');
  if (typeof dirs.projectRoot !== 'string' || !path.isAbsolute(dirs.projectRoot)) {
    throw new Error('state.dirs.projectRoot must be an absolute path');
  }
  if (typeof dirs.runDir !== 'string' || !path.isAbsolute(dirs.runDir)) {
    throw new Error('state.dirs.runDir must be an absolute path');
  }
  if (!ephemeral) {
    const rel = path.relative(dirs.projectRoot, dirs.runDir);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error('state.dirs.runDir 必须位于 projectRoot 之内');
    }
  }
  if (dirs.tasksDir !== undefined && (typeof dirs.tasksDir !== 'string' || !path.isAbsolute(dirs.tasksDir))) {
    throw new Error('state.dirs.tasksDir must be an absolute path'); // 12 D1：可选，出现即须绝对路径
  }
  if (dirs.projects !== undefined) {
    if (!Array.isArray(dirs.projects) || !dirs.projects.length) {
      throw new Error('state.dirs.projects must be a non-empty array');
    }
    for (const p of dirs.projects) {
      if (typeof p !== 'string' || !path.isAbsolute(p)) {
        throw new Error('state.dirs.projects[] must be absolute paths');
      }
    }
  }
}

/** 确认门形态校验（07 plan §3.2：可选字段，出现即须完整；留痕字段为交互协议结构闭环增补）。 */
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
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
  if (gate.presentedAt !== undefined && (typeof gate.presentedAt !== 'string' || !ISO_RE.test(gate.presentedAt))) {
    throw new Error(`${where}.presentedAt must be an ISO 8601 string`);
  }
  if (gate.interactions !== undefined) {
    if (!Array.isArray(gate.interactions)) throw new Error(`${where}.interactions must be an array`);
    for (const [i, it] of gate.interactions.entries()) {
      if (!it || typeof it !== 'object') throw new Error(`${where}.interactions[${i}] must be an object`);
      if (typeof it.option !== 'string' || !it.option) throw new Error(`${where}.interactions[${i}].option must be a non-empty string`);
      if (typeof it.at !== 'string' || !ISO_RE.test(it.at)) throw new Error(`${where}.interactions[${i}].at must be an ISO 8601 string`);
      if (it.note !== undefined && typeof it.note !== 'string') throw new Error(`${where}.interactions[${i}].note must be a string`);
    }
  }
  if (gate.decision !== undefined && typeof gate.decision !== 'string') throw new Error(`${where}.decision must be a string`);
  if (gate.closedAt !== undefined && typeof gate.closedAt !== 'string') throw new Error(`${where}.closedAt must be an ISO 8601 string`);
}

module.exports = { readState, writeState, assertState, STATUS_ENUM };
