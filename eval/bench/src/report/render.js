'use strict';
// 报告单向渲染（issue #94 报告层重构）：metrics/*.json → 核心集报告（card / summary）。
// 渲染器不改数据、不做聚合判断；固定声明（小样本/诚实边界/token 口径）唯一事实源 = 本文件
// declarationsFor(n)（FR-6 文案单源：cli.js 与 forms.js 一律引用，不得内嵌副本）。
// 平台形式（sheet/wechat/xiaohongshu）的模板与渲染器归属 forms.js + atom-tasks/report-<form>/
// （FR-2 模板随任务走）；本目录 templates/ 仅保留核心集模板。

const fs = require('node:fs');
const path = require('node:path');

const TEMPLATES_DIR = path.join(__dirname, 'templates');

const HONESTY = '> **诚实边界**：Ddo-Code-Flow 不适用于过于简单的任务。单点、低风险、裸模型一把梭即可正确的任务，工作流引入开销，结果不升甚至略降——此为预期结论，如实记录，不包装为正向增益。';
const TOKEN_CALIBER = '> **token 口径**：仅用于同模型 A/B 对照，跨模型不可比；ddo 更高是预期代价，重点看代价是否换来收益；缓存命中抬高名义 token（已标注缓存量）；流式响应可能漏记（漏记行单列，不代入合计）。';

/** 小样本声明（题数参数化，issue #94 DEC-6：删除「2–3 题」硬编码）。 */
const smallSampleDecl = (n) => `> ⚠️ **小样本声明**：${n} 题小样本，体感参考，不代表全面测评。`;

/** 固定声明三段，一切报告形式的唯一来源（forms.js 平台物料同样引用）。 */
function declarationsFor(n) {
  return [smallSampleDecl(n), HONESTY, TOKEN_CALIBER].join('\n>\n').replace(/^>/, '>');
}

const fill = (tpl, ctx) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in ctx ? String(ctx[k]) : `{{${k}}}`));
const loadTpl = (name) => fs.readFileSync(path.join(TEMPLATES_DIR, name), 'utf8');
const fmtK = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

/**
 * 预期行为对照（issue #94 DEC-5：card 结论区改对照表，报告止于数据）。
 * 机械查表（渲染层不做判断）：behavior 关键词 → 过程信号；命中取该臂 binary（有/无/n/a），
 * 未命中如实标注无对应信号。映射规则单一声明于此，任务与文档引用不复制。
 */
const BEHAVIOR_SIGNAL_MAP = [
  [/checklist|对照/, '先对齐再动手'],
  [/运行|自检|截图/, '交付前自检'],
  [/假设|澄清/, '模糊处停下来'],
  [/仅限|白名单|相关实现/, '改动范围受控'],
  [/阶段验证|验证记录/, '阶段纪律'],
];

function behaviorsTable({ expectedBehaviors, process }) {
  const signals = (process && process.signals) || [];
  const cell = (signalName, arm) => {
    const sig = signals.find((s) => s.signal === signalName);
    const row = sig && sig.rows.find((r) => r.arm === arm);
    if (!row) return '—';
    return row.binary === null ? 'n/a' : row.binary ? '有' : '无';
  };
  const header = '| 预期行为（qpack.meta.expectedBehaviors） | 纯 prompt | + Ddo |\n|---|---|---|';
  if (!expectedBehaviors || !expectedBehaviors.length) {
    return `${header}\n| —（qpack 未登记 expectedBehaviors） | — | — |`;
  }
  const rows = expectedBehaviors.map((b) => {
    const hit = BEHAVIOR_SIGNAL_MAP.find(([re]) => re.test(b));
    if (!hit) return `| ${b} | —（无对应信号） | —（无对应信号） |`;
    return `| ${b} | ${cell(hit[1], 'baseline')} | ${cell(hit[1], 'ddo')} |`;
  });
  return [header, ...rows].join('\n');
}

/** 每题卡片（markdown）。输入：{model, qName, qTitle, form, result, process, token, armReportDirs, expectedBehaviors, taskCount} */
function renderCard({ model, qName, qTitle, result, process, token, form, armReportDirs, expectedBehaviors, taskCount }) {
  // 直观区
  const visual = form === 'page'
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
  if (form === 'page') {
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

  const md = fill(loadTpl('card.md.tmpl'), {
    title: `${model} · ${qTitle || qName}`,
    visual, quant, tokenLine,
    behaviors: behaviorsTable({ expectedBehaviors, process }),
    declarations: declarationsFor(taskCount),
  });
  return md;
}

/** 汇总页（markdown，DEC-8 平铺表按题序）。输入：{model, cards: [{qName,form,track,result,tokenLineShort}], symmetry, dryRun, taskCount} */
function renderSummary({ model, cards, dryRun, taskCount }) {
  const tableRows = cards.map((c) => {
    const delta = c.result && c.result.delta && c.result.delta.结果层 ? c.result.delta.结果层 : '（结果层关闭）';
    return `| ${c.qName} | ${c.form} | ${c.track || '—'} | ${delta} | ${c.tokenLineShort || ''} |`;
  }).join('\n');
  const sym = cards.every((c) => !c.symmetry || c.symmetry.includes('一致'))
    ? '一致（两臂应答均可追溯同一冻结清单或显式标注回退）'
    : '存在不一致——见各题 process.json 明细';
  const md = fill(loadTpl('summary.md.tmpl'), {
    model,
    tableRows,
    symmetry: sym,
    dryRunNote: dryRun ? '> 本轮为 **dry-run**（stub 会话）：数字为链路自验用模拟值，不代表模型表现。\n' : '',
    declarations: declarationsFor(taskCount),
  });
  return md;
}

/** chromium 截图导出（playwright 可用时；bundled 缺失回退本机 Chrome 通道；再失败返回 { skipped }）。
 *  viewport：{width, height?}；fullPage=true 全页高；clip：{x,y,width,height} 分段切片（F2 长图分段用）。
 *  全程限时 EXPORT_TIMEOUT_MS（含浏览器启动与截图——浏览器/CDP 挂起时降级 skipped，不阻塞任务）；
 *  环境变量 BENCH_SKIP_PNG=1 直接跳过（单测用，PNG 由 dry-run 手工链路验证覆盖）。 */
const EXPORT_TIMEOUT_MS = 30_000;
const withTimeout = (p, ms, label) => Promise.race([
  p,
  new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} 超时 ${ms}ms`)), ms)),
]);

/** 关闭浏览器（限时尽力而为：CDP 楔死时 close 本身可能挂起，不阻塞调用方）。 */
const closeBrowser = (browser) => (browser ? withTimeout(browser.close(), 3000, 'browser.close').catch(() => {}) : Promise.resolve());

/** viewport 归一化：height 缺省补 720（playwright 要求整数；fullPage 截图不受视口高影响）。 */
const normViewport = (viewport) => ({
  width: (viewport && viewport.width) || 1080,
  height: (viewport && viewport.height) || 720,
});

async function launchBrowser() {
  const { chromium } = require('playwright');
  try {
    return await chromium.launch();
  } catch (e0) {
    return chromium.launch({ channel: 'chrome' });
  }
}

async function exportPng(htmlPath, pngPath, viewport, { fullPage = false, clip = null } = {}) {
  if (process.env.BENCH_SKIP_PNG === '1') return { skipped: true, reason: 'env BENCH_SKIP_PNG=1（单测跳过 PNG）' };
  let browser = null;
  try {
    const work = (async () => {
      browser = await launchBrowser();
      const page = await browser.newPage({ viewport: normViewport(viewport) });
      await page.goto('file://' + path.resolve(htmlPath));
      await page.waitForTimeout(500);
      await page.screenshot({ path: pngPath, fullPage: fullPage || viewport == null, clip: clip || undefined });
    })();
    await withTimeout(work, EXPORT_TIMEOUT_MS, 'exportPng');
    await closeBrowser(browser);
    return { ok: true, pngPath };
  } catch (e) {
    await closeBrowser(browser);
    return { skipped: true, reason: String((e && e.message) || e) };
  }
}

/** 测量 HTML 渲染后全页高度（F2 分段预算用；失败或超时返回 null——调用方按单图回退）。 */
async function measurePageHeight(htmlPath, viewport) {
  if (process.env.BENCH_SKIP_PNG === '1') return null;
  let browser = null;
  try {
    const work = (async () => {
      browser = await launchBrowser();
      const page = await browser.newPage({ viewport: normViewport(viewport) });
      await page.goto('file://' + path.resolve(htmlPath));
      await page.waitForTimeout(300);
      return page.evaluate(() => document.documentElement.scrollHeight);
    })();
    const h = await withTimeout(work, EXPORT_TIMEOUT_MS, 'measurePageHeight');
    await closeBrowser(browser);
    return h;
  } catch (e) {
    await closeBrowser(browser);
    return null;
  }
}

module.exports = { renderCard, renderSummary, declarationsFor, exportPng, measurePageHeight, fmtK, launchBrowser };
