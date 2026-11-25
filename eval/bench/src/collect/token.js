'use strict';
// 成本层聚合（plan Part 03 §5.2，FR-9/AC-9）：cc-switch SQLite proxy_request_logs 只读聚合。
// node:sqlite（Node ≥ 22.5）；库路径解析序：--ccswitch-db > DDO_CCSWITCH_DB > 默认探测。
// 按组（两 sid）/按题（时间窗）/按阶段（ddo 臂 .usage.jsonl 事件切窗）；缓存列自适应；漏记行单列。

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_DB_CANDIDATES = [
  () => process.env.HOME && path.join(process.env.HOME, 'Library', 'Application Support', 'cc-switch', 'cc-switch.sqlite'),
  () => process.env.HOME && path.join(process.env.HOME, 'Library', 'Application Support', 'cc-switch', 'database.sqlite'),
  () => process.env.HOME && path.join(process.env.HOME, '.cc-switch', 'cc-switch.sqlite'),
];

function resolveDbPath(explicit) {
  if (explicit) {
    if (!fs.existsSync(explicit)) throw new Error(`cc-switch 数据库不存在: ${explicit}（用 --ccswitch-db 显式指定）`);
    return explicit;
  }
  if (process.env.DDO_CCSWITCH_DB && fs.existsSync(process.env.DDO_CCSWITCH_DB)) return process.env.DDO_CCSWITCH_DB;
  for (const c of DEFAULT_DB_CANDIDATES) {
    const p = c();
    if (p && fs.existsSync(p)) return p;
  }
  throw new Error('未定位 cc-switch 数据库（探测路径均不存在）——用 --ccswitch-db <路径> 显式传入');
}

/** 阶段切窗：ddo 臂 usage 事件时间轴 → spec/实现/验证 时间区间（题窗口内）。 */
function stageWindows(usageEvents, qStart, qEnd) {
  const marks = [];
  for (const e of usageEvents) {
    if (e.event === 'activated' || e.event === 'advanced') {
      marks.push({ at: e.at, stage: e.stage });
    }
  }
  marks.sort((a, b) => new Date(a.at) - new Date(b.at));
  const stages = [];
  for (const m of marks) {
    if (!stages.length || stages[stages.length - 1].name !== m.stage) stages.push({ name: m.stage, from: m.at });
  }
  return stages.map((s, i) => ({
    name: s.name,
    from: s.from,
    to: i + 1 < stages.length ? stages[i + 1].from : qEnd,
  }));
}

/**
 * 聚合。windows: [{ key: 'baseline'|'ddo', sid, from, to, stages?: [{name, from, to}] }]
 * 返回 token.json 形态（含口径声明与漏记计数）。
 */
function aggregateToken({ dbPath, windows, dryRun = false }) {
  if (dryRun) {
    return {
      simulated: true,
      groups: windows.map((w) => ({ key: w.key, sid: w.sid, input_tokens: 12000 + Math.round(Math.random() * 2000), output_tokens: 3500, total_tokens: 15500, total_cost_usd: 0.31, calls: 14, null_token_rows: 0, stages: (w.stages || []).map((s) => ({ name: s.name, total_tokens: 5000 })) })),
      calibers: CALIBERS,
    };
  }
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(resolveDbPath(dbPath), { readOnly: true });
  try {
    const cols = db.prepare('PRAGMA table_info(proxy_request_logs)').all().map((c) => c.name);
    const hasCache = cols.includes('cache_read') || cols.includes('cache_write');
    const cacheRead = cols.includes('cache_read') ? 'cache_read' : null;
    const cacheWrite = cols.includes('cache_write') ? 'cache_write' : null;

    const groups = windows.map((w) => {
      const base = {
        key: w.key, sid: w.sid, from: w.from, to: w.to,
        input_tokens: 0, output_tokens: 0, total_tokens: 0, total_cost_usd: 0, calls: 0, null_token_rows: 0,
      };
      const sel = (from, to) => {
        const sql = `SELECT input_tokens, output_tokens, total_cost_usd${cacheRead ? `, ${cacheRead} AS cache_read` : ''}${cacheWrite ? `, ${cacheWrite} AS cache_write` : ''}
          FROM proxy_request_logs WHERE session_id = ? AND created_at >= ? AND created_at <= ?`;
        return db.prepare(sql).all(w.sid, from, to);
      };
      const rows = sel(w.from, w.to);
      let cacheTotal = 0;
      for (const r of rows) {
        base.calls += 1;
        if (r.input_tokens == null && r.output_tokens == null) { base.null_token_rows += 1; continue; } // 漏记行：单列不代入合计
        base.input_tokens += Number(r.input_tokens || 0);
        base.output_tokens += Number(r.output_tokens || 0);
        base.total_cost_usd += Number(r.total_cost_usd || 0);
        cacheTotal += Number(r.cache_read || 0) + Number(r.cache_write || 0);
      }
      base.total_tokens = base.input_tokens + base.output_tokens;
      base.cache_fields = hasCache ? { present: true, total: cacheTotal } : { present: false };
      base.stages = (w.stages || []).map((s) => {
        const srows = sel(s.from, s.to);
        let tin = 0; let tout = 0;
        for (const r of srows) { tin += Number(r.input_tokens || 0); tout += Number(r.output_tokens || 0); }
        return { name: s.name, input_tokens: tin, output_tokens: tout, total_tokens: tin + tout };
      });
      return base;
    });
    return { simulated: false, groups, calibers: CALIBERS };
  } finally {
    db.close();
  }
}

const CALIBERS = [
  'token 仅用于同模型 A/B 对照，跨模型不可比',
  'ddo token 更高是预期代价，重点看「代价是否换来对应收益」',
  '缓存命中会抬高名义 token，已同时标注缓存量（列存在时）；无缓存列时标注 cache_fields.present=false',
  '流式响应下 cc-switch 可能漏记 token/模型名；漏记行已单独计数（null_token_rows），不代入合计',
];

module.exports = { aggregateToken, resolveDbPath, stageWindows, CALIBERS };
