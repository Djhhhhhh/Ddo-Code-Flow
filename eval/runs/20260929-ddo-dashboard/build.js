#!/usr/bin/env node
'use strict';
// build.js — ddo 开发中需求 dashboard 生成器（eval showcase 沙箱产物）。
// 读 DDO_HOME（缺省 ~/.ddo，--home 覆写）下 index.json 发现运行中 run，逐个解析
// .state.json 提炼摘要，渲染为单文件静态 dashboard.html——数据以内嵌 JSON 快照落盘，
// 浏览器双击即开、无任何运行时取数；刷新 = 重新执行本脚本。
// 四通道契约：stdout = JSON 摘要 / stderr = 人话 / exit 0 成功 · 1 失败。
// 复用先例：eval/runs/20260924-visualizer-v2beta/visualize.js（--home/--out 模式、
// 状态色与标签语义）；index.json 契约对齐 tools/lib/index-registry.js（只读）。

const fs = require('fs');
const os = require('os');
const path = require('path');

// 五状态语义沿用 visualize.js 先例（R-3）
const STATUS_LABEL = { pending: '待执行', running: '执行中', done: '完成', failed: '失败', 'waiting-human': '人审中' };
const STATUS_COLOR = { pending: '#94a3b8', running: '#3b82f6', done: '#22c55e', failed: '#ef4444', 'waiting-human': '#f59e0b' };

function fail(msg) {
  process.stderr.write(`build.js: ${msg}\n`);
  process.exit(1);
}

function flag(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const home = flag('home') || process.env.DDO_HOME || path.join(os.homedir(), '.ddo');
const out = path.resolve(flag('out') || 'dashboard.html');

// type 提取：statePath 的 .ddo/runs/<type>/<runId> 路径段（降级条目也能提取）
function typeOf(statePath) {
  const m = /[/\\]\.ddo[/\\]runs[/\\]([^/\\]+)[/\\]([^/\\]+)/.exec(statePath || '');
  return m ? m[1] : '';
}

// RunSummary 提炼：单条 .state.json 读失败 → 降级行（readable=false），不阻塞整体
function summarize(runId, entry) {
  const base = { runId, startedAt: entry.startedAt, statePath: entry.statePath, type: typeOf(entry.statePath) };
  let state;
  try {
    state = JSON.parse(fs.readFileSync(entry.statePath, 'utf8'));
  } catch (e) {
    return { ...base, title: '(状态不可读)', readable: false, degraded: `读取 .state.json 失败：${e.code || e.message}` };
  }
  const stages = Object.keys(state.stages || {}).map((name) => {
    const st = state.stages[name] || {};
    return { name, status: st.status || 'pending', gateWaiting: !!(st.gate && !st.gate.closedAt) };
  });
  return {
    ...base,
    title: state.title || '(untitled)',
    startedAt: state.startedAt || entry.startedAt,
    currentStage: (state.currentStage || []).join(', '),
    stages,
    gitBranch: (state.git && state.git.branch) || '',
    projectRoot: (state.dirs && state.dirs.projectRoot) || '',
    readable: true,
  };
}

// HTML 骨架：快照藏于 <script type="application/json">（< 转义防 </script> 逃逸），
// 打开时由内联脚本渲染——模板与数据分离，双击即开（file:// 无取数）。
function render(snap) {
  const json = JSON.stringify(snap).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ddo 开发中需求 Dashboard</title>
<style>
  :root { --ink:#0f172a; --dim:#64748b; --line:#e2e8f0; --bg:#f8fafc; --card:#ffffff; }
  * { box-sizing:border-box; margin:0; }
  body { font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
         color:var(--ink); background:var(--bg); padding:32px 16px; }
  main { max-width:920px; margin:0 auto; }
  h1 { font-size:20px; margin-bottom:4px; }
  .sub { color:var(--dim); font-size:12px; margin-bottom:24px; }
  .sub code { background:#eef2f7; border-radius:4px; padding:1px 6px; font-size:11px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:16px 20px; margin-bottom:14px; }
  .card.degraded { border-style:dashed; border-color:#f59e0b; background:#fffbeb; }
  .r1 { display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
  .badge { font-size:11px; font-weight:600; color:#fff; background:#3b82f6; border-radius:99px; padding:1px 10px; }
  .title { font-size:15px; font-weight:600; }
  .runid { font:11px/1 ui-monospace,Menlo,monospace; color:var(--dim); }
  .chips { display:flex; gap:6px; flex-wrap:wrap; margin:10px 0 8px; }
  .chip { display:inline-flex; align-items:center; gap:5px; font-size:12px; color:var(--dim);
          border:1px solid var(--line); border-radius:99px; padding:2px 10px; background:#f8fafc; }
  .chip .dot { width:8px; height:8px; border-radius:50%; }
  .chip.current { border-color:#0f172a; color:var(--ink); font-weight:600; }
  .chip.gate::after { content:"门"; font-size:10px; color:#b45309; font-weight:700; }
  .meta { font-size:12px; color:var(--dim); word-break:break-all; }
  .meta b { color:var(--ink); font-weight:600; }
  .reason { font-size:12px; color:#b45309; margin-top:6px; }
  .empty { text-align:center; color:var(--dim); padding:48px 0; border:1px dashed var(--line); border-radius:10px; }
  footer { color:var(--dim); font-size:12px; margin-top:20px; }
</style>
</head>
<body>
<main>
  <h1>ddo 开发中需求 Dashboard</h1>
  <p class="sub" id="sub"></p>
  <div id="list"></div>
  <footer>本页数据为生成时刻的内嵌快照（非实时）——刷新：node build.js 重新生成。</footer>
</main>
<script id="snapshot" type="application/json">${json}</script>
<script>
(function () {
  var snap;
  try { snap = JSON.parse(document.getElementById('snapshot').textContent); }
  catch (e) { document.getElementById('sub').textContent = '快照解析失败：' + e.message; return; }
  var L = snap.meta.label, C = snap.meta.color;
  var el = function (tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  var runs = snap.runs || [];
  var degraded = runs.filter(function (r) { return !r.readable; }).length;
  document.getElementById('sub').innerHTML = '';
  document.getElementById('sub').append(
    '数据源 ', Object.assign(document.createElement('code'), { textContent: snap.source }),
    ' · 生成于 ' + new Date(snap.generatedAt).toLocaleString(),
    ' · 运行中 ' + runs.length + ' 个' + (degraded ? '（降级 ' + degraded + '）' : '')
  );
  var list = document.getElementById('list');
  if (!runs.length) {
    list.append(el('div', 'empty', '当前机器没有正在开发的 run（index.json 为空或不存在）'));
    return;
  }
  runs.forEach(function (r) {
    var card = el('article', 'card' + (r.readable ? '' : ' degraded'));
    var r1 = el('div', 'r1');
    if (r.type) r1.append(el('span', 'badge', r.type));
    r1.append(el('span', 'title', r.title), el('span', 'runid', r.runId));
    card.append(r1);
    if (r.readable) {
      var currentName = (r.currentStage || '').split(':')[0];
      var chips = el('div', 'chips');
      (r.stages || []).forEach(function (s) {
        var chip = el('span', 'chip' + (s.name === currentName ? ' current' : '') + (s.gateWaiting ? ' gate' : ''));
        chip.append(el('span', 'dot'));
        chip.style.setProperty('--c', C[s.status] || C.pending);
        chip.querySelector('.dot').style.background = C[s.status] || C.pending;
        chip.append(s.name + '·' + (s.gateWaiting ? '人审中' : (L[s.status] || s.status)));
        chips.append(chip);
      });
      card.append(chips);
      var meta = el('div', 'meta');
      var bits = [];
      if (r.gitBranch) bits.push('分支：' + r.gitBranch);
      if (r.projectRoot) bits.push(r.projectRoot);
      bits.push('始于 ' + (r.startedAt || '?'));
      meta.append(bits.join(' · '));
      meta.append(el('div', 'runid', r.statePath));
      card.append(meta);
    } else {
      card.append(el('div', 'reason', r.degraded || '状态不可读'));
      card.append(el('div', 'meta', '始于 ' + (r.startedAt || '?')));
    }
    list.append(card);
  });
})();
</script>
</body>
</html>
`;
}

function main() {
  const indexPath = path.join(home, 'index.json');
  let map;
  try {
    map = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') map = {};
    else return fail(`index.json 解析失败（${indexPath}）：${e.message}`);
  }
  const runs = Object.entries(map)
    .map(([runId, entry]) => summarize(runId, entry))
    .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
  const snap = {
    source: indexPath,
    generatedAt: new Date().toISOString(),
    meta: { label: STATUS_LABEL, color: STATUS_COLOR },
    runs,
  };
  try {
    fs.writeFileSync(out, render(snap));
  } catch (e) {
    return fail(`写盘失败（${out}）：${e.message}`);
  }
  process.stdout.write(`${JSON.stringify({
    runs: runs.length,
    total: runs.length,
    degraded: runs.filter((r) => !r.readable).length,
    generatedAt: snap.generatedAt,
    out,
  }, null, 2)}\n`);
}

main();
