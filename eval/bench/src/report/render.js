'use strict';
// 报告单向渲染（plan Part 04 §2，DEC-7/DEC-9）：metrics/*.json → 各报告形式。
// 形式注册表（profile.reports ⊆ 此表）：card / sheet / summary / wechat / xiaohongshu。
// 渲染器不改数据、不做聚合判断；小样本与诚实边界声明为一切形式的固定段（FR-12 结构化保证）。

const fs = require('node:fs');
const path = require('node:path');

const TEMPLATES_DIR = path.join(__dirname, 'templates');

const SMALL_SAMPLE = '> ⚠️ **小样本声明**：2–3 题小样本，体感参考，不代表全面测评。';
const HONESTY = '> **诚实边界**：Ddo-Code-Flow 不适用于过于简单的任务。单点、低风险、裸模型一把梭即可正确的任务，工作流引入开销，结果不升甚至略降——此为预期结论，如实记录，不包装为正向增益。';
const TOKEN_CALIBERS = [
  '> **token 口径**：仅用于同模型 A/B 对照，跨模型不可比；ddo 更高是预期代价，重点看代价是否换来收益；缓存命中抬高名义 token（已标注缓存量）；流式响应可能漏记（漏记行单列，不代入合计）。',
];
const DECLARATIONS = [SMALL_SAMPLE, HONESTY, ...TOKEN_CALIBERS].join('\n>\n').replace(/^>/, '>');

const fill = (tpl, ctx) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in ctx ? String(ctx[k]) : `{{${k}}}`));
const loadTpl = (name) => fs.readFileSync(path.join(TEMPLATES_DIR, name), 'utf8');
const fmtK = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

/** 每题卡片（markdown）。输入：{model, qName, qTitle, result, process, token, kind, reportDir} */
function renderCard({ model, qName, qTitle, result, process, token, kind, armReportDirs }) {
  // 直观区
  const visual = kind === 'page'
    ? [
      '### 直观区（初始 / 拖拽旋转 / 窄屏 / 两帧差分，两臂对照）',
      '',
      '| 视角 | 纯 prompt | + Ddo |',
      '|---|---|---|',
      '| 初始 | ![](baseline/shots/initial.png) | ![](ddo/shots/initial.png) |',
      '| 旋转 | ![](baseline/shots/rotated.png) | ![](ddo/shots/rotated.png) |',
      '| 窄屏 375px | ![](baseline/shots/narrow.png) | ![](ddo/shots/narrow.png) |',
      '| 两帧差分 | ![](baseline/shots/frame-a.png)→![](baseline/shots/frame-b.png) | ![](ddo/shots/frame-a.png)→![](ddo/shots/frame-b.png) |',
    ].join('\n')
    : ['### 直观区（产物清单）', '', `- baseline：见 ${armReportDirs.baseline}`, `- ddo：见 ${armReportDirs.ddo}`].join('\n');

  // 量化区
  const rows = [];
  const rb = result.baseline; const rd = result.ddo;
  if (kind === 'page') {
    rows.push(`| 规格达标项 | ${rb.ok ? `${rb.pass}/${rb.total}` : '失败'} | ${rd.ok ? `${rd.pass}/${rd.total}` : '失败'} |`);
    const bFps = rb.ok ? rb.fps : '-'; const dFps = rd.ok ? rd.fps : '-';
    rows.push(`| 帧率（参考档） | ${bFps} | ${dFps} |`);
  } else {
    rows.push(`| 验收用例通过 | ${rb.ok ? rb.acceptance : '失败'} | ${rd.ok ? rd.acceptance : '失败'} |`);
    rows.push(`| 回归测试通过 | ${rb.ok ? rb.regression : '失败'} | ${rd.ok ? rd.regression : '失败'} |`);
    rows.push(`| 改动文件数 | ${rb.ok ? rb.changedFiles : '-'} | ${rd.ok ? rd.changedFiles : '-'} |`);
    rows.push(`| 越界改动文件数 | ${rb.ok ? rb.outOfScopeFiles : '-'} | ${rd.ok ? rd.outOfScopeFiles : '-'} |`);
  }
  for (const sig of (process && process.signals) || []) {
    if (sig.signal === '澄清对称性') continue; // 有效性自检，入汇总页
    const b = sig.rows.find((r) => r.arm === 'baseline');
    const d = sig.rows.find((r) => r.arm === 'ddo');
    const cell = (r) => r == null ? '—' : `${r.binary === null ? 'n/a' : r.binary ? '有' : '无'}${r.negative && Object.values(r.negative)[0] > 0 ? `（负面计数 ${JSON.stringify(r.negative)}）` : ''}`;
    rows.push(`| 过程·${sig.signal} | ${cell(b)} | ${cell(d)} |`);
  }
  const quant = ['', '| 指标 | 纯 prompt | + Ddo |', '|---|---|---|', ...rows].join('\n');

  // token 行
  const g = (key) => (token.groups || []).find((x) => x.key === key) || {};
  const bt = g('baseline'); const dt = g('ddo');
  const ratio = bt.total_tokens > 0 && dt.total_tokens > 0 ? `（×${(dt.total_tokens / bt.total_tokens).toFixed(1)}）` : '';
  const tokenLine = `**token 合计**：纯 prompt ${fmtK(bt.total_tokens || 0)} · + Ddo ${fmtK(dt.total_tokens || 0)}${ratio}${token.simulated ? '（dry-run 模拟值）' : ''}`;

  const conclusion = [
    `**结论（模板初稿，可人工改写）**：${result.delta.结果层}。`,
    (process && process.signals || []).some((s) => s.rows.some((r) => r.negative && Object.values(r.negative)[0] > 0 && r.arm === 'baseline'))
      ? 'baseline 侧存在负面计数（口头声称/越界/未处理歧义），见量化区标注。' : '',
    '负增益与无差异为如实记录（判定规则见 docs/rubric.md：不做加权总分、不合成性价比分数）。',
  ].filter(Boolean).join(' ');

  const md = fill(loadTpl('card.md.tmpl'), {
    title: `${model} · ${qTitle || qName}`,
    visual, quant, tokenLine, conclusion, declarations: DECLARATIONS,
  });
  return md;
}

/** 汇总页（markdown）。输入：{model, cards: [{qName,qTitle,kind,result,token}], symmetry, dryRun} */
function renderSummary({ model, cards, dryRun }) {
  const col = (kind) => {
    const hit = cards.filter((c) => (kind === 'page' ? c.kind === 'page' : c.kind !== 'page' && c.lineHint === kind));
    if (!hit.length) return '_本轮无此类题_';
    return hit.map((c) => `- ${c.qName}：${c.result.delta.结果层}${c.tokenLineShort || ''}`).join('\n');
  };
  const sym = cards.every((c) => !c.symmetry || c.symmetry.includes('一致'))
    ? '一致（两臂应答均可追溯同一冻结清单或显式标注回退）'
    : '存在不一致——见各题 process.json 明细';
  const md = fill(loadTpl('summary.md.tmpl'), {
    model,
    pageCol: col('page'), designCol: col('design'), execCol: col('execute'),
    symmetry: sym,
    dryRunNote: dryRun ? '> 本轮为 **dry-run**（stub 会话）：数字为链路自验用模拟值，不代表模型表现。\n' : '',
    declarations: DECLARATIONS,
  });
  return md;
}

/** HTML 形式（sheet / wechat / xiaohongshu）：占位替换 + 可选 chromium 导出 PNG。 */
function renderHtmlForm({ form, ctx }) {
  const file = { sheet: 'sheet.html.tmpl', wechat: 'wechat-longform.html.tmpl', xiaohongshu: 'xiaohongshu-card.html.tmpl' }[form];
  return fill(loadTpl(file), ctx);
}

/** chromium 截图导出（playwright 可用时；bundled 缺失回退本机 Chrome 通道；再失败返回 { skipped }）。 */
async function exportPng(htmlPath, pngPath, viewport) {
  try {
    const { chromium } = require('playwright');
    let browser;
    try {
      browser = await chromium.launch();
    } catch (e0) {
      browser = await chromium.launch({ channel: 'chrome' });
    }
    const page = await browser.newPage({ viewport });
    await page.goto('file://' + path.resolve(htmlPath));
    await page.waitForTimeout(500);
    await page.screenshot({ path: pngPath, fullPage: viewport == null });
    await browser.close();
    return { ok: true, pngPath };
  } catch (e) {
    return { skipped: true, reason: String((e && e.message) || e) };
  }
}

module.exports = { renderCard, renderSummary, renderHtmlForm, exportPng, DECLARATIONS, fmtK };
