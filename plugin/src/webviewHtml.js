'use strict';
/**
 * webviewHtml.js —— 视图模型 → Webview HTML（纯函数字符串拼接）。
 * 契约演进（coding:02 修订 15 · 逐步设计第七步）：
 *  - 上：30/70 双栏（左基本信息 · 右 DAG 管线带，行高统一固定，响应式断点 900px）；
 *  - 下：产出浏览器整块 = 左 30% 文件树 + 右 70% 预览（radio-hack 纯 CSS 页签，点击切换，无脚本）；
 *    md 渲染基础格式 + 目录导航（锚点）；json 折叠树（嵌套 details）；git 快照为虚拟条目；
 *  - 基础色板沿用 docs :root 快照；动效纯 CSS/SMIL。
 */

const { escapeHtml } = require('./stateView');
const { LIVE_STAR } = require('./svgAssets');
const { renderMarkdown, buildTree } = require('./previewView');

/** docs :root 变量区快照（L38–53，基础色板）。 */
const DOCS_ROOT_VARS = `:root {
    --bg-0: #070B14; --bg-1: #0A0F1C; --bg-2: #0D1424; --bg-3: #101A2E;
    --panel: #0B1322; --panel-2: #111C33; --code-bg: #081020;
    --line: #1C2A45; --line-soft: #15223A;
    --ink: #E6F1FF; --ink-2: #9FB3D1; --ink-3: #5F7396;
    --cyan: #00FFCC; --cyan-dim: #00D9AE; --magenta: #FF2EC4; --magenta-dim: #FF6BD8;
    --ok: #28C840; --warn: #FEBC2E; --danger: #FF5F57;
    --glow-cyan: 0 0 22px rgba(0,255,204,.22); --glow-magenta: 0 0 22px rgba(255,46,196,.20);
    --font-display: 'Space Grotesk', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    --font-body: 'Space Grotesk', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
    --font-mono: 'IBM Plex Mono', ui-monospace, 'Cascadia Code', Consolas, monospace;
    --r-sm: 6px; --r-md: 9px; --r-lg: 14px;
    --ease: cubic-bezier(0.16,1,0.3,1);
}`;

/** docs 图标类规则快照（L560 原值）。 */
const DOCS_ICON_RULES = `.live-star { width: 12.5px; height: 12.5px; fill: var(--cyan); vertical-align: -1.8px; margin-right: 3px; }`;

const STATUS_FILL = {
  pending: 'var(--ink-3)', running: 'var(--cyan)', 'waiting-human': 'var(--warn)',
  done: 'var(--ok)', failed: 'var(--danger)',
};

const LAYOUT_CSS = `@keyframes rise { from { opacity: 0; transform: translateY(10px); } }
@keyframes fade { from { opacity: 0; } }
@keyframes pop { from { transform: scale(0); opacity: 0; } }
@keyframes draw { to { stroke-dashoffset: 0; } }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; }
body { color: var(--ink); font-family: var(--font-body); font-size: 13px; line-height: 1.6;
  background:
    radial-gradient(1000px 380px at 68% -12%, rgba(0,255,204,.05), transparent 62%),
    radial-gradient(circle, var(--line-soft) 1px, transparent 1.3px) 0 0 / 22px 22px,
    linear-gradient(180deg, var(--bg-1), var(--bg-0)); }
.dagpage { padding: 14px 16px 12px; max-width: 1280px; margin: 0 auto; height: 100vh; display: flex; flex-direction: column; }
/* ================= 上：30/70 双栏（固定 225px） ================= */
.layout { display: grid; grid-template-columns: minmax(260px, 30fr) 70fr; gap: 14px; height: 225px; flex: 0 0 auto; }
@media (max-width: 900px) {
  .dagpage { height: auto; }
  .layout { grid-template-columns: 1fr; height: auto; }
  .info { min-height: 0; height: auto; }
  .dagframe { height: 240px; }
  .bcols { grid-template-columns: 1fr; }
  .browser { height: auto; }
  .tree { max-height: 200px; }
  .pbody { max-height: 60vh; }
}
.info { border: 1px solid var(--line); border-radius: 14px; background: rgba(7,11,20,.35); box-shadow: 0 10px 28px rgba(0,0,0,.32); padding: 13px 15px; display: flex; flex-direction: column; gap: 9px; overflow: hidden; animation: rise .5s .05s var(--ease) backwards; }
.hline { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; flex: 0 0 auto; }
.hline .dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; }
.hline .dot.run { background: var(--cyan); box-shadow: var(--glow-cyan); }
.hline .dot.wait { background: var(--warn); }
.hline .pos { font-family: var(--font-mono); font-size: 14px; font-weight: 600; color: var(--ink); }
.hline .st { font-family: var(--font-mono); font-size: 10.5px; padding: 1px 10px; border-radius: 99px; border: 1px solid; }
.st.run { color: var(--cyan); border-color: var(--cyan); box-shadow: var(--glow-cyan); }
.st.wait { color: var(--warn); border-color: var(--warn); }
.st.ok { color: var(--ok); border-color: var(--ok); }
.st.danger { color: var(--danger); border-color: var(--danger); }
.ititle { flex: 0 0 auto; font-family: var(--font-display); font-size: 15px; font-weight: 600; line-height: 1.5; color: var(--ink); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.hbadges { display: flex; gap: 6px; flex-wrap: wrap; flex: 0 0 auto; }
.badge { font-family: var(--font-mono); font-size: 10.5px; padding: 1px 9px; border: 1px solid rgba(0,255,204,.35); border-radius: 99px; color: var(--cyan); background: var(--code-bg); box-shadow: inset 0 0 12px rgba(0,255,204,.08); }
.badge.dim { color: var(--ink-3); border-color: var(--line); box-shadow: none; }
.imeta { flex: 0 0 auto; margin-top: auto; border-top: 1px dashed var(--line); padding-top: 8px; display: grid; grid-template-columns: max-content 1fr; gap: 2px 12px; font-size: 11px; line-height: 1.4; }
.imeta .k { color: var(--ink-3); font-family: var(--font-mono); }
.imeta .v { color: var(--ink-2); font-family: var(--font-mono); word-break: break-all; }
/* DAG 框 */
.dagframe { position: relative; padding: 10px 12px 6px; border: 1px solid var(--line); border-radius: 14px; background: rgba(7,11,20,.35); box-shadow: 0 0 0 1px rgba(0,255,204,.04), 0 10px 28px rgba(0,0,0,.32); display: flex; flex-direction: column; overflow: hidden; animation: rise .5s .12s var(--ease) backwards; }
.dagframe::before, .dagframe::after { content: ''; position: absolute; width: 12px; height: 12px; border: 1.5px solid var(--cyan); opacity: .7; }
.dagframe::before { top: -1px; left: -1px; border-right: none; border-bottom: none; border-radius: 5px 0 0 0; }
.dagframe::after { bottom: -1px; right: -1px; border-left: none; border-top: none; border-radius: 0 0 5px 0; }
.dh { position: absolute; top: 8px; left: 30px; font-family: var(--font-mono); font-size: 9.5px; letter-spacing: .2em; color: var(--ink-3); pointer-events: none; }
svg.dag { width: 100%; height: 100%; flex: 1; min-height: 0; display: block; }
/* DAG 入场动效：边描线生长（pathLength=1 归一化）→ 节点弹出 → 标签淡入 */
.dag .edge { fill: none; stroke: var(--line); stroke-width: 2.5; stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw .7s var(--ease) forwards; }
.dag .edge.on { stroke: var(--cyan); stroke-dasharray: .06 .07; animation: draw .7s var(--ease) forwards, dashflow 1.1s .7s linear infinite; }
.dag .edge.sf { fill: none; stroke: var(--magenta-dim); stroke-width: 1.5; stroke-dasharray: 2 4; animation: fade .4s .6s backwards; }
.dag circle { transform-box: fill-box; transform-origin: center; animation: pop .5s .35s var(--ease) backwards; }
.dag text { font-family: var(--font-mono); animation: fade .5s .55s backwards; }
.dag .lbl { font-size: 13px; fill: var(--ink-2); text-anchor: middle; }
.dag .lbl.cur { fill: var(--cyan); }
.dag .sflbl { font-size: 10.5px; fill: var(--magenta-dim); text-anchor: middle; }
@keyframes dashflow { to { stroke-dashoffset: -.26; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
.completable { display: flex; align-items: center; gap: 4px; color: var(--warn); font-size: 12px; margin-top: 6px; justify-content: center; }
/* ================= 下：产出浏览器（文件树 + 预览） ================= */
.browser { margin-top: 14px; border: 1px solid var(--line); border-radius: 16px; background: linear-gradient(180deg, var(--code-bg), var(--bg-1)); box-shadow: inset 0 1px 0 rgba(0,255,204,.05), inset 0 0 40px rgba(0,0,0,.3); padding: 12px 14px 10px; animation: rise .5s .2s var(--ease) backwards; flex: 1; min-height: 0; display: flex; flex-direction: column; }
.browser > input { display: none; }
.bhead { font-family: var(--font-display); font-size: 12.5px; font-weight: 600; color: var(--ink-2); letter-spacing: .14em; margin-bottom: 10px; flex: 0 0 auto; }
.bhead::before { content: '▮ '; color: var(--cyan); }
.bcols { display: grid; grid-template-columns: minmax(170px, 22fr) 78fr; gap: 12px; align-items: stretch; flex: 1; min-height: 0; }
/* 文件树 */
.tree { border: 1px solid var(--line-soft); border-radius: var(--r-md); background: var(--panel); padding: 8px; font-family: var(--font-mono); font-size: 11.5px; overflow: auto; min-height: 0; overscroll-behavior: contain; }
.tree .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tree details.dir { margin: 2px 0 2px 0; padding-left: 8px; }
.tree details.dir > summary { cursor: pointer; color: var(--ink-2); list-style: none; padding: 3px 6px; border-radius: var(--r-sm); display: flex; align-items: center; gap: 6px; }
.tree details.dir > summary::-webkit-details-marker { display: none; }
.tree details.dir > summary::before { content: '▸'; color: var(--ink-3); flex: 0 0 auto; }
.tree details.dir[open] > summary::before { content: '▾'; color: var(--cyan); }
.tree label.fl { display: flex; align-items: center; gap: 7px; padding: 3px 6px; margin: 1px 0 1px 12px; border: 1px solid transparent; border-radius: var(--r-sm); cursor: pointer; color: var(--ink-2); transition: all var(--ease); }
.tree label.fl:hover { color: var(--ink); border-color: var(--line); }
.tree label.fl .fdot { width: 6px; height: 6px; border-radius: 50%; background: var(--cyan-dim); flex: 0 0 auto; }
.tree label.fl.git .fdot { background: var(--magenta-dim); }
.tree label.fl .fsize { color: var(--ink-3); font-size: 10px; flex: 0 0 auto; }
/* 预览区：phead 静态固定在滚动区外，pbody 为唯一滚动容器（自填满剩余高度） */
.bprev { border: 1px solid var(--line-soft); border-radius: var(--r-md); background: var(--panel); overflow: hidden; min-height: 0; display: flex; flex-direction: column; }
.pane { display: none; animation: rise .35s var(--ease); }
.tree details.dir[open] > *:not(summary) { animation: fade .25s var(--ease); }
.jtree details.j[open] .jkids { animation: fade .25s var(--ease); }
.phead { display: flex; align-items: baseline; gap: 12px; padding: 8px 12px; background: var(--panel-2); border-bottom: 1px solid var(--line-soft); font-family: var(--font-mono); flex-wrap: wrap; flex: 0 0 auto; }
.phead .ppath { color: var(--ink); font-size: 12px; word-break: break-all; }
.phead .pmeta { color: var(--ink-3); font-size: 10.5px; margin-left: auto; }
.pbody { padding: 12px 14px; flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; }
.pbody pre.plain { font-family: var(--font-mono); font-size: 11.5px; line-height: 1.55; color: var(--ink-2); white-space: pre-wrap; word-break: break-word; }
.pbody .note { color: var(--ink-3); font-family: var(--font-mono); font-size: 11.5px; }
/* md 渲染：TOC 与正文为同级独立滚动列（结构性根除滚动联动） */
.mdcols { display: grid; grid-template-columns: minmax(140px, 170px) 1fr; flex: 1; min-height: 0; }
@media (max-width: 720px) { .mdcols { grid-template-columns: 1fr; } .toc { display: none; } }
.toc { border-right: 1px dashed var(--line); padding: 8px 10px 8px 2px; font-family: var(--font-mono); font-size: 11px; overflow: auto; min-height: 0; overscroll-behavior: contain; }
.toc .tt { color: var(--ink-3); letter-spacing: .12em; font-size: 9.5px; margin-bottom: 6px; }
.toc a { display: block; color: var(--ink-2); text-decoration: none; padding: 2px 4px; border-radius: 4px; line-height: 1.45; }
.toc a:hover { color: var(--cyan); background: var(--code-bg); }
.toc a.l2 { padding-left: 12px; } .toc a.l3 { padding-left: 24px; }
.mdbody { overflow: auto; min-height: 0; overscroll-behavior: contain; padding: 2px 14px 12px 14px; scroll-behavior: smooth; }
.mdbody h1, .mdbody h2, .mdbody h3, .mdbody h4 { font-family: var(--font-display); color: var(--ink); margin: 14px 0 8px; line-height: 1.35; }
.mdbody h1 { font-size: 19px; } .mdbody h2 { font-size: 16px; border-bottom: 1px dashed var(--line); padding-bottom: 4px; } .mdbody h3 { font-size: 14px; } .mdbody h4 { font-size: 13px; }
.mdbody p { color: var(--ink-2); margin: 6px 0; }
.mdbody code { font-family: var(--font-mono); font-size: 11.5px; color: var(--cyan); background: var(--code-bg); border: 1px solid var(--line-soft); border-radius: 4px; padding: 0 5px; }
.mdbody pre.code { font-family: var(--font-mono); font-size: 11.5px; color: var(--ink-2); background: var(--code-bg); border: 1px solid var(--line-soft); border-radius: var(--r-md); padding: 10px 12px; overflow: auto; margin: 8px 0; line-height: 1.55; }
.mdbody .mdiagram { margin: 10px 0; padding: 10px; background: var(--code-bg); border: 1px solid var(--line-soft); border-radius: var(--r-md); overflow: auto; }
.mdbody .mdiagram svg.mermaid { width: 100%; height: auto; max-height: 420px; display: block; font-family: var(--font-mono); }
.mdbody ul, .mdbody ol { margin: 6px 0 6px 22px; color: var(--ink-2); }
.mdbody li { margin: 2px 0; }
.mdbody blockquote { border-left: 3px solid var(--cyan-dim); padding: 4px 12px; margin: 8px 0; color: var(--ink-2); background: var(--code-bg); border-radius: 0 var(--r-md) var(--r-md) 0; }
.mdbody hr { border: none; border-top: 1px dashed var(--line); margin: 12px 0; }
.mdbody .lnk { color: var(--cyan); border-bottom: 1px dashed var(--cyan-dim); }
.mdbody table.mdt { border-collapse: collapse; margin: 8px 0; font-size: 12px; width: 100%; }
.mdbody table.mdt th { font-family: var(--font-mono); font-size: 11px; color: var(--cyan); text-align: left; }
.mdbody table.mdt th, .mdbody table.mdt td { border: 1px solid var(--line-soft); padding: 4px 10px; color: var(--ink-2); }
/* json 折叠树 */
.jtree { font-family: var(--font-mono); font-size: 11.5px; line-height: 1.65; }
.jtree .jk { color: var(--cyan); }
.jtree .jp { color: var(--ink-3); }
.jtree .j-str { color: var(--ink); word-break: break-all; }
.jtree .j-num { color: var(--magenta-dim); }
.jtree .j-bool { color: var(--warn); }
.jtree .j-null { color: var(--ink-3); }
.jtree details.j { margin-left: 14px; }
.jtree details.j > summary { cursor: pointer; list-style: none; color: var(--ink-2); }
.jtree details.j > summary::-webkit-details-marker { display: none; }
.jtree details.j > summary::before { content: '▸ '; color: var(--ink-3); }
.jtree details.j[open] > summary::before { content: '▾ '; color: var(--cyan); }
.jtree .jkids { border-left: 1px dashed var(--line); margin-left: 8px; padding-left: 6px; }`;

function humanBytes(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return String(n ?? '');
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

const esc = escapeHtml;

/* ------------------------------------------------------------------- DAG */

function renderDag(p, subflows) {
  const n = p.chain.length;
  if (!n) return '';
  const W = 1000; const H = 240; const padX = 78; const nodeY = 118;
  const x = (i) => (n === 1 ? W / 2 : padX + (i * (W - 2 * padX)) / (n - 1));
  const curIdx = p.chain.findIndex((c) => c.current);
  const gateStages = new Set(p.gates.map((g) => g.stage));
  const parts = [];
  for (let i = 0; i < n - 1; i++) {
    const x0 = x(i); const x1 = x(i + 1);
    const mx = (x0 + x1) / 2;
    const on = curIdx === i + 1 ? ' on' : '';
    parts.push(`<path class="edge${on}" pathLength="1" d="M${x0} ${nodeY - 9} Q${mx} 40 ${x1} ${nodeY - 9}"/>`);
  }
  p.chain.forEach((c, i) => {
    const cx = x(i);
    const fill = STATUS_FILL[c.status] || STATUS_FILL.pending;
    const cur = c.current;
    if (cur) {
      parts.push(`<circle cx="${cx}" cy="${nodeY}" r="16" fill="${fill}" opacity=".16"><animate attributeName="opacity" values=".08;.22;.08" dur="2.4s" repeatCount="indefinite"/></circle>`);
    }
    parts.push(`<circle cx="${cx}" cy="${nodeY}" r="${cur ? 9.5 : 7}" fill="${fill}" stroke="var(--bg-1)" stroke-width="2.5"/>`);
    if (gateStages.has(c.stage)) {
      parts.push(`<circle cx="${cx}" cy="${nodeY}" r="13" fill="none" stroke="var(--warn)" stroke-width="1.5" stroke-dasharray="3 4"/>`);
    }
    parts.push(`<text class="lbl${cur ? ' cur' : ''}" x="${cx}" y="${nodeY + 52}">${esc(c.stage)}</text>`);
  });
  if (Array.isArray(subflows) && subflows.length) {
    const byStage = new Map();
    subflows.forEach((sf) => {
      const host = p.chain.findIndex((c) => c.stage === sf.atStage);
      const k = host >= 0 ? host : 0;
      if (!byStage.has(k)) byStage.set(k, []);
      byStage.get(k).push(sf);
    });
    for (const [i, list] of byStage) {
      list.slice(0, 3).forEach((sf, j) => {
        const sx = x(i) + 26 + j * 14; const sy = nodeY + 84 + j * 9;
        parts.push(`<path class="edge sf" d="M${x(i)} ${nodeY + 12} Q${x(i) + 13} ${nodeY + 48} ${sx} ${sy}"/>`);
        parts.push(`<circle cx="${sx}" cy="${sy}" r="3.5" fill="var(--magenta)"/>`);
        parts.push(`<text class="sflbl" x="${sx + 2}" y="${sy + 14}">${esc(sf.id)}</text>`);
      });
    }
  }
  return `<svg class="dag" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="流程 DAG">${parts.join('')}</svg>`;
}

/* ------------------------------------------------------------------ 信息 */

function renderInfo(h, progress) {
  const waiting = progress.gates.length > 0;
  // 状态胶囊：已收口（finalStatus 唯一依据，DEC-4）> 待收束（位置空未收口）> 等待门/运行中
  let stHtml;
  if (h.finalStatus) {
    const cls = h.finalStatus === 'done' ? 'ok' : h.finalStatus === 'failed' ? 'danger' : 'wait';
    stHtml = `<span class="st ${cls}">已收口 · ${esc(h.finalStatus)}</span>`;
  } else if (progress.completable) {
    stHtml = '<span class="st wait">待收束</span>';
  } else {
    stHtml = `<span class="st ${waiting ? 'wait' : 'run'}">${waiting ? '等待确认门' : '运行中'}</span>`;
  }
  const posBig = progress.positions.length
    ? progress.positions.map((s) => `${esc(s.stage)}:${esc(s.phase)}`).join('　')
    : '—';
  const badges = [
    h.type ? `<span class="badge">${esc(h.type)}</span>` : '',
    h.workflow ? `<span class="badge">${esc(h.workflow)}</span>` : '',
    `<span class="badge dim">v${esc(h.schemaVersion)}</span>`,
    h.ephemeral ? '<span class="badge dim">ephemeral</span>' : '',
    h.source ? `<span class="badge dim">${esc(h.source === 'history' ? '历史归档' : h.source === 'project' ? '本项目' : 'index')}</span>` : '',
  ].filter(Boolean).join('');
  const shortPath = (p) => {
    const s = String(p || '');
    const parts = s.replace(/\\/g, '/').split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : s;
  };
  const meta = [
    ['runId', h.runId, h.runId],
    ['启动', h.startedAt, h.startedAt],
    ...(h.finalStatus ? [['收口', h.endedAt || h.finalStatus, h.endedAt]] : []),
    ['项目', shortPath(h.projectRoot), h.projectRoot],
    ['git', h.gitSummary || '—', h.gitSummary || ''],
  ].filter(([, v]) => v).map(([k, v, full]) => `<span class="k">${esc(k)}</span><span class="v" title="${esc(full || v)}">${esc(v)}</span>`).join('');
  return `<aside class="info">
<div class="hline"><span class="dot ${waiting ? 'wait' : 'run'}"></span><span class="pos">${progress.completable ? '全部相位完成' : posBig}</span>${stHtml}</div>
<div class="ititle" title="${esc(h.title)}">${esc(h.title)}</div>
<div class="hbadges">${badges}</div>
<div class="imeta">${meta}</div></aside>`;
}

/* --------------------------------------------------------- 产出浏览器 */

/** 树节点 → HTML（目录 details + 文件 label；名称 ellipsis，悬浮全文）。 */
function treeNodeHtml(node, idOf) {
  const dirs = [...node.dirs.values()].map((d) => `<details class="dir" open><summary title="${esc(d.name)}"><span class="nm">${esc(d.name)}</span></summary>${treeNodeHtml(d, idOf)}</details>`).join('');
  const files = node.files.map((f) => `<label class="fl" for="ddof${idOf(f)}" title="${esc(f.rel)}"><span class="fdot"></span><span class="nm">${esc(String(f.rel).split('/').pop())}</span><span class="fsize">${esc(humanBytes(f.bytes))}</span></label>`).join('');
  return dirs + files;
}

/** JSON 正常结构渲染：格式化 + 语法染色（键/字符串/数字/布尔/null 分色；用户修订 2026-11-15，替代折叠树）。 */
function renderJsonPretty(text) {
  let obj;
  try { obj = JSON.parse(text); } catch { return null; }
  const pretty = JSON.stringify(obj, null, 2);
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|\b(?:true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(pretty))) {
    out += esc(pretty.slice(last, m.index));
    const full = m[0];
    if (m[1] !== undefined) {
      out += m[2] !== undefined
        ? `<span class="jk">${esc(m[1])}</span>${m[2]}`
        : `<span class="j-str">${esc(m[1])}</span>`;
    } else if (full === 'true' || full === 'false') {
      out += `<span class="j-bool">${full}</span>`;
    } else if (full === 'null') {
      out += '<span class="j-null">null</span>';
    } else {
      out += `<span class="j-num">${esc(full)}</span>`;
    }
    last = re.lastIndex;
  }
  out += esc(pretty.slice(last));
  return `<div class="jtree"><pre class="plain">${out}</pre></div>`;
}

/** 单文件 → 预览面板体（md/json/纯文本/降级说明）；md 标题 id 带文件前缀防串线。 */
function filePaneBody(f, fid) {
  if (f.content === null) return `<div class="note">${esc(f.note || '不内联')}</div>`;
  const name = String(f.rel).toLowerCase();
  if (name.endsWith('.md')) {
    const { html, toc } = renderMarkdown(f.content, `f${fid}-`);
    const nav = toc.length
      ? `<nav class="toc"><div class="tt">TOC · 目录</div>${toc.map((t) => `<a class="l${Math.min(t.level, 3)}" href="#${t.id}" title="${esc(t.text)}">${esc(t.text)}</a>`).join('')}</nav>`
      : '';
    return `<div class="mdcols">${nav}<div class="mdbody">${html}</div></div>`;
  }
  if (name.endsWith('.json')) {
    const pretty = renderJsonPretty(f.content);
    if (pretty) return pretty;
    return `<pre class="plain">${esc(f.content)}</pre>`;
  }
  return `<pre class="plain">${esc(f.content)}</pre>`;
}

/** git 快照 → 面板体。 */
function gitPaneBody(gitc) {
  const list = gitc.changes.length ? gitc.changes.map((l) => esc(l)).join('\n') : '（工作区无未提交变更）';
  const stat = gitc.stat ? `\n\n--- diff --stat HEAD ---\n${esc(gitc.stat)}` : '';
  return `<pre class="plain">${list}${stat}</pre>`;
}

/** 产出浏览器整块：radio 页签 + 文件树 + 预览（同文件多阶段登记去重、阶段合并）。 */
function renderBrowser(browser) {
  const raw = (browser && browser.files) || [];
  const gitc = browser && browser.git;
  // 去重：同一 rel 保留最新登记，阶段合并展示
  const byRel = new Map();
  for (const f of raw) {
    const prev = byRel.get(f.rel);
    if (!prev) byRel.set(f.rel, f);
    else {
      const stages = [...new Set([...String(prev.stage).split(' · '), f.stage])].join(' · ');
      byRel.set(f.rel, Object.assign({}, f, { stage: stages }));
    }
  }
  const files = [...byRel.values()];
  const entries = files.map((f, i) => ({ id: i, kind: 'file', f }));
  if (gitc) entries.push({ id: files.length, kind: 'git', f: null });
  if (!entries.length) {
    return `<section class="browser"><div class="bhead">产出</div><div class="note" style="color:var(--ink-3)">暂无登记产物，且项目无 git 信息</div></section>`;
  }
  // radio 输入（首项默认选中）+ 每项的显隐/高亮规则（纯 CSS 页签）
  const inputs = entries.map((e, i) => `<input type="radio" name="ddof" id="ddof${e.id}"${i === 0 ? ' checked' : ''}>`).join('');
  const rules = entries.map((e) => `#ddof${e.id}:checked ~ .bcols .ddop${e.id}{display:flex;flex-direction:column;flex:1;min-height:0}#ddof${e.id}:checked ~ .bcols label[for="ddof${e.id}"]{color:var(--cyan);border-color:rgba(0,255,204,.35);background:linear-gradient(90deg,rgba(0,255,204,.08),transparent)}`).join('');
  const idOf = (f) => files.indexOf(f);
  const treeInner = treeNodeHtml(buildTree(files), idOf);
  const gitLabel = gitc
    ? `<label class="fl git" for="ddof${files.length}"><span class="fdot"></span><span class="nm">git 工作区快照</span><span class="fsize">${gitc.changes.length || '—'}</span></label>`
    : '';
  const treeHtml = `<div class="tree">${treeInner}${gitLabel}</div>`;
  const panes = entries.map((e) => {
    if (e.kind === 'git') {
      return `<div class="pane ddop${e.id}"><div class="phead"><span class="ppath">git 工作区快照</span><span class="pmeta">${esc(gitc.branchLine)}</span></div><div class="pbody">${gitPaneBody(gitc)}</div></div>`;
    }
    const f = e.f;
    const meta = `${f.stage} · ${humanBytes(f.bytes)}${f.content === null ? ` · ${f.note}` : ''}`;
    // md 面板不套 pbody（TOC 与正文同级独立滚动）；其余类型用 pbody 滚动容器
    const isMd = String(f.rel).toLowerCase().endsWith('.md') && f.content !== null;
    const body = isMd
      ? filePaneBody(f, e.id)
      : `<div class="pbody">${filePaneBody(f, e.id)}</div>`;
    return `<div class="pane ddop${e.id}"><div class="phead"><span class="ppath">${esc(f.rel)}</span><span class="pmeta">${esc(meta)}</span></div>${body}</div>`;
  }).join('');
  return `<section class="browser"><div class="bhead">产出</div>${inputs}<div class="bcols">${treeHtml}<div class="bprev">${panes}</div></div><style>${rules}</style></section>`;
}

/* ------------------------------------------------------------------ 总装 */

function renderHtml(vm, browser) {
  const completableRow = vm.header.finalStatus
    ? `<div class="completable" style="color:${vm.header.finalStatus === 'failed' ? 'var(--danger)' : 'var(--ok)'};justify-content:center"><span>已收口 · ${esc(vm.header.finalStatus)}${vm.header.endedAt ? ` · ${esc(vm.header.endedAt)}` : ''}</span></div>`
    : vm.progress.completable
      ? `<div class="completable">${LIVE_STAR}<span>待收束：run finish --status done 可收口</span></div>`
      : '';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<title>${esc(vm.header.runId)} · Ddo-Code-Flow 流水信息</title>
<style>${DOCS_ROOT_VARS}\n${DOCS_ICON_RULES}\n${LAYOUT_CSS}</style></head>
<body><main class="dagpage">
<div class="layout">
${renderInfo(vm.header, vm.progress)}
<div class="dagframe"><div class="dh">FLOW DAG · 流程图</div>${renderDag(vm.progress, vm.subflows)}${completableRow}</div>
</div>
${renderBrowser(browser || { files: [], git: null })}
</main></body></html>`;
}

module.exports = { renderHtml, renderDag, renderJsonPretty, humanBytes };
