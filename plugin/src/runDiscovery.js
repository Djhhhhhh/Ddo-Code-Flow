'use strict';
/**
 * runDiscovery.js —— 全局运行中流水发现（数据面，只读）。
 * 契约：plan R1 Part 01 §1（DEC-3）；引擎语义同构：
 *  - 索引 ~/.ddo/index.json：{runId:{statePath,startedAt}}（RB-1）；
 *  - 惰性加载 exists→parse→最小校验，失败=stale 计数不展示（RB-2）；
 *  - currentStage 空 = 待收束仍展示（引擎 D4 语义）。
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/** 展开 ~ 前缀；空值回落缺省索引路径。 */
function expandIndexPath(p) {
  const raw = typeof p === 'string' && p.trim() ? p : '~/.ddo/index.json';
  return raw.startsWith('~/') ? path.join(os.homedir(), raw.slice(2)) : raw;
}

/** 最小校验（STATE-SPEC §3.6 必填子集，v1/v2 共有字段；详见 plan Part 01 §1）。 */
function minimalValid(state) {
  return !!state
    && typeof state === 'object'
    && typeof state.runId === 'string' && state.runId
    && typeof state.title === 'string' && state.title
    && typeof state.startedAt === 'string' && state.startedAt
    && !!state.dirs && typeof state.dirs === 'object'
    && typeof state.dirs.projectRoot === 'string'
    && typeof state.dirs.runDir === 'string'
    && Array.isArray(state.currentStage)
    && !!state.stages && typeof state.stages === 'object';
}

/** 惰性加载：缺失/解析失败/校验不过 → null（整条失效，不部分渲染）。 */
function tryLoadState(statePath) {
  try {
    if (!fs.existsSync(statePath)) return null;
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    return minimalValid(state) ? state : null;
  } catch {
    return null;
  }
}

/** 位置条目 "<task>:<phase>" → {stage, phase, gateOpen}（gateOpen=门存在且未决议）。 */
function positionOf(state, entry) {
  const idx = String(entry).lastIndexOf(':');
  const stage = idx >= 0 ? String(entry).slice(0, idx) : String(entry);
  const phase = idx >= 0 ? String(entry).slice(idx + 1) : '';
  const gate = state.stages[stage] && state.stages[stage].gate;
  return { stage, phase, ...(gate && !gate.decision ? { gateOpen: true } : {}) };
}

/** RunSummary：同构引擎 resumeRow（title/type/位置概要/待收束/project 分组键）。 */
function summarize(runId, entry, state) {
  const runDir = state.dirs.runDir;
  const type = path.basename(path.dirname(runDir));
  const positions = state.currentStage.map((e) => positionOf(state, e));
  // 分组键：有 git 信息的项目取 projectRoot 末段，否则归入「未定义」（coding:02 修订 4）
  const root = String(state.dirs.projectRoot || '').replace(/\\/g, '/').replace(/\/$/, '');
  const project = state.git && root ? root.split('/').pop() : '未定义';
  return {
    runId,
    title: state.title,
    type,
    project,
    projectRoot: state.dirs.projectRoot,
    startedAt: state.startedAt,
    positions,
    ...(positions.length ? {} : { completable: true }),
    statePath: entry.statePath,
  };
}

/** 发现：读索引→逐条惰性加载；索引缺失/损坏→空态+indexError（不抛出）。 */
function discover(indexPath) {
  const indexFile = expandIndexPath(indexPath);
  let index;
  try {
    index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  } catch (e) {
    return { runs: [], staleCount: 0, indexError: `索引不可读（${indexFile}）：${e.message}` };
  }
  const runs = [];
  let staleCount = 0;
  for (const [runId, entry] of Object.entries(index || {})) {
    if (!entry || typeof entry.statePath !== 'string') { staleCount++; continue; }
    const state = tryLoadState(entry.statePath);
    if (!state) { staleCount++; continue; }
    runs.push(summarize(runId, entry, state));
  }
  runs.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  return { runs, staleCount };
}

module.exports = { expandIndexPath, minimalValid, tryLoadState, positionOf, summarize, discover };
