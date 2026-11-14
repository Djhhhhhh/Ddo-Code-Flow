'use strict';
/**
 * historySearch.js —— 历史查询数据面（只读）。
 * 契约：plan rev 1（split）Part 01；三源全量扫描（绕过展示层 HISTORY_CAP，DEC-2）：
 *  - 记录集 = run 元信息 meta 条目 + .usage.jsonl 事件 usage 条目 + v1 state 门对象 gate 条目（DEC-4）；
 *  - 决策数据降级链：磁盘 .usage.jsonl > zip 内 .usage.jsonl > zip 内 state 门对象
 *    > 旧式目录归档 <historyDir>/<runId>/.state.json > 仅 meta（不变量：meta 永不丢失）；
 *  - mtime 缓存（路径/zip → mtimeMs）吸收重复 unzip；全程只读，单 run 失败静默降级计数（DEC-5）。
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  expandIndexPath, discover, readProjectRuns, readHistoryEvents, historyDirOf, loadStateFromZip,
} = require('./runDiscovery');

/** 决策类事件（spec I-1 / DEC-4）：UI 琥珀徽章；其余事件为轨迹类。 */
const DECISION_EVENTS = new Set(['decision', 'interacted', 'presented', 'rollback']);
/** 命中渲染上限（DEC-3）：超出截断并提示收窄关键词。 */
const MATCH_CAP = 200;
/** 高亮上下文窗口半径（plan 算法设计）。 */
const SNIPPET_RADIUS = 60;

/* ------------------------------------------------ mtime 缓存（DEC-2） */

const cache = new Map(); // key → { mtimeMs, data }

/** 缓存包装：文件未变复用解析结果；缺失 → miss 返回 undefined 并交由调用方降级。 */
function cached(key, file, parse) {
  let mtimeMs = 0;
  try {
    mtimeMs = fs.statSync(file).mtimeMs;
  } catch {
    return undefined; // 文件不存在：合法缺失（非失败），调用方降级
  }
  const hit = cache.get(key);
  if (hit && hit.mtimeMs === mtimeMs) return hit.data;
  const data = parse(); // parse 返回 null = 存在但不可读（损坏），区分于 undefined
  cache.set(key, { mtimeMs, data });
  return data;
}

/* ------------------------------------------------ 底层读取（只读 + 降级） */

/** .usage.jsonl 文本 → 事件数组（损坏行跳过；非对象/缺 event 行忽略）。 */
function parseUsageLines(text) {
  const events = [];
  for (const line of String(text).split('\n')) {
    const s = line.trim();
    if (!s) continue;
    try {
      const ev = JSON.parse(s);
      if (ev && typeof ev === 'object' && typeof ev.event === 'string') events.push(ev);
    } catch { /* 损坏行跳过 */ }
  }
  return events;
}

/** 磁盘 .usage.jsonl（缓存）；undefined=文件不存在，null=存在但不可读，数组=事件。 */
function readUsageFromDisk(runDir) {
  const file = path.join(String(runDir || ''), '.usage.jsonl');
  if (!runDir) return undefined;
  return cached(`usage:${file}`, file, () => {
    try {
      return parseUsageLines(fs.readFileSync(file, 'utf8'));
    } catch {
      return null;
    }
  });
}

/** zip 内单条目流式读取（unzip -p，零解压落盘；失败 → null）。 */
function readZipText(zipPath, entry) {
  try {
    const r = spawnSync('unzip', ['-p', zipPath, entry], {
      timeout: 3000, encoding: 'utf8', maxBuffer: 512 * 1024,
    });
    if (r.status !== 0 || r.stdout == null) return null;
    return r.stdout;
  } catch {
    return null;
  }
}

/** zip 内 .usage.jsonl（以 zip mtime 缓存）；语义同 readUsageFromDisk。 */
function readUsageFromZip(zipPath) {
  return cached(`zip-usage:${zipPath}`, zipPath, () => {
    const text = readZipText(zipPath, '.usage.jsonl');
    return text === null ? null : parseUsageLines(text);
  });
}

/** zip 内 state（以 zip mtime 缓存；loadStateFromZip 复用最小校验）。 */
function readStateFromZip(zipPath) {
  return cached(`zip-state:${zipPath}`, zipPath, () => loadStateFromZip(zipPath));
}

/** 旧式目录归档 state（R3：<historyDir>/<runId>/.state.json 直读，磁盘 mtime 缓存）。 */
function readLegacyState(historyDir, runId) {
  const file = path.join(historyDir, runId, '.state.json');
  return cached(`legacy-state:${file}`, file, () => {
    try {
      const state = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!state || typeof state !== 'object' || !state.stages || typeof state.stages !== 'object') return null;
      return state;
    } catch {
      return null;
    }
  });
}

/* ------------------------------------------------ 记录构建（Part 01 §4） */

/** run 元信息 → 可搜文本（DEC-4 meta 字段集）。 */
function metaText(m) {
  return [m.runId, m.title, m.type, m.project, m.workflow || '', m.finalStatus || '',
    m.startedAt || '', m.endedAt || ''].join(' ');
}

function metaRecord(m) {
  return {
    runId: m.runId, title: m.title, type: m.type, project: m.project,
    workflow: m.workflow || '', finalStatus: m.finalStatus || '',
    startedAt: m.startedAt || '', endedAt: m.endedAt || '',
    source: m.source || 'index', kind: 'meta',
    searchText: metaText(m).toLowerCase(),
  };
}

/** 事件 → usage 记录（决策类标记 decisionKind，供 UI 徽章与过滤）。 */
function usageRecord(m, ev) {
  const text = [ev.event, ev.command, ev.stage, ev.phase, ev.option, ev.note, ev.detail, ev.at]
    .map((x) => (typeof x === 'string' ? x : '')).join(' ');
  return {
    runId: m.runId, title: m.title, type: m.type, project: m.project,
    workflow: m.workflow || '', finalStatus: m.finalStatus || '',
    startedAt: m.startedAt || '', endedAt: m.endedAt || '',
    source: m.source || 'index', kind: 'usage',
    decisionKind: DECISION_EVENTS.has(ev.event) || undefined,
    event: {
      seq: typeof ev.seq === 'number' ? ev.seq : 0,
      at: typeof ev.at === 'string' ? ev.at : '',
      event: ev.event,
      command: typeof ev.command === 'string' ? ev.command : '',
      stage: typeof ev.stage === 'string' ? ev.stage : '',
      phase: typeof ev.phase === 'string' ? ev.phase : '',
      option: typeof ev.option === 'string' ? ev.option : '',
      note: typeof ev.note === 'string' ? ev.note : '',
      detail: typeof ev.detail === 'string' ? ev.detail : '',
    },
    searchText: text.toLowerCase(),
  };
}

/** v1 state 门对象 → gate 记录（无 usage 日志的旧数据兜底，DEC-4）。 */
function gateRecords(m, state, extra) {
  const out = [];
  for (const [stage, entry] of Object.entries(state.stages || {})) {
    const gate = entry && entry.gate;
    if (!gate || typeof gate !== 'object' || typeof gate.decision !== 'string' || !gate.decision) continue;
    const text = `gate 决策 ${stage} ${gate.decision} ${gate.closedAt || ''} ${m.title} ${m.runId}`;
    out.push({
      runId: m.runId, title: m.title, type: m.type, project: m.project,
      workflow: m.workflow || '', finalStatus: m.finalStatus || '',
      startedAt: m.startedAt || '', endedAt: m.endedAt || '',
      source: (extra && extra.source) || m.source || 'index', kind: 'gate',
      decisionKind: true,
      gate: { stage, decision: gate.decision, closedAt: gate.closedAt || '' },
      archiveZip: (extra && extra.archiveZip) || undefined,
      searchText: text.toLowerCase(),
    });
  }
  return out;
}

/**
 * 单 run 决策数据降级链（Part 01 §4）：
 * 磁盘 usage > zip usage > zip/磁盘 state 门对象 > 旧式目录 state 门对象 > 空。
 * 返回 { records, degraded }：degraded=true 表示存在但读取失败（计入 unreadable）。
 */
function decisionRecordsFor(m, opts) {
  const o = opts || {};
  // ① 磁盘 .usage.jsonl（runDir 可得时）
  if (o.runDir) {
    const evs = readUsageFromDisk(o.runDir);
    if (Array.isArray(evs)) return { records: evs.map((ev) => usageRecord(m, ev)), degraded: false };
    if (evs === null) return { records: [], degraded: true };
  }
  // ② zip 内 .usage.jsonl
  if (o.archiveZip) {
    const evs = readUsageFromZip(o.archiveZip);
    if (Array.isArray(evs) && evs.length) return { records: evs.map((ev) => usageRecord(m, ev)), degraded: false };
  }
  // ③④ state 门对象兜底：磁盘 state（runDir 派生）> zip state > 旧式目录 state
  let state = null;
  if (o.statePath) {
    try {
      if (fs.existsSync(o.statePath)) {
        state = JSON.parse(fs.readFileSync(o.statePath, 'utf8'));
        if (!state || !state.stages) state = null;
      }
    } catch {
      state = null;
    }
  }
  let fromZip = false;
  if (!state && o.archiveZip) {
    state = readStateFromZip(o.archiveZip);
    fromZip = !!state;
  }
  if (state) {
    return {
      records: gateRecords(m, state, fromZip ? { source: 'history', archiveZip: o.archiveZip } : null),
      degraded: false,
    };
  }
  if (o.archiveZip) return { records: [], degraded: true }; // zip 在但两读皆败
  // ⑤ 旧式目录归档（R3）
  if (o.legacyDir) {
    const legacy = readLegacyState(o.legacyDir, m.runId);
    if (legacy) {
      return { records: gateRecords(m, legacy, { source: 'legacy-dir' }), degraded: false };
    }
    return { records: [], degraded: true };
  }
  return { records: [], degraded: false }; // 无任何可读载体：合法仅 meta（ephemeral 已删等）
}

/**
 * 三源全量构建搜索索引（DEC-2：绕过 HISTORY_CAP）。
 * 返回 SearchIndex { records, unreadable, builtAt }；runId 去重 index > project > history（R1）。
 */
function buildSearchIndex(opts) {
  const o = opts || {};
  const idx = expandIndexPath(o.indexPath);
  const records = [];
  let unreadable = 0;
  const seen = new Set();

  // ① index 源（discover 内部已做 state 惰性加载与最小校验）
  const base = discover(idx);
  for (const r of base.runs) {
    seen.add(r.runId);
    const m = {
      runId: r.runId, title: r.title, type: r.type, project: r.project,
      startedAt: r.startedAt, finalStatus: '', endedAt: '', source: 'index',
    };
    records.push(metaRecord(m));
    const res = decisionRecordsFor(m, {
      runDir: path.dirname(r.statePath || ''), statePath: r.statePath,
    });
    records.push(...res.records);
    if (res.degraded) unreadable++;
  }

  // ② project 源（工作区全量，含已收口）
  const roots = Array.isArray(o.projectRoots) ? o.projectRoots : [];
  for (const root of roots) {
    if (!root) continue;
    for (const r of readProjectRuns(String(root))) {
      if (seen.has(r.runId)) continue;
      seen.add(r.runId);
      const m = {
        runId: r.runId, title: r.title, type: r.type, project: r.project,
        startedAt: r.startedAt, finalStatus: '', endedAt: '', source: 'project',
      };
      records.push(metaRecord(m));
      const res = decisionRecordsFor(m, {
        runDir: path.dirname(r.statePath || ''), statePath: r.statePath,
      });
      records.push(...res.records);
      if (res.degraded) unreadable++;
    }
  }

  // ③ history 源（runs.jsonl 全量事件；同 runId 多行末次权威）
  const { events } = readHistoryEvents(idx);
  const historyDir = historyDirOf(idx);
  const byId = new Map();
  for (const ev of events) byId.set(ev.runId, ev);
  for (const ev of byId.values()) {
    if (seen.has(ev.runId)) continue;
    const statePath = typeof ev.statePath === 'string' ? ev.statePath : '';
    const runDir = statePath ? path.dirname(statePath) : '';
    const zip = path.join(historyDir, `${ev.runId}.zip`);
    const hasZip = fs.existsSync(zip);
    const legacyExists = !hasZip && fs.existsSync(path.join(historyDir, ev.runId, '.state.json'));
    const m = {
      runId: ev.runId,
      title: typeof ev.title === 'string' && ev.title ? ev.title : ev.runId,
      type: typeof ev.type === 'string' ? ev.type : '',
      project: typeof ev.project === 'string' ? ev.project : '',
      startedAt: typeof ev.startedAt === 'string' ? ev.startedAt : '',
      finalStatus: typeof ev.finalStatus === 'string' ? ev.finalStatus : '',
      endedAt: typeof ev.endedAt === 'string' ? ev.endedAt : '',
      workflow: typeof ev.workflow === 'string' ? ev.workflow : '',
      source: legacyExists ? 'legacy-dir' : 'history',
    };
    records.push(metaRecord(m));
    const res = decisionRecordsFor(m, {
      runDir: runDir || undefined, statePath: statePath || undefined,
      archiveZip: hasZip ? zip : undefined,
      legacyDir: legacyExists ? historyDir : undefined,
    });
    records.push(...res.records);
    if (res.degraded) unreadable++;
  }

  return { records, unreadable, builtAt: new Date().toISOString() };
}

/* ------------------------------------------------ 匹配与高亮（DEC-3） */

/** 查询串 → 小写词项（空格分词）。 */
function parseTerms(query) {
  return String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/** 记录 → 高亮用展示文本（meta=元信息行；usage=事件行；gate=门决议行）。 */
function recordText(r) {
  if (r.kind === 'usage') {
    const e = r.event;
    return `${e.event} · ${e.stage}${e.phase ? `:${e.phase}` : ''}${e.option ? ` · ${e.option}` : ''}${e.note ? ` · ${e.note}` : ''}${e.detail ? ` · ${e.detail}` : ''} · ${e.at}`;
  }
  if (r.kind === 'gate') {
    return `gate 决议 · ${r.gate.stage} · ${r.gate.decision}${r.gate.closedAt ? ` · ${r.gate.closedAt}` : ''}`;
  }
  return `${r.title} · ${r.runId} · ${r.type}${r.finalStatus ? ` · ${r.finalStatus}` : ''} · ${r.startedAt}`;
}

/** 窗口高亮：整段转义后按命中区间包 <mark>（先转义切片再拼接，规避注入）。 */
function highlight(text, terms) {
  const lower = text.toLowerCase();
  let first = -1;
  for (const t of terms) {
    const i = lower.indexOf(t);
    if (i >= 0 && (first < 0 || i < first)) first = i;
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
  if (first < 0) return esc(text.slice(0, SNIPPET_RADIUS * 2));
  const start = Math.max(0, first - SNIPPET_RADIUS);
  const end = Math.min(text.length, first + SNIPPET_RADIUS);
  const win = text.slice(start, end);
  const winLower = win.toLowerCase();
  // 收集窗口内全部命中区间 → 排序合并重叠
  const spans = [];
  for (const t of terms) {
    let i = 0;
    for (;;) {
      const j = winLower.indexOf(t, i);
      if (j < 0 || t.length === 0) break;
      spans.push([j, j + t.length]);
      i = j + t.length;
    }
  }
  spans.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [];
  for (const s of spans) {
    if (merged.length && s[0] <= merged[merged.length - 1][1]) {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], s[1]);
    } else merged.push([s[0], s[1]]);
  }
  let out = '';
  let pos = 0;
  for (const [s, e] of merged) {
    out += esc(win.slice(pos, s)) + `<mark>${esc(win.slice(s, e))}</mark>`;
    pos = e;
  }
  out += esc(win.slice(pos));
  return `${start > 0 ? '…' : ''}${out}${end < text.length ? '…' : ''}`;
}

/**
 * 关键词搜索（多词 AND 子串，DEC-3）：返回 { matches, truncated, terms }。
 * 排序：startedAt 倒序；同 run 内 meta 在前、usage 按 seq、gate 随后。
 */
function searchRecords(index, query) {
  const terms = parseTerms(query);
  const empty = { matches: [], truncated: false, terms, unreadable: 0 };
  if (!terms.length || !index || !Array.isArray(index.records)) {
    return { ...empty, unreadable: (index && index.unreadable) || 0 };
  }
  const hits = [];
  let truncated = false;
  for (const rec of index.records) {
    if (terms.every((t) => rec.searchText.includes(t))) {
      hits.push(rec);
      if (hits.length > MATCH_CAP) { truncated = true; break; }
    }
  }
  const order = { meta: 0, usage: 1, gate: 2 };
  hits.sort((a, b) => (String(b.startedAt) < String(a.startedAt) ? -1
    : String(b.startedAt) > String(a.startedAt) ? 1
      : a.runId < b.runId ? -1 : a.runId > b.runId ? 1
        : (order[a.kind] || 0) - (order[b.kind] || 0)
          || ((a.event && a.event.seq) || 0) - ((b.event && b.event.seq) || 0)));
  return {
    matches: hits.slice(0, MATCH_CAP).map((r) => ({
      record: r, terms, snippet: highlight(recordText(r), terms),
    })),
    truncated,
    terms,
    unreadable: index.unreadable || 0,
  };
}

/** 测试辅助：清空缓存。 */
function resetCache() { cache.clear(); }

module.exports = {
  buildSearchIndex, searchRecords, highlight, recordText, parseTerms,
  DECISION_EVENTS, MATCH_CAP, resetCache,
};
