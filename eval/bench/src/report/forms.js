'use strict';
// 平台形式注册表与渲染器（issue #94 FR-2/FR-3，F1–F3；plan rev 2 采纳 gzh-design-skill 粘贴安全
// 规范与 ian-xhs-carousel 母版原则——仅参考原则，模板全部自写，不复制外部组件库）。
// 渲染只经 cli.js report 子命令调用（确定性内核，agent 不手填模板）：
//   输入 = 轮次工作区数据（round.json + metrics/*.json + qpack + shots，口径见 docs/report-contract.md）；
//   输出 = publishDir/report-<form>/ 下产物清单 { outputs[], skipped, notes[] }。
// 不变式：不读题面以外信息做推断；不新造结论性文案；固定声明一律引用 render.js declarationsFor(n)。
// 视觉令牌唯一来源 = DNA（规格与依据见 docs/report-design.md；改风格先改该文档再改此处）。

const fs = require('node:fs');
const path = require('node:path');
const { declarationsFor, exportPng, measurePageHeight } = require('./render');

const REPO_ROOT = path.join(__dirname, '..', '..', '..', '..'); // eval/bench/src/report → 仓库根

/** 形式注册表（单一来源）：--form 校验、任务命名 report-<form>、模板目录解析共用。 */
const FORMS = ['sheet', 'wechat', 'xiaohongshu'];

/** 设计令牌（report-design.md §2）：暗底点阵 + 青绿主强调 + 品红状态色；描边扁平，无阴影无渐变。 */
const DNA = {
  bg: '#0A0D0F', panel: '#14171C', panelDeep: '#1E2530', line: '#2A3138',
  ink: '#F5F7F8', body: '#C9D1D5', dim: '#8A949C', faint: '#5C6670',
  teal: '#5EEAD4', tealTint: '#0E2622', tealLine: '#2A5B50',
  pink: '#F472B6', pinkTint: '#241322', pinkLine: '#6E2F4C',
  dotGrid: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
  sans: "system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif",
  mono: "'SF Mono',ui-monospace,Menlo,Consolas,monospace",
  brand: 'Ddo-Code-Flow · MIT · ddoai.cn',
};
/** 臂角色（report-design.md §2 角色语义）：baseline 中性 / ddo 主色强调；身份永有文字标签。 */
const armAccent = (arm) => (arm === 'ddo'
  ? { color: DNA.teal, border: DNA.tealLine, bg: DNA.tealTint }
  : { color: DNA.ink, border: DNA.line, bg: DNA.panelDeep });
const trendOf = (deltaText) => { // 只编码已有数字（算术推导），不新造结论
  const nums = String(deltaText).match(/(\d+)\s*\/\s*(\d+)/g) || [];
  if (nums.length < 2) return null;
  const rate = (s) => { const m = s.match(/(\d+)\/(\d+)/); return Number(m[1]) / Number(m[2]); };
  const a = rate(nums[0]); const b = rate(nums[1]);
  if (b > a) return { glyph: '▲', color: DNA.teal };
  if (b < a) return { glyph: '▼', color: DNA.pink };
  return { glyph: '◆', color: DNA.dim };
};
const fill = (tpl, ctx) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in ctx ? String(ctx[k]) : `{{${k}}}`));
const loadFormTpl = (form, name) => {
  const p = path.join(REPO_ROOT, 'atom-tasks', `report-${form}`, 'templates', name);
  return fs.readFileSync(p, 'utf8'); // 模板缺失 → 抛错（report 子命令转 exit 1）
};
const rel = (p) => p.split(path.sep).join('/');

/** 确定性截断（字数硬限用；截断事实由调用方记 notes）。 */
function truncate(text, max) {
  const s = String(text);
  if ([...s].length <= max) return s;
  return `${[...s].slice(0, Math.max(0, max - 1)).join('')}…`;
}

/** 展示用短标题：先剥尾部括注限定语（如「（Three.js 页面样式题）」），仍超限才确定性截断。 */
function shortTitle(t) {
  const bare = String(t).replace(/[（(][^）)]*[）)]\s*$/, '').trim();
  return truncate(bare || String(t), 20);
}

/** 复制页面题两臂截图到形式目录（分臂自包含相对引用）。返回 { baseline: {name→路径}, ddo: {...} }。 */
function copyArmShots({ formDir, qName, armShotsDirs }) {
  const map = { baseline: {}, ddo: {} };
  for (const arm of ['baseline', 'ddo']) {
    const src = armShotsDirs && armShotsDirs[arm];
    if (!src || !fs.existsSync(src)) continue;
    for (const e of fs.readdirSync(src)) {
      if (!e.endsWith('.png')) continue;
      const targetDir = path.join(formDir, 'shots', qName, arm);
      fs.mkdirSync(targetDir, { recursive: true });
      fs.copyFileSync(path.join(src, e), path.join(targetDir, e));
      map[arm][e.replace(/\.png$/, '')] = rel(path.join('shots', qName, arm, e));
    }
  }
  return map;
}

const shotLabel = { initial: '01 · 初始视图', rotated: '02 · 拖拽旋转后', narrow: '03 · 窄屏 375px' };

/* ---------------------------------- F1 sheet ---------------------------------- */

async function renderSheet({ round, pageQs, formDir }) {
  const notes = [];
  const blocks = [];
  for (const q of pageQs) {
    const shots = copyArmShots({ formDir, qName: q.qName, armShotsDirs: q.armShotsDirs });
    const shotCell = (arm) => ['initial', 'rotated', 'narrow']
      .map((n) => (shots[arm][n] ? `<img src="${shots[arm][n]}" style="width:100%;display:block;border:1px solid ${armAccent(arm).border};border-radius:10px;margin:8px 0;">` : ''))
      .join('');
    const armCol = (arm, label) => {
      const a = armAccent(arm);
      return `<section style="flex:1;"><span style="display:inline-block;padding:4px 16px;border-radius:999px;margin-bottom:8px;font-size:14px;background:${a.bg};color:${a.color};border:1px solid ${a.border};">${label}</span>${shotCell(arm)}</section>`;
    };
    blocks.push([
      `<section style="margin:34px 0 12px;font-family:${DNA.mono};font-size:20px;color:${DNA.teal};">${q.qName} <span style="font-family:${DNA.sans};font-size:15px;color:${DNA.dim};">（规格达标 ${q.baselineRate} → ${q.ddoRate}）</span></section>`,
      `<section style="display:flex;gap:16px;">`,
      armCol('baseline', '纯 prompt'),
      armCol('ddo', '+ Ddo-Code-Flow'),
      `</section>`,
    ].join('\n'));
  }
  const html = fill(loadFormTpl('sheet', 'sheet.html.tmpl'), {
    title: `${round.modelLabel} · 快览对比（${round.taskCount} 题小样本 A/B）`,
    grid: blocks.join('\n') || `<p style="color:${DNA.dim};">本轮无页面题</p>`,
    declarations: declarationsFor(round.taskCount).replace(/^>\s*/gm, '').replace(/\*\*/g, ''),
    brand: DNA.brand, roundTag: round.roundId,
  });
  const outputs = [];
  const htmlPath = path.join(formDir, 'sheet.html');
  fs.writeFileSync(htmlPath, html);
  outputs.push('report-sheet/sheet.html');
  const png = await exportPng(htmlPath, path.join(formDir, 'sheet.png'), { width: 1080 }, { fullPage: true });
  if (png.skipped) { notes.push(`sheet.png 导出跳过：${png.reason}`); return { outputs, skipped: true, notes }; }
  outputs.push('report-sheet/sheet.png');
  return { outputs, skipped: false, notes };
}

/* ---------------------------------- F2 wechat ---------------------------------- */

async function renderWechat({ round, pageQs, formDir }) {
  const outputs = []; const notes = []; let pngAny = false;
  for (const q of pageQs) {
    const shots = copyArmShots({ formDir, qName: q.qName, armShotsDirs: q.armShotsDirs });
    const title = truncate(`${shortTitle(q.title)}：同模型 A/B 对照`, 30); // 建议 ≤30（平台硬限 64）
    const subtitle = truncate(`同一模型，唯一变量是否走 Ddo-Code-Flow 工作流；规格达标 ${q.baselineRate} → ${q.ddoRate}`, 120);

    // 封面（2.35:1，900×383，粘贴安全）
    const coverHtml = fill(loadFormTpl('wechat', 'cover.html.tmpl'), {
      title, subtitle, baselineRate: q.baselineRate, ddoRate: q.ddoRate, brand: DNA.brand,
    });
    const coverPath = path.join(formDir, `cover-${q.qName}.html`);
    fs.writeFileSync(coverPath, coverHtml);
    outputs.push(`report-wechat/cover-${q.qName}.html`);
    const coverPng = await exportPng(coverPath, path.join(formDir, `cover-${q.qName}.png`), { width: 900, height: 383 });
    if (coverPng.skipped) notes.push(`cover-${q.qName}.png 导出跳过：${coverPng.reason}`);
    else { pngAny = true; outputs.push(`report-wechat/cover-${q.qName}.png`); }

    // 正文长图（内容宽 900，粘贴安全；>600 万像素自动分段）
    const imgPairs = ['initial', 'rotated', 'narrow'].map((n) => {
      const b = shots.baseline[n]; const d = shots.ddo[n];
      if (!b && !d) return '';
      const shotRow = (arm, src, label) => {
        const a = armAccent(arm);
        return `<section style="flex:1;">${src ? `<img src="${src}" style="width:100%;display:block;border:1px solid ${a.border};border-radius:10px;">` : ''}<p style="margin:6px 0 0;font-size:13px;color:${a.color === DNA.teal ? DNA.teal : DNA.dim};text-align:center;"><span leaf="">${label}</span></p></section>`;
      };
      return [
        `<p style="margin:20px 0 8px;font-size:14px;font-weight:700;color:${DNA.teal};"><span leaf="">${shotLabel[n]}</span></p>`,
        `<section style="display:flex;gap:12px;">`,
        shotRow('baseline', b, '纯 prompt'),
        shotRow('ddo', d, '+ Ddo-Code-Flow'),
        `</section>`,
      ].join('\n');
    }).filter(Boolean).join('\n');
    const rateCard = (arm, rate, label) => {
      const a = armAccent(arm);
      return `<section style="flex:1;text-align:center;padding:20px 0;background:${a.bg};border:1px solid ${a.border};border-radius:12px;"><p style="margin:0;font-size:34px;font-weight:800;color:${a.color};"><span leaf="">${rate}</span></p><p style="margin:6px 0 0;font-size:14px;color:${DNA.dim};"><span leaf="">${label}</span></p></section>`;
    };
    const dataCards = [
      `<section style="display:flex;gap:16px;margin:22px 0;">`,
      rateCard('baseline', q.baselineRate, '纯 prompt 达标'),
      rateCard('ddo', q.ddoRate, '+ Ddo 达标'),
      `</section>`,
      `<p style="margin:12px 0;font-size:15px;color:${DNA.dim};text-align:center;"><span leaf="">token（同模型内对照）：${q.tokenShort || '本轮未采集'}</span></p>`,
    ].join('\n');
    const declText = declarationsFor(round.taskCount).replace(/^>\s*/gm, '').replace(/\*\*/g, '');
    const declBlock = `<section style="margin:28px 0 0;padding:16px 18px;background:${DNA.panel};border:1px solid ${DNA.line};border-left:4px solid ${DNA.pink};border-radius:10px;"><p style="margin:0 0 6px;font-size:13px;font-weight:700;color:${DNA.pink};"><span leaf="">◆ 口径与边界</span></p><p style="margin:0;font-size:12px;line-height:1.9;color:${DNA.body};"><span leaf="">${declText}</span></p></section>`;
    const footBlock = `<p style="margin:24px 0 0;padding-top:14px;border-top:1px solid ${DNA.line};font-size:12px;color:${DNA.faint};"><span leaf="">${DNA.brand} · ${round.roundId}</span></p>`;
    const articleHtml = fill(loadFormTpl('wechat', 'article.html.tmpl'), {
      title, subtitle, dataCards, imageBlocks: imgPairs, declarationsBlock: declBlock, footerBlock: footBlock,
    });
    const articlePath = path.join(formDir, `article-${q.qName}.html`);
    fs.writeFileSync(articlePath, articleHtml);
    outputs.push(`report-wechat/article-${q.qName}.html`);

    const PIXEL_BUDGET = 6_000_000; const W = 900;
    const h = await measurePageHeight(articlePath, { width: W });
    if (h != null && W * h > PIXEL_BUDGET) {
      const partH = Math.floor(PIXEL_BUDGET / W); // 6666
      const parts = Math.ceil(h / partH);
      for (let i = 0; i < parts; i++) {
        const clip = { x: 0, y: i * partH, width: W, height: Math.min(partH, h - i * partH) };
        const r = await exportPng(articlePath, path.join(formDir, `article-${q.qName}-part${i + 1}.png`), { width: W, height: Math.min(partH, h) }, { fullPage: true, clip });
        if (r.skipped) notes.push(`article-${q.qName}-part${i + 1}.png 导出跳过：${r.reason}`);
        else { pngAny = true; outputs.push(`report-wechat/article-${q.qName}-part${i + 1}.png`); }
      }
      notes.push(`article-${q.qName} 长图 ${W}×${h} 超过 600 万像素，分 ${parts} 段导出`);
    } else {
      const r = await exportPng(articlePath, path.join(formDir, `article-${q.qName}.png`), { width: W }, { fullPage: true });
      if (r.skipped) notes.push(`article-${q.qName}.png 导出跳过：${r.reason}`);
      else { pngAny = true; outputs.push(`report-wechat/article-${q.qName}.png`); }
    }
  }
  if (!pageQs.length) notes.push('本轮无页面题：未产出物料（如实留痕）');
  return { outputs, skipped: !pngAny, notes };
}

/* ---------------------------------- F3 xiaohongshu ---------------------------------- */

const XHS_TAG_POOL = ['#AI评测', '#工作流', '#模型评测', '#AB对照', '#程序员', '#DdoCodeFlow'];

async function renderXiaohongshu({ round, pageQs, formDir }) {
  const outputs = []; const notes = []; let pngAny = false;
  for (const q of pageQs) {
    const shots = copyArmShots({ formDir, qName: q.qName, armShotsDirs: q.armShotsDirs });
    const noteTitle = shortTitle(q.title); // 硬限 ≤20 字；优先剥括注，仍超限才截断
    if (/[…]$/.test(noteTitle)) notes.push(`note-${q.qName} 标题剥括注后仍超 20 字硬限，确定性截断`);

    const winBlock = (arm, slot) => {
      const src = shots[arm][slot];
      if (!src) return '';
      return `<div class="win"><div class="bar"><i></i><i></i><i></i><span class="url">${q.qName}/${arm}/${slot}.png</span></div><img src="${src}" alt="${arm} ${slot}"></div>`;
    };
    const specRow = (label, value, trend) => `<div class="row"><span class="k">${label}</span><span class="v">${value}${trend ? `&nbsp;<b style="color:${trend.color};">${trend.glyph}</b>` : ''}</span></div>`;

    const pages = [
      { name: 'cover', ctx: {
        kicker: '01 / A-B TEST', title: noteTitle,
        subLine: `${round.taskCount} 道题 × ${round.modelLabel} · 唯一变量是一个工作流`,
        hook1: '同一道题，同一模型，跑两遍', hook2: '一臂纯 prompt，一臂走 Ddo-Code-Flow', hook3: '数字在下面，判断留给你',
        baselineRate: q.baselineRate, ddoRate: q.ddoRate,
        brand: DNA.brand, roundTag: round.roundId } },
      { name: 'compare', ctx: {
        kicker: '02 / DELIVERABLES', title: noteTitle, subtitle: '同一道题，两臂交付对照',
        winBaseline1: winBlock('baseline', 'initial'), winBaseline2: winBlock('baseline', 'rotated'),
        winDdo1: winBlock('ddo', 'initial'), winDdo2: winBlock('ddo', 'rotated'),
        baselineRate: q.baselineRate, ddoRate: q.ddoRate,
        brand: DNA.brand, roundTag: round.roundId } },
      { name: 'quant', ctx: {
        kicker: '03 / NUMBERS', title: noteTitle, baselineRate: q.baselineRate, ddoRate: q.ddoRate,
        deltaRow: specRow('Δ 结果层', q.delta || '（结果层关闭）', trendOf(q.delta)),
        tokenRow: specRow('token · 纯 prompt', q.tokenB || '本轮未采集', null),
        tokenRow2: specRow('token · + Ddo-Code-Flow', q.tokenD || '本轮未采集', null),
        tokenRow3: specRow('token · 倍率（ddo ÷ 基线）', q.tokenRatio || '—', null),
        brand: DNA.brand, roundTag: round.roundId } },
      { name: 'decl', ctx: {
        kicker: '04 / FINE PRINT', title: '数据口径与边界',
        declarations: declarationsFor(round.taskCount).replace(/^>\s*/gm, '').replace(/\*\*/g, ''),
        brand: DNA.brand, roundTag: round.roundId } },
    ];
    for (let i = 0; i < pages.length; i++) {
      const pg = pages[i];
      const html = fill(loadFormTpl('xiaohongshu', `${pg.name}.html.tmpl`), pg.ctx);
      const htmlPath = path.join(formDir, `xhs-${q.qName}-${i + 1}-${pg.name}.html`);
      fs.writeFileSync(htmlPath, html);
      outputs.push(`report-xiaohongshu/xhs-${q.qName}-${i + 1}-${pg.name}.html`);
      const r = await exportPng(htmlPath, htmlPath.replace(/\.html$/, '.png'), { width: 1080, height: 1440 });
      if (r.skipped) notes.push(`xhs-${q.qName}-${i + 1}-${pg.name}.png 导出跳过：${r.reason}`);
      else { pngAny = true; outputs.push(`report-xiaohongshu/xhs-${q.qName}-${i + 1}-${pg.name}.png`); }
    }

    // 文字包（标题 ≤20 硬限；正文 ≤1000；标签 3–6，固定池取子集）
    const tags = XHS_TAG_POOL.slice(0, 4);
    const body = [
      `${noteTitle}`,
      '',
      `同一模型 A/B 对照：唯一变量是是否走 Ddo-Code-Flow 工作流。`,
      `规格达标：纯 prompt ${q.baselineRate} → + Ddo ${q.ddoRate}。`,
      `token（同模型内对照）：${q.tokenShort || '本轮未采集'}。`,
      `小样本体感参考，不代表全面测评；过于简单的任务无收益或负增益（预期结论，如实记录）。`,
      `完整判定层数据见汇总页（card/summary 为核心集报告）。`,
      '',
      tags.join(' '),
    ].join('\n');
    const notePath = path.join(formDir, `note-${q.qName}.md`);
    fs.writeFileSync(notePath, truncate(body, 1000));
    outputs.push(`report-xiaohongshu/note-${q.qName}.md`);
  }
  if (!pageQs.length) notes.push('本轮无页面题：未产出物料（如实留痕）');
  return { outputs, skipped: !pngAny, notes };
}

/** 分发入口：cli.js report 子命令调用。pageQs = 页面题 ctx 列表（title/rates/token/shotsDir/delta）。 */
async function renderForm({ form, round, pageQs, publishDir }) {
  const formDir = path.join(publishDir, `report-${form}`);
  fs.mkdirSync(formDir, { recursive: true });
  const renderer = { sheet: renderSheet, wechat: renderWechat, xiaohongshu: renderXiaohongshu }[form];
  return renderer({ round, pageQs, formDir });
}

module.exports = { FORMS, renderForm };
