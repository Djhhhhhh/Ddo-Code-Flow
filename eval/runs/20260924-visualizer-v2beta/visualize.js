#!/usr/bin/env node
'use strict';
// visualize.js — ddo-code-flow 工作流可视化工具（eval dogfooding 产物）。
// 读 DDO_HOME（缺省 ~/.ddo，--home 覆写）下 index.json 发现运行中 run，逐个解析
// .state.json，用 layout.js 分层布局渲染为单文件静态 HTML（内联 SVG，连线不相交——
// 布局自检 crossings 计入摘要；复杂/非平面结构如实标注）。
// 四通道契约：stdout = JSON 摘要 / stderr = 人话 / exit 0 成功 · 1 失败。

const fs = require('fs');
const os = require('os');
const path = require('path');
const { layout, NODE_W, NODE_H } = require('./layout');

const STATUS_COLOR = {
  pending: '#94a3b8',
  running: '#3b82f6',
  done: '#22c55e',
  failed: '#ef4444',
  'waiting-human': '#f59e0b',
};
const STATUS_LABEL = { pending: '待执行', running: '执行中', done: '完成', failed: '失败', 'waiting-human': '人审中' };

function main() {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const i = args.indexOf(`--${name}`);
    return i !== -1 ? args[i + 1] : undefined;
  };
  const home = flag('home') || process.env.DDO_HOME || path.join(os.homedir(), '.ddo');
  const out = flag('out') || 'ddo-visual.html';

  const indexFile = path.join(home, 'index.json');
  let entries = {};
  if (fs.existsSync(indexFile)) {
    try {
      entries = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    } catch (e) {
      process.stderr.write(`[失败] index.json 解析失败: ${e.message}\n`);
      process.exit(1);
    }
  } else {
    process.stderr.write(`[提示] 未发现索引 ${indexFile}——无运行中的 run，输出空页面\n`);
  }

  const runs = [];
  let stale = 0;
  for (const [runId, entry] of Object.entries(entries)) {
    let state;
    try {
      state = JSON.parse(fs.readFileSync(entry.statePath, 'utf8'));
    } catch {
      stale++; // 惰性校验：失效指针跳过不阻断
      continue;
    }
    const stages = Object.keys(state.stages || {}).map((id) => ({ id, dependOn: state.stages[id].dependOn || [] }));
    let view;
    try {
      view = layout(stages);
    } catch (e) {
      process.stderr.write(`[警告] run ${runId} 布局失败: ${e.message}（跳过）\n`);
      stale++;
      continue;
    }
    runs.push({ runId, state, view });
  }

  const totalCrossings = runs.reduce((n, r) => n + r.view.crossings, 0);
  const html = render(runs, { totalCrossings, stale });
  fs.writeFileSync(out, html);
  process.stdout.write(`${JSON.stringify({ runs: runs.length, stale, output: path.resolve(out), crossings: totalCrossings })}\n`);
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function render(runs, meta) {
  const sections = runs.map((r) => runSection(r)).join('\n');
  const banner = meta.totalCrossings
    ? `<p class="warn">⚠ 布局自检发现 ${meta.totalCrossings} 处连线交叉（对应 workflow 结构复杂或非平面，已如实标注未消除）</p>`
    : '<p class="ok">布局自检：0 交叉，全部连线不相交 ✓</p>';
  return `<!doctype html>
<html lang="zh"><head><meta charset="utf-8"><title>ddo-code-flow 运行中工作流</title>
<style>
 body{font:14px/1.6 -apple-system,"PingFang SC",sans-serif;margin:24px;background:#f8fafc;color:#0f172a}
 h1{font-size:20px} h2{font-size:16px;margin:28px 0 4px} .meta{color:#64748b;font-size:12px;margin-bottom:8px}
 .warn{background:#fef3c7;border:1px solid #f59e0b;padding:8px 12px;border-radius:6px}
 .ok{background:#ecfdf5;border:1px solid #22c55e;padding:8px 12px;border-radius:6px}
 section{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin:14px 0}
 .node rect{stroke-width:1.5} .node text{font-size:12px;text-anchor:middle;fill:#fff}
 .node .sub{font-size:10px;fill:#ffffffcc}
 .edge{stroke:#64748b;stroke-width:2;fill:none} .vdot{fill:#64748b}
 .cur rect{stroke:#f59e0b;stroke-width:3} .phase{font-size:11px;fill:#b45309;text-anchor:middle;font-weight:600}
 .gate{fill:#ef4444;font-size:11px;text-anchor:middle}
 .done rect{fill:#22c55e}.running rect{fill:#3b82f6}.pending rect{fill:#94a3b8}
 .failed rect{fill:#ef4444}.wh rect{fill:#f59e0b}
</style></head><body>
<h1>ddo-code-flow · 运行中工作流</h1>
${banner}
${runs.length ? sections : '<p>（无运行中的 run）</p>'}
${meta.stale ? `<p class="meta">另有 ${meta.stale} 个失效索引条目已跳过（statePath 不可读）</p>` : ''}
</body></html>`;
}

function runSection({ runId, state, view }) {
  const pad = 24;
  const w = view.size.w + pad * 2;
  const h = view.size.h + pad * 2;
  const cur = new Set((state.currentStage || []).map((e) => String(e).split(':')[0]));
  const curPhase = new Map((state.currentStage || []).map((e) => {
    const [s, p] = String(e).split(':');
    return [s, (p || '01').padStart(2, '0')];
  }));
  const gateOpen = new Set(Object.entries(state.stages || {})
    .filter(([, st]) => st.gate && !st.gate.decision).map(([id]) => id));

  const edges = view.edges.map((e) =>
    `<polyline class="edge" points="${e.polyline.map((p) => `${p.x + pad},${p.y + pad}`).join(' ')}"/>`).join('');
  const vdots = [...view.virtual].map((id) => {
    const p = view.positions.get(id);
    return `<circle class="vdot" cx="${p.x + pad}" cy="${p.y + pad}" r="4"/>`;
  }).join('');
  const nodes = [...view.positions.entries()].filter(([id]) => !view.virtual.has(id)).map(([id, p]) => {
    const st = (state.stages || {})[id] || {};
    const status = STATUS_COLOR[st.status] ? st.status : 'pending';
    const isCur = cur.has(id);
    const classes = ['node', status === 'waiting-human' ? 'wh' : status, isCur ? 'cur' : ''].filter(Boolean).join(' ');
    const x = p.x - NODE_W / 2 + pad;
    const y = p.y - NODE_H / 2 + pad;
    const phaseLabel = isCur ? `<text class="phase" x="${p.x + pad}" y="${y - 8}">▸ ${curPhase.get(id)}</text>` : '';
    const gateLabel = gateOpen.has(id) ? `<text class="gate" x="${x + NODE_W - 4}" y="${y + 14}">⛔门</text>` : '';
    return `<g class="${classes}">
<rect x="${x}" y="${y}" width="${NODE_W}" height="${NODE_H}" rx="8" fill="${STATUS_COLOR[status] || STATUS_COLOR.pending}"/>
<text x="${p.x + pad}" y="${p.y + pad - 3}">${esc(id)}</text>
<text class="sub" x="${p.x + pad}" y="${p.y + pad + 13}">${esc(STATUS_LABEL[status] || status)}</text>
${phaseLabel}${gateLabel}</g>`;
  }).join('');

  return `<section>
<h2>${esc(state.title || runId)}</h2>
<p class="meta">runId ${esc(runId)} · 启动 ${esc(state.startedAt || '?')} · 当前位置 ${esc((state.currentStage || []).join(', ') || '—')} · 交叉 ${view.crossings}</p>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
${edges}${vdots}${nodes}
</svg>
</section>`;
}

main();
