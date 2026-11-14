'use strict';
/**
 * runDiscovery.js —— 多源运行流水发现（数据面，只读）。
 * 契约：plan rev 1（split）Part 02 + DEC-1…DEC-7；三源聚合：
 *  - index 源：~/.ddo/index.json 运行中登记（原 discover 行为不变，AC-3 基线）；
 *  - project 源：<projectRoot>/.ddo/runs/<type>/<runId>/.state.json 全量（含已收口）；
 *  - history 源：~/.ddo/history/runs.jsonl 事件（finalStatus/endedAt 唯一依据，DEC-4）
 *    + <runId>.zip 归档（loadStateFromZip 流式只读预览，DEC-3）。
 * runId 全局去重，源优先级 index > project > history（DEC-2）；全程只读（DEC-5）。
 * 引擎语义同构：惰性加载 exists→parse→最小校验，失败=stale 计数不展示；
 * currentStage 空 = 待收束仍展示（引擎 D4 语义）；已收口以 history finalStatus 判别。
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

/** 展开 ~ 前缀；空值回落缺省索引路径。 */
function expandIndexPath(p) {
  const raw = typeof p === 'string' && p.trim() ? p : '~/.ddo/index.json';
  return raw.startsWith('~/') ? path.join(os.homedir(), raw.slice(2)) : raw;
}

/** 最小校验（STATE-SPEC §3.6 必填子集，v1/v2 共有字段；详见 plan Part 01 §2）。 */
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

/** RunSummary v2：同构引擎 resumeRow；source 标记发现源（finalStatus/endedAt/archiveZip 由 discoverAll 回填）。 */
function summarize(runId, entry, state, source) {
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
    source: source || 'index',
  };
}

/** history 目录由索引同目录推导（DEC-7：与引擎 ddoHome 布局一致）。 */
function historyDirOf(indexPath) {
  return path.join(path.dirname(expandIndexPath(indexPath)), 'history');
}

/** runs.jsonl 只读解析：{events[], corruptCount}（缺失/损坏行跳过计数，不抛出）。 */
function readHistoryEvents(indexPath) {
  const events = [];
  let corruptCount = 0;
  let text = '';
  try {
    text = fs.readFileSync(path.join(historyDirOf(indexPath), 'runs.jsonl'), 'utf8');
  } catch {
    return { events, corruptCount };
  }
  for (const line of text.split('\n')) {
    const s = line.trim();
    if (!s) continue;
    try {
      const ev = JSON.parse(s);
      if (ev && typeof ev.runId === 'string' && ev.runId) events.push(ev);
      else corruptCount++;
    } catch {
      corruptCount++;
    }
  }
  return { events, corruptCount };
}

/** project 源：扫描 <projectRoot>/.ddo/runs/<type>/<runId>/.state.json（STATE-SPEC 布局契约，C4-a）。 */
function readProjectRuns(projectRoot) {
  const out = [];
  const runsDir = path.join(String(projectRoot), '.ddo', 'runs');
  let types = [];
  try {
    types = fs.readdirSync(runsDir);
  } catch {
    return out; // 无 .ddo/runs → 空组（静默降级）
  }
  for (const type of types) {
    const typeDir = path.join(runsDir, type);
    let ids = [];
    try {
      if (!fs.statSync(typeDir).isDirectory()) continue;
      ids = fs.readdirSync(typeDir);
    } catch {
      continue;
    }
    for (const id of ids) {
      const statePath = path.join(typeDir, id, '.state.json');
      const state = tryLoadState(statePath);
      if (state) out.push(summarize(state.runId, { statePath }, state, 'project'));
    }
  }
  return out;
}

/** history 事件 → RunSummary（布局推导：statePath = <root>/.ddo/runs/<type>/<runId>/.state.json）。 */
function summarizeEvent(ev, indexPath) {
  const statePath = typeof ev.statePath === 'string' ? ev.statePath : '';
  const runDir = path.dirname(statePath);
  const type = path.basename(path.dirname(runDir));
  const segs = statePath.replace(/\\/g, '/').split('/').filter(Boolean);
  const projectRoot = segs.length >= 5 ? `/${segs.slice(0, segs.length - 4).join('/')}` : '';
  const project = ev.git && projectRoot
    ? projectRoot.replace(/\/$/, '').split('/').pop()
    : '未定义';
  const zip = path.join(historyDirOf(indexPath), `${ev.runId}.zip`);
  let archiveZip = '';
  try {
    if (fs.existsSync(zip)) archiveZip = zip;
  } catch { /* 只读探测失败 → 无归档 */ }
  return {
    runId: ev.runId,
    title: typeof ev.title === 'string' && ev.title ? ev.title : ev.runId,
    type,
    project,
    projectRoot,
    startedAt: typeof ev.startedAt === 'string' ? ev.startedAt : '',
    positions: [],
    completable: true,
    statePath,
    source: 'history',
    finalStatus: typeof ev.finalStatus === 'string' ? ev.finalStatus : '',
    endedAt: typeof ev.endedAt === 'string' ? ev.endedAt : '',
    ...(archiveZip ? { archiveZip } : {}),
  };
}

/** zip 归档内 .state.json 流式读取（unzip -p，零解压落盘；任何失败 → null 降级）。 */
function loadStateFromZip(zipPath) {
  try {
    const r = spawnSync('unzip', ['-p', zipPath, '.state.json'], {
      timeout: 3000, encoding: 'utf8', maxBuffer: 512 * 1024,
    });
    if (r.status !== 0 || !r.stdout) return null;
    const state = JSON.parse(r.stdout);
    return minimalValid(state) ? state : null;
  } catch {
    return null;
  }
}

/** 发现（index 源单用，兼容保留）：读索引→逐条惰性加载；索引缺失/损坏→空态+indexError（不抛出）。 */
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
    runs.push(summarize(runId, entry, state, 'index'));
  }
  runs.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  return { runs, staleCount };
}

const HISTORY_CAP = 50;

/**
 * 三源聚合发现（DEC-1/DEC-2）：index > project > history，runId 全局去重，三组互斥。
 * 返回 {running[], project[], history[], historyTotal, staleCount, indexError}：
 *  - running：位置非空（index 源为主，project 源补充）；含待收束（位置空未收口）；
 *  - project：project 源且位置空（已收口/待收束的项目内 run）；
 *  - history：history 源且未被前两组覆盖（其他项目/已删工作树/临时 run）。
 */
function discoverAll(opts) {
  const o = opts || {};
  const idx = expandIndexPath(o.indexPath);
  const result = { running: [], project: [], history: [], historyTotal: 0, staleCount: 0, indexError: '' };

  // ① index 源（原 discover 行为不动）
  const base = discover(idx);
  result.indexError = base.indexError;
  const seen = new Map();
  for (const r of base.runs) {
    seen.set(r.runId, r);
    result.running.push(r);
  }

  // ② project 源（workspace 根全量，含已收口）
  const roots = Array.isArray(o.projectRoots) ? o.projectRoots : [];
  for (const root of roots) {
    if (!root) continue;
    for (const r of readProjectRuns(String(root))) {
      if (seen.has(r.runId)) continue;
      seen.set(r.runId, r);
      (r.positions.length ? result.running : result.project).push(r);
    }
  }

  // ③ history 源：finalStatus/endedAt 回填全部组（DEC-4），未覆盖事件入 history 组
  //    同 runId 多行（finish 幂等重跑）→ 末次权威（Map.set 覆盖），保证输出 runId 唯一
  const { events, corruptCount } = readHistoryEvents(idx);
  result.staleCount = base.staleCount + corruptCount;
  const byId = new Map();
  for (const ev of events) byId.set(ev.runId, ev);
  for (const r of seen.values()) {
    const ev = byId.get(r.runId);
    if (ev) {
      r.finalStatus = typeof ev.finalStatus === 'string' ? ev.finalStatus : '';
      r.endedAt = typeof ev.endedAt === 'string' ? ev.endedAt : '';
    }
  }
  for (const ev of byId.values()) {
    if (!seen.has(ev.runId)) result.history.push(summarizeEvent(ev, idx));
  }

  const byStartDesc = (a, b) => (String(a.startedAt) < String(b.startedAt) ? 1 : -1);
  result.running.sort(byStartDesc);
  result.project.sort(byStartDesc);
  result.history.sort(byStartDesc);
  result.historyTotal = result.history.length;
  if (result.history.length > HISTORY_CAP) result.history = result.history.slice(0, HISTORY_CAP);
  return result;
}

module.exports = {
  expandIndexPath, minimalValid, tryLoadState, positionOf, summarize,
  discover, discoverAll, readProjectRuns, readHistoryEvents, summarizeEvent,
  loadStateFromZip, historyDirOf, HISTORY_CAP,
};
