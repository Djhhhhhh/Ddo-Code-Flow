'use strict';
// 平台形式注册表与渲染器（issue #94 FR-2/FR-3，F1–F3；plan rev 2 采纳 gzh-design-skill 粘贴安全
// 规范与 ian-xhs-carousel 母版原则——仅参考原则，模板全部自写，不复制外部组件库）。
// 渲染只经 cli.js report 子命令调用（确定性内核，agent 不手填模板）：
//   输入 = 轮次工作区数据（round.json + metrics/*.json + qpack + shots，口径见 docs/report-contract.md）；
//   输出 = publishDir/report-<form>/ 下产物清单 { outputs[], skipped, notes[] }。
// 不变式：不读题面以外信息做推断；不新造结论性文案；固定声明一律引用 render.js declarationsFor(n)。

const fs = require('node:fs');
const path = require('node:path');
const { declarationsFor, exportPng, measurePageHeight } = require('./render');

const REPO_ROOT = path.join(__dirname, '..', '..', '..', '..'); // eval/bench/src/report → 仓库根

/** 形式注册表（单一来源）：--form 校验、任务命名 report-<form>、模板目录解析共用。 */
const FORMS = ['sheet', 'wechat', 'xiaohongshu'];

/** 设计变量（F2/F3 共用，gzh-design-skill 配色结构的本仓落地）：灰阶承重 + 单主色锚点。 */
const INK = {
  gray900: '#111827', gray600: '#4B5563', gray500: '#6B7280', gray400: '#9CA6AF',
  bgSoft: '#F8FAFC', line: '#E2E8F0', primary: '#2563EB', primarySoft: '#DBEAFE', primaryTint: '#EFF6FF',
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

const shotLabel = { initial: '初始视图', rotated: '拖拽旋转后', narrow: '窄屏 375px' };

/* ---------------------------------- F1 sheet ---------------------------------- */

async function renderSheet({ round, pageQs, formDir }) {
  const notes = [];
  const blocks = [];
  for (const q of pageQs) {
    const shots = copyArmShots({ formDir, qName: q.qName, armShotsDirs: q.armShotsDirs });
    const shotCell = (arm) => ['initial', 'rotated', 'narrow']
      .map((n) => (shots[arm][n] ? `<img src="${shots[arm][n]}" style="width:100%;border:1px solid ${arm === 'ddo' ? INK.primarySoft : INK.line};border-radius:10px;margin:6px 0;">` : ''))
      .join('');
    blocks.push([
      `<section style="margin:26px 0 10px;font-size:22px;font-weight:700;color:${INK.gray900};">${q.qName} <span style="font-size:16px;font-weight:400;color:${INK.gray500};">（规格达标 ${q.baselineRate} → ${q.ddoRate}）</span></section>`,
      `<section style="display:flex;gap:16px;">`,
      `<section style="flex:1;text-align:center;"><span style="display:inline-block;padding:3px 14px;border-radius:999px;margin-bottom:6px;font-size:14px;background:${INK.bgSoft};color:${INK.gray600};">纯 prompt</span>${shotCell('baseline')}</section>`,
      `<section style="flex:1;text-align:center;"><span style="display:inline-block;padding:3px 14px;border-radius:999px;margin-bottom:6px;font-size:14px;background:${INK.primaryTint};color:${INK.primary};">+ Ddo-Code-Flow</span>${shotCell('ddo')}</section>`,
      `</section>`,
    ].join('\n'));
  }
  const html = fill(loadFormTpl('sheet', 'sheet.html.tmpl'), {
    title: `${round.modelLabel} · 快览对比（${round.taskCount} 题小样本 A/B）`,
    grid: blocks.join('\n') || '<p style="color:#9CA6AF;">本轮无页面题</p>',
    declarations: declarationsFor(round.taskCount).replace(/^>\s*/gm, '').replace(/\*\*/g, ''),
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
    const title = truncate(`${q.title}：同模型 A/B 对照`, 30); // 建议 ≤30（平台硬限 64）
    const subtitle = truncate(`同一模型，唯一变量是否走 Ddo-Code-Flow 工作流；规格达标 ${q.baselineRate} → ${q.ddoRate}`, 120);

    // 封面（2.35:1，900×383，粘贴安全）
    const coverHtml = fill(loadFormTpl('wechat', 'cover.html.tmpl'), {
      title, subtitle, baselineRate: q.baselineRate, ddoRate: q.ddoRate,
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
      return [
        `<p style="margin:18px 0 6px;font-size:16px;font-weight:700;color:${INK.gray900};"><span leaf="">${shotLabel[n]}</span></p>`,
        `<section style="display:flex;gap:12px;">`,
        `<section style="flex:1;">${b ? `<img src="${b}" style="width:100%;border:1px solid ${INK.line};border-radius:10px;">` : ''}<p style="margin:4px 0 0;font-size:13px;color:${INK.gray500};text-align:center;"><span leaf="">纯 prompt</span></p></section>`,
        `<section style="flex:1;">${d ? `<img src="${d}" style="width:100%;border:1px solid ${INK.primarySoft};border-radius:10px;">` : ''}<p style="margin:4px 0 0;font-size:13px;color:${INK.primary};text-align:center;"><span leaf="">+ Ddo-Code-Flow</span></p></section>`,
        `</section>`,
      ].join('\n');
    }).filter(Boolean).join('\n');
    const dataCards = [
      `<section style="display:flex;gap:16px;margin:22px 0;">`,
      `<section style="flex:1;text-align:center;padding:18px 0;background:${INK.bgSoft};border:1px solid ${INK.line};border-radius:12px;"><p style="margin:0;font-size:34px;font-weight:800;color:${INK.gray900};"><span leaf="">${q.baselineRate}</span></p><p style="margin:4px 0 0;font-size:14px;color:${INK.gray500};"><span leaf="">纯 prompt 达标</span></p></section>`,
      `<section style="flex:1;text-align:center;padding:18px 0;background:${INK.primaryTint};border:1px solid ${INK.primarySoft};border-radius:12px;"><p style="margin:0;font-size:34px;font-weight:800;color:${INK.primary};"><span leaf="">${q.ddoRate}</span></p><p style="margin:4px 0 0;font-size:14px;color:${INK.gray500};"><span leaf="">+ Ddo 达标</span></p></section>`,
      `</section>`,
      `<p style="margin:12px 0;font-size:15px;color:${INK.gray600};text-align:center;"><span leaf="">token（同模型内对照）：${q.tokenShort || '本轮未采集'}</span></p>`,
    ].join('\n');
    const declText = declarationsFor(round.taskCount).replace(/^>\s*/gm, '').replace(/\*\*/g, '');
    const declBlock = `<section style="margin:26px 0 0;padding:14px 16px;background:#FFF7E6;border-left:4px solid #F59E0B;border-radius:8px;"><p style="margin:0;font-size:12px;line-height:1.7;color:#78350F;"><span leaf="">${declText}</span></p></section>`;
    const articleHtml = fill(loadFormTpl('wechat', 'article.html.tmpl'), {
      title, subtitle, dataCards, imageBlocks: imgPairs, declarationsBlock: declBlock,
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
    const noteTitle = truncate(q.title, 20); // 硬限 ≤20 字
    if ([...String(q.title)].length > 20) notes.push(`note-${q.qName} 标题超 20 字硬限，确定性截断`);

    const pages = [
      { name: 'cover', ctx: {
        title: noteTitle,
        hook1: `${round.taskCount} 道题 × 同一个模型`, hook2: 'A/B 只差一个工作流', hook3: '数字在下面，判断留给你',
        baselineRate: q.baselineRate, ddoRate: q.ddoRate, footer: `同模型 A/B · ${round.modelLabel}` } },
      { name: 'compare', ctx: {
        title: noteTitle, subtitle: '同一道题，两臂交付对照',
        imgBaseline: shots.baseline.initial || '', imgDdo: shots.ddo.initial || '' } },
      { name: 'quant', ctx: {
        title: noteTitle, baselineRate: q.baselineRate, ddoRate: q.ddoRate,
        tokenLine: q.tokenShort || '本轮未采集 token', deltaLine: q.delta || '（结果层关闭）' } },
      { name: 'decl', ctx: {
        title: '数据口径与边界',
        declarations: declarationsFor(round.taskCount).replace(/^>\s*/gm, '').replace(/\*\*/g, '') } },
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
      `小样本体感参考，不代表全面测评；过于简单的任务无收益或负收益（预期结论，如实记录）。`,
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
