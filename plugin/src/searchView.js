'use strict';
/**
 * searchView.js —— 历史查询结果页（视图模型 → Webview HTML，纯函数字符串拼接）。
 * 契约：plan rev 1（split）Part 02 §3；零脚本基线：
 *  - 过滤 = radio-hack 纯 CSS（:checked ~ .results 属性选择器，技术复刻自产出浏览器页签）；
 *  - 跳转 = <a href="command:…">（enableCommandUris，无 JS）；
 *  - 高亮 = 服务端预计算 <mark>（historySearch.highlight，已转义）；
 *  - 样式复用 docs :root 快照（webviewHtml.DOCS_ROOT_VARS）。
 */

const { DOCS_ROOT_VARS } = require('./webviewHtml');

const CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; }
body { color: var(--ink); font-family: var(--font-body); font-size: 13px; line-height: 1.6;
  background:
    radial-gradient(1000px 380px at 68% -12%, rgba(0,255,204,.05), transparent 62%),
    radial-gradient(circle, var(--line-soft) 1px, transparent 1.3px) 0 0 / 22px 22px,
    linear-gradient(180deg, var(--bg-1), var(--bg-0)); }
.searchpage { padding: 16px 18px 14px; max-width: 1080px; margin: 0 auto; min-height: 100vh; display: flex; flex-direction: column; gap: 12px; }
.searchpage > input[type="radio"] { display: none; }
/* ---------- 头部 ---------- */
.shead { border: 1px solid var(--line); border-radius: var(--r-lg); background: rgba(7,11,20,.35);
  box-shadow: 0 10px 28px rgba(0,0,0,.32); padding: 14px 16px; display: flex; flex-direction: column; gap: 10px;
  animation: rise .5s .05s var(--ease) backwards; }
@keyframes rise { from { opacity: 0; transform: translateY(10px); } }
.stitle { font-family: var(--font-display); font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
.stitle .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--cyan); box-shadow: var(--glow-cyan); display: inline-block; }
.sq { color: var(--ink-2); font-family: var(--font-mono); font-size: 11.5px; word-break: break-all; }
.sq b { color: var(--cyan); font-weight: 600; }
.sq .muted { color: var(--ink-3); }
.sfilters { display: flex; flex-wrap: wrap; gap: 14px; border-top: 1px dashed var(--line); padding-top: 9px; }
.fgroup { display: flex; align-items: center; gap: 5px; }
.fgroup .flabel { color: var(--ink-3); font-size: 11px; font-family: var(--font-mono); margin-right: 2px; }
.sfilters label { font-family: var(--font-mono); font-size: 11px; padding: 1px 10px; border: 1px solid var(--line);
  border-radius: 99px; color: var(--ink-2); cursor: pointer; user-select: none; transition: all .18s var(--ease); }
.sfilters label:hover { border-color: var(--cyan-dim); color: var(--ink); }
#fk-all:checked ~ .shead label[for="fk-all"], #fk-decision:checked ~ .shead label[for="fk-decision"],
#fk-trace:checked ~ .shead label[for="fk-trace"], #fk-meta:checked ~ .shead label[for="fk-meta"],
#fs-all:checked ~ .shead label[for="fs-all"], #fs-index:checked ~ .shead label[for="fs-index"],
#fs-project:checked ~ .shead label[for="fs-project"], #fs-history:checked ~ .shead label[for="fs-history"] {
  color: var(--cyan); border-color: rgba(0,255,204,.35); background: var(--code-bg); box-shadow: inset 0 0 12px rgba(0,255,204,.08); }
/* ---------- 结果 ---------- */
.results { flex: 1 1 auto; display: flex; flex-direction: column; gap: 12px; }
.rgroup { border: 1px solid var(--line); border-radius: var(--r-lg); background: rgba(7,11,20,.35);
  overflow: hidden; animation: rise .5s var(--ease) backwards; }
.rhead { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 14px;
  border-bottom: 1px solid var(--line-soft); background: rgba(13,20,36,.55); }
.rtitle { font-weight: 600; font-size: 13px; max-width: 46ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rid { font-family: var(--font-mono); font-size: 10.5px; color: var(--ink-3); }
.rtime { margin-left: auto; font-family: var(--font-mono); font-size: 10.5px; color: var(--ink-3); }
.badge { font-family: var(--font-mono); font-size: 10.5px; padding: 1px 9px; border: 1px solid var(--line);
  border-radius: 99px; color: var(--ink-2); background: var(--code-bg); }
.badge.st-done { color: var(--ok); border-color: var(--ok); }
.badge.st-failed { color: var(--danger); border-color: var(--danger); }
.badge.st-aborted { color: var(--warn); border-color: var(--warn); }
.badge.st-run { color: var(--cyan); border-color: var(--cyan); box-shadow: var(--glow-cyan); }
.ropen { font-family: var(--font-mono); font-size: 11px; color: var(--cyan); text-decoration: none;
  border: 1px solid rgba(0,255,204,.35); border-radius: 99px; padding: 1px 11px; transition: all .18s var(--ease); }
.ropen:hover { background: rgba(0,255,204,.09); box-shadow: var(--glow-cyan); }
/* 命中条目 */
.hit { display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap; padding: 8px 14px;
  border-bottom: 1px dashed var(--line-soft); }
.hit:last-child { border-bottom: none; }
.hbadge { flex: 0 0 auto; font-family: var(--font-mono); font-size: 10px; padding: 1px 8px;
  border-radius: 99px; border: 1px solid var(--line); color: var(--ink-3); }
.hbadge.decision { color: var(--warn); border-color: var(--warn); box-shadow: 0 0 10px rgba(254,188,46,.12); }
.hstage { flex: 0 0 auto; font-family: var(--font-mono); font-size: 11px; color: var(--ink-2); }
.htime { flex: 0 0 auto; font-family: var(--font-mono); font-size: 10px; color: var(--ink-3); }
.hsnip { flex: 1 1 260px; font-family: var(--font-mono); font-size: 11px; color: var(--ink-2);
  word-break: break-all; line-height: 1.55; }
mark { background: rgba(0,255,204,.16); color: var(--cyan); border-radius: 2px; padding: 0 1px; }
/* 纯 CSS 过滤（radio-hack）：类别 + 来源两组正交 */
#fk-decision:checked ~ .results .hit:not([data-kind="decision"]) { display: none; }
#fk-trace:checked ~ .results .hit:not([data-kind="trace"]) { display: none; }
#fk-meta:checked ~ .results .hit:not([data-kind="meta"]) { display: none; }
#fs-index:checked ~ .results .hit:not([data-source="index"]) { display: none; }
#fs-project:checked ~ .results .hit:not([data-source="project"]) { display: none; }
#fs-history:checked ~ .results .hit:not([data-source="history"]):not([data-source="legacy-dir"]) { display: none; }
/* 全组命中被过滤净空时收起组框（组内任意 hit 显示才显示组——以 hit 为 display 单元，组框常显可接受；空态卡另置） */
/* ---------- 空态 / 脚注 ---------- */
.empty { border: 1px dashed var(--line); border-radius: var(--r-lg); padding: 40px 20px; text-align: center; color: var(--ink-3); }
.empty .big { font-size: 15px; color: var(--ink-2); margin-bottom: 8px; }
.sfoot { color: var(--ink-3); font-size: 11px; font-family: var(--font-mono); display: flex; flex-wrap: wrap; gap: 6px 18px; padding: 2px 2px 8px; }
.sfoot .warn-note { color: var(--warn); }
`;

/** 时间截断（与三区树一致的 MM-DD HH:mm 可读形态）。 */
function shortTime(iso) {
  const s = String(iso || '');
  return s.length >= 16 ? s.slice(5, 16).replace('T', ' ') : s;
}

/** finalStatus → 徽章类；运行中（无 finalStatus 且源 index）→ run。 */
function statusBadge(r) {
  if (r.finalStatus) {
    const cls = { done: 'st-done', failed: 'st-failed', aborted: 'st-aborted' }[r.finalStatus] || '';
    return `<span class="badge ${cls}">${r.finalStatus}</span>`;
  }
  if (r.source === 'index') return '<span class="badge st-run">运行中</span>';
  if (r.kind === 'meta' || r.source === 'project') return '<span class="badge">待收束</span>';
  return '';
}

/** runId → command: URI（enableCommandUris 锚点，参数为 URI 编码 JSON 数组）。 */
function openRunHref(runId) {
  return `command:ddo-flow.openRun?${encodeURIComponent(JSON.stringify([String(runId)]))}`;
}

/** 过滤类别归并：meta / 决策类（DECISION_EVENTS ∪ gate）/ 轨迹类。 */
function kindOf(record) {
  if (record.kind === 'meta') return 'meta';
  if (record.kind === 'gate' || record.decisionKind) return 'decision';
  return 'trace';
}

const KIND_LABEL = { decision: '决议', trace: '轨迹', meta: '元信息' };
const SOURCE_LABEL = { index: '运行中', project: '本项目', history: '历史归档', 'legacy-dir': '历史归档' };

function hitHtml(m) {
  const r = m.record;
  const kind = kindOf(r);
  let stageText = '';
  let timeText = '';
  if (r.kind === 'usage') {
    stageText = `${r.event.stage}${r.event.phase ? `:${r.event.phase}` : ''}`
      + (r.event.option ? ` · ${r.event.option}` : '');
    timeText = shortTime(r.event.at);
  } else if (r.kind === 'gate') {
    stageText = `gate:${r.gate.stage} · ${r.gate.decision}`;
    timeText = shortTime(r.gate.closedAt);
  } else {
    stageText = 'run 元信息';
    timeText = shortTime(r.startedAt);
  }
  return `<div class="hit" data-kind="${kind}" data-source="${r.source}">`
    + `<span class="hbadge${kind === 'decision' ? ' decision' : ''}">${KIND_LABEL[kind]}</span>`
    + `<span class="hstage">${stageText}</span>`
    + `<span class="htime">${timeText}</span>`
    + `<span class="hsnip">${m.snippet}</span></div>`;
}

function groupHtml(runId, matches) {
  const head = matches[0].record;
  const title = head.title || head.runId;
  const meta = [
    `<span class="rtitle">${title.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))}</span>`,
    statusBadge(head),
    `<span class="rid">${head.runId}</span>`,
    `<a class="ropen" href="${openRunHref(head.runId)}">查看详情 →</a>`,
    `<span class="rtime">${shortTime(head.startedAt)}</span>`,
  ].join('');
  return `<section class="rgroup"><div class="rhead">${meta}</div>${matches.map(hitHtml).join('')}</section>`;
}

/**
 * 结果页总装：renderSearchHtml(query, result) → HTML 字符串。
 * result = searchRecords 输出；输入异常（无索引/空查询）渲染空态页（纯函数降级）。
 */
function renderSearchHtml(query, result) {
  const res = result || { matches: [], terms: [], truncated: false, unreadable: 0 };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
  const q = String(query || '');
  const matches = Array.isArray(res.matches) ? res.matches : [];

  // 按 run 分组（matches 已按时间倒序、同 run 相邻）
  const groups = [];
  for (const m of matches) {
    const g = groups[groups.length - 1];
    if (g && g.runId === m.record.runId) g.items.push(m);
    else groups.push({ runId: m.record.runId, items: [m] });
  }
  const runCount = groups.length;
  const counts = { decision: 0, trace: 0, meta: 0 };
  const srcCounts = { index: 0, project: 0, history: 0, 'legacy-dir': 0 };
  for (const m of matches) {
    counts[kindOf(m.record)]++;
    srcCounts[m.record.source] = (srcCounts[m.record.source] || 0) + 1;
  }
  const historyCount = (srcCounts.history || 0) + (srcCounts['legacy-dir'] || 0);

  const radios = [
    '<input type="radio" name="fk" id="fk-all" checked>',
    '<input type="radio" name="fk" id="fk-decision">',
    '<input type="radio" name="fk" id="fk-trace">',
    '<input type="radio" name="fk" id="fk-meta">',
    '<input type="radio" name="fs" id="fs-all" checked>',
    '<input type="radio" name="fs" id="fs-index">',
    '<input type="radio" name="fs" id="fs-project">',
    '<input type="radio" name="fs" id="fs-history">',
  ].join('');

  const head = `<header class="shead">
<div class="stitle"><span class="dot"></span>历史查询 · 搜索过去的决策与关键信息</div>
<div class="sq">关键词 <b>${esc(q)}</b> · 命中 ${runCount} 个 run · ${matches.length} 条记录
 <span class="muted">（决议 ${counts.decision} · 轨迹 ${counts.trace} · 元信息 ${counts.meta}）</span></div>
<div class="sfilters">
  <span class="fgroup"><span class="flabel">类别</span>
    <label for="fk-all">全部</label><label for="fk-decision">决议 ${counts.decision}</label>
    <label for="fk-trace">轨迹 ${counts.trace}</label><label for="fk-meta">元信息 ${counts.meta}</label></span>
  <span class="fgroup"><span class="flabel">来源</span>
    <label for="fs-all">全部</label><label for="fs-index">运行中 ${srcCounts.index || 0}</label>
    <label for="fs-project">本项目 ${srcCounts.project || 0}</label>
    <label for="fs-history">历史归档 ${historyCount}</label></span>
</div></header>`;

  const body = matches.length
    ? `<div class="results">${groups.map((g) => groupHtml(g.runId, g.items)).join('')}</div>`
    : `<div class="results"><div class="empty"><div class="big">没有匹配的记录</div>`
      + `尝试更短的关键词，或多词缩小范围（空格分隔，全部命中才入选）。</div></div>`;

  const notes = [];
  if (res.truncated) notes.push('<span class="warn-note">命中超过上限已截断——尝试更具体的关键词</span>');
  if (res.unreadable) notes.push(`<span class="warn-note">${res.unreadable} 个数据源读取失败已降级（仅元信息）</span>`);
  notes.push('重新搜索：命令面板执行「历史查询: 搜索决策与关键信息」或存活流水视图标题搜索按钮');
  notes.push('全程只读 · 数据源：index / 本项目 / history（runs.jsonl + zip + 旧式归档）');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>历史查询${q ? ` · ${q}` : ''} · Ddo-Code-Flow</title>
<style>${DOCS_ROOT_VARS}
${CSS}</style></head>
<body><main class="searchpage">
${radios}
${head}
${body}
<footer class="sfoot">${notes.map((n) => `<span>${n}</span>`).join('')}</footer>
</main></body></html>`;
}

module.exports = { renderSearchHtml, kindOf, openRunHref, shortTime };
