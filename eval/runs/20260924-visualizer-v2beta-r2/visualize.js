#!/usr/bin/env node
'use strict';
/**
 * ddo-code-flow 工作流可视化工具（dogfooding run 20260924-023150-94cb 交付物）
 *
 * 读取 ~/.ddo/index.json（运行中 run 指针）与其指向的 .state.json，
 * 生成静态 ddo-visual.html：SVG 绘制执行流程图，连线自检零相交。
 *
 * 用法：node visualize.js [--out <path>] [--home <ddoHome>]
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

function parseArgs(argv) {
  const out = { out: 'ddo-visual.html', home: path.join(os.homedir(), '.ddo') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') out.out = argv[++i];
    else if (argv[i] === '--home') out.home = argv[++i];
  }
  return out;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return undefined;
  }
}

/** task-01：读索引与 state，构建渲染模型（容错：缺失/损坏记 error，不阻断） */
function loadRuns(home) {
  const indexPath = path.join(home, 'index.json');
  const index = readJson(indexPath);
  if (!index || typeof index !== 'object') return [];
  const runs = [];
  for (const [runId, entry] of Object.entries(index)) {
    const statePath = entry && entry.statePath;
    const state = statePath ? readJson(statePath) : undefined;
    if (!state) {
      runs.push({ runId, title: '', error: 'state 缺失或损坏' });
      continue;
    }
    const stages = [];
    const stageEntries = state.stages && typeof state.stages === 'object' ? Object.entries(state.stages) : [];
    for (const [name, st] of stageEntries) {
      stages.push({
        name,
        status: (st && st.status) || 'unknown',
        gate: st && st.gate ? st.gate : null,
      });
    }
    const cur = Array.isArray(state.currentStage) ? state.currentStage[0] : state.currentStage;
    let currentName = null;
    let currentPhase = null;
    if (typeof cur === 'string') {
      const idx = cur.indexOf(':');
      currentName = idx >= 0 ? cur.slice(0, idx) : cur;
      currentPhase = idx >= 0 ? cur.slice(idx + 1) : null;
    } else if (cur && typeof cur === 'object') {
      currentName = cur.stage || null;
      currentPhase = cur.phase || null;
    }
    runs.push({ runId, title: state.title || '', startedAt: state.startedAt || '', stages, currentName, currentPhase });
  }
  return runs;
}

/** task-02：布局——阶段主链水平排布，门节点挂同列上方，自检两两相交计数 */
function layout(run) {
  const W = 132;
  const H = 44;
  const GAP = 56;
  const MAIN_Y = 120;
  const GATE_Y = 40;
  const nodes = [];
  const edges = [];
  const xs = [];
  const n = run.stages.length;
  for (let i = 0; i < n; i++) {
    const x = 20 + i * (W + GAP);
    xs.push(x);
    nodes.push({ kind: 'stage', ref: run.stages[i], x, y: MAIN_Y, w: W, h: H });
  }
  for (let i = 0; i + 1 < n; i++) {
    edges.push({ from: i, to: i + 1, pts: [[xs[i] + W, MAIN_Y + H / 2], [xs[i + 1], MAIN_Y + H / 2]] });
  }
  // 门节点：同列正上方，垂直连接段（列中心 x，位于主链边 x 跨度之外，结构性不相交）
  run.stages.forEach((st, i) => {
    if (!st.gate) return;
    nodes.push({ kind: 'gate', ref: st, x: xs[i] + 16, y: GATE_Y, w: W - 32, h: 30 });
    edges.push({ from: `gate-${i}`, to: i, pts: [[xs[i] + W / 2, GATE_Y + 30], [xs[i] + W / 2, MAIN_Y]] });
  });
  return { nodes, edges };
}

/** 线段相交判定（不含共享端点的接触） */
function segIntersect(p1, p2, p3, p4) {
  const d1x = p2[0] - p1[0], d1y = p2[1] - p1[1];
  const d2x = p4[0] - p3[0], d2y = p4[1] - p3[1];
  const denom = d1x * d2y - d1y * d2x;
  if (denom === 0) return false;
  const t = ((p3[0] - p1[0]) * d2y - (p3[1] - p1[1]) * d2x) / denom;
  const u = ((p3[0] - p1[0]) * d1y - (p3[1] - p1[1]) * d1x) / denom;
  const eps = 1e-9;
  if (t < eps || t > 1 - eps || u < eps || u > 1 - eps) return false;
  return true;
}

/** 自检：全部边两两（逐段）判定；返回交叉计数与样本 */
function countCrossings(edges) {
  let count = 0;
  const samples = [];
  for (let a = 0; a < edges.length; a++) {
    for (let b = a + 1; b < edges.length; b++) {
      const ea = edges[a].pts, eb = edges[b].pts;
      let hit = false;
      for (let i = 0; i + 1 < ea.length && !hit; i++) {
        for (let j = 0; j + 1 < eb.length && !hit; j++) {
          if (segIntersect(ea[i], ea[i + 1], eb[j], eb[j + 1])) {
            hit = true;
            samples.push(`edge#${a} × edge#${b}`);
          }
        }
      }
      if (hit) count++;
    }
  }
  return { count, samples };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STATUS_LABEL = { done: '完成', running: '进行中', pending: '待开始', 'waiting-human': '待人审' };

/** task-03：SVG/HTML 渲染 */
function renderRunSvg(run) {
  const { nodes, edges } = layout(run);
  const width = 20 + run.stages.length * (132 + 56);
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="200" viewBox="0 0 ${width} 200" role="img">`);
  for (const e of edges) {
    const d = e.pts.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(' ');
    parts.push(`<path d="${d}" fill="none" stroke="#5b6472" stroke-width="1.6"/>`);
    const last = e.pts[e.pts.length - 1], prev = e.pts[e.pts.length - 2];
    const ang = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
    const a1 = [last[0] - 8 * Math.cos(ang - 0.42), last[1] - 8 * Math.sin(ang - 0.42)];
    const a2 = [last[0] - 8 * Math.cos(ang + 0.42), last[1] - 8 * Math.sin(ang + 0.42)];
    parts.push(`<path d="M ${a1[0]} ${a1[1]} L ${last[0]} ${last[1]} L ${a2[0]} ${a2[1]}" fill="none" stroke="#5b6472" stroke-width="1.6"/>`);
  }
  for (const nd of nodes) {
    if (nd.kind === 'gate') {
      const g = nd.ref.gate;
      const open = !g.closedAt;
      const fill = open ? '#fff3cd' : '#d1e7dd';
      const label = open ? `门 ${g.phase}·待决议` : `门 ${g.phase}·${g.decision || '已关闭'}`;
      parts.push(`<rect x="${nd.x}" y="${nd.y}" width="${nd.w}" height="${nd.h}" rx="15" fill="${fill}" stroke="#8a7d4a"/>`);
      parts.push(`<text x="${nd.x + nd.w / 2}" y="${nd.y + 19}" text-anchor="middle" font-size="12" fill="#4a4326">${esc(label)}</text>`);
    } else {
      const isCurrent = run.currentName === nd.ref.name;
      const fill = isCurrent ? '#cfe2ff' : nd.ref.status === 'done' ? '#e9ecef' : '#f8f9fa';
      const stroke = isCurrent ? '#0d6efd' : '#adb5bd';
      parts.push(`<rect x="${nd.x}" y="${nd.y}" width="${nd.w}" height="${nd.h}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="${isCurrent ? 2.4 : 1.2}"/>`);
      const phase = isCurrent && run.currentPhase ? `:${run.currentPhase}` : '';
      parts.push(`<text x="${nd.x + nd.w / 2}" y="${nd.y + 19}" text-anchor="middle" font-size="13" font-weight="${isCurrent ? 'bold' : 'normal'}" fill="#212529">${esc(nd.ref.name + phase)}</text>`);
      parts.push(`<text x="${nd.x + nd.w / 2}" y="${nd.y + 35}" text-anchor="middle" font-size="11" fill="#6c757d">${esc(STATUS_LABEL[nd.ref.status] || nd.ref.status)}${isCurrent ? ' · ▶ 当前' : ''}</text>`);
    }
  }
  parts.push('</svg>');
  return parts.join('\n');
}

function renderHtml(runs) {
  const genAt = new Date().toString();
  const head = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>ddo-code-flow 运行可视化</title>
<style>
  body { font-family: -apple-system, "PingFang SC", sans-serif; margin: 24px; color: #212529; }
  h1 { font-size: 20px; } h2 { font-size: 15px; margin-bottom: 4px; }
  .meta { color: #6c757d; font-size: 12px; margin-bottom: 16px; }
  .run { border: 1px solid #dee2e6; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; }
  .err { color: #b02a37; }
  .legend { font-size: 12px; color: #6c757d; }
</style>
</head>
<body>
<h1>ddo-code-flow 运行可视化</h1>
<div class="meta">数据来源：索引文件（仅运行中 run）与各 run 的 .state.json · 生成时间：${esc(genAt)}</div>`;
  if (!runs.length) {
    return head + '\n<p>no running runs（索引为空或不可读，0 run）</p>\n</body>\n</html>\n';
  }
  const sections = runs.map((run) => {
    if (run.error) {
      return `<div class="run"><h2>${esc(run.runId)}</h2><p class="err">${esc(run.error)}</p></div>`;
    }
    const gateInfo = run.stages.some((s) => s.gate) ? '<span class="legend">门节点：黄=待决议，绿=已决议</span>' : '';
    return `<div class="run">
<h2>${esc(run.runId)} · current: ${esc(run.currentName || '—')}${run.currentPhase ? ':' + esc(run.currentPhase) : ''}</h2>
<div class="meta">${esc(run.title)}${run.startedAt ? ' · 开始 ' + esc(run.startedAt) : ''}</div>
${renderRunSvg(run)}
${gateInfo}
</div>`;
  });
  return head + '\n' + sections.join('\n') + '\n</body>\n</html>\n';
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const runs = loadRuns(args.home);
  const html = renderHtml(runs);
  const outPath = path.resolve(args.out);
  fs.writeFileSync(outPath, html);
  // 自检计数（含空态图：0 边 → 0 交叉）
  let crossings = 0;
  const samples = [];
  for (const run of runs) {
    if (run.error) continue;
    const r = countCrossings(layout(run).edges);
    crossings += r.count;
    samples.push(...r.samples);
  }
  console.log(`runs: ${runs.length}${runs.length === 0 ? ' (no running runs)' : ''}`);
  for (const run of runs) {
    if (run.error) console.log(`run: ${run.runId} (${run.error})`);
    else console.log(`run: ${run.runId} (${run.currentName || '?'}${run.currentPhase ? ':' + run.currentPhase : ''})`);
  }
  console.log(`output: ${outPath}`);
  console.log(`crossings: ${crossings}`);
  if (samples.length) {
    console.log('crossing samples: ' + samples.join(', '));
    console.log('注意：存在相交，布局自检未收敛（诚实报告，不静默）');
  }
}

main();
