'use strict';
// 平台形式注册表与渲染器（issue #94 FR-2/FR-3，F1–F3；#100 跟进定位重构：
// 主体 = 被测模型能力，Ddo-Code-Flow = 评测方法/出发点；文案与量化口径自 report-brief + 轮次指标）。
// 渲染只经 cli.js report 子命令调用（确定性内核，agent 不手填模板）：
//   输入 = 轮次工作区数据（round.json + metrics/*.json + qpack + shots，口径见 docs/report-contract.md）
//         + 对齐稿 report-brief.json（主体/读者/核心问题，见 docs/report-brief 说明）；
//   输出 = publishDir/report-<form>/ 下产物清单 { outputs[], skipped, notes[] }。
// 不变式：不读题面以外信息做推断；不新造结论性文案；固定声明一律引用 render.js declarationsFor(n)；
//         平台文案唯一来源 = wechatCopyFor/noteBodyFor（审阅底稿附录A 与渲染器共用，防两处漂移）。

const fs = require('node:fs');
const path = require('node:path');
const { declarationsFor, exportPng, measurePageHeight } = require('./render');

const REPO_ROOT = path.join(__dirname, '..', '..', '..', '..'); // eval/bench/src/report → 仓库根

/** 形式注册表（单一来源）：--form 校验、任务命名 report-<form>、模板目录解析共用。 */
const FORMS = ['draft', 'sheet', 'wechat', 'xiaohongshu'];

/** 设计令牌（report-design.md §2）：暗底点阵 + 青绿主强调 + 品红状态色；描边扁平，无阴影无渐变。 */
const DNA = {
  bg: '#0A0D0F', panel: '#14171C', panelDeep: '#1E2530', line: '#2A3138',
  ink: '#F5F7F8', body: '#C9D1D5', dim: '#8A949C', faint: '#5C6670',
  teal: '#5EEAD4', tealTint: '#0E2622', tealLine: '#2A5B50',
  pink: '#F472B6', pinkTint: '#241322', pinkLine: '#6E2F4C',
  dotGrid: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
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

/** 复制页面题两臂截图/GIF 到形式目录（分臂自包含相对引用）。返回 { baseline: {name→路径}, ddo: {...} }。 */
function copyArmShots({ formDir, qName, armShotsDirs }) {
  const map = { baseline: {}, ddo: {} };
  for (const arm of ['baseline', 'ddo']) {
    const src = armShotsDirs && armShotsDirs[arm];
    if (!src || !fs.existsSync(src)) continue;
    for (const e of fs.readdirSync(src)) {
      if (!e.endsWith('.png') && !e.endsWith('.gif')) continue;
      const targetDir = path.join(formDir, 'shots', qName, arm);
      fs.mkdirSync(targetDir, { recursive: true });
      fs.copyFileSync(path.join(src, e), path.join(targetDir, e));
      map[arm][e.replace(/\.(png|gif)$/, '')] = rel(path.join('shots', qName, arm, e));
    }
  }
  return map;
}

const shotLabel = { initial: '01 · 初始视图', rotated: '02 · 拖拽旋转后', narrow: '03 · 窄屏 375px' };

/* ---------------------- 平台文案单源（渲染器与审阅底稿附录A 共用） ---------------------- */

/** 公众号文案（封面/正文标题摘要）。主体=模型，工作流=方法（report-brief 定位）。 */
function wechatCopyFor(q, round) {
  return {
    title: truncate(`${round.modelLabel} 实测：${shortTitle(q.title)}`, 30), // 建议 ≤30（平台硬限 64）
    subtitle: truncate(`同一模型两臂对照，唯一变量是过程方法（自由发挥 / Ddo-Code-Flow）；结果层 ${q.baselineRate} → ${q.ddoRate}`, 120),
  };
}

/** 小红书 note 文案（标题 ≤20 硬限；正文 ≤1000；标签固定池子集）。 */
const XHS_TAG_POOL = ['#AI评测', '#模型实测', '#前端开发', '#AB对照', '#程序员', '#DdoCodeFlow'];
function noteBodyFor(q, round) {
  const title = shortTitle(q.title); // 硬限 ≤20 字；优先剥括注，仍超限才截断
  const tags = XHS_TAG_POOL.slice(0, 4);
  const t = trendOf(q.delta);
  const deltaLine = `${q.delta || '（结果层关闭）'}${t ? ` ${t.glyph}` : ''}`;
  const body = [
    `${title}`,
    '',
    `${round.modelLabel} 同模型两臂实测：唯一变量是过程方法——一臂自由发挥，一臂走 Ddo-Code-Flow 工作流。`,
    `结果层：纯 prompt ${q.baselineRate} → + 流程 ${q.ddoRate}（Δ ${deltaLine}）。`,
    `token（同模型内对照）：${q.tokenShort || '本轮未采集'}。`,
    `打分标准与逐项数据见末页；小样本体感参考，不代表全面测评；过于简单的任务无收益或负增益（预期结论，如实记录）。`,
    `完整判定层数据见核心集报告（card/summary）与审阅底稿（report-draft）。`,
    '',
    tags.join(' '),
  ].join('\n');
  return { title, body, truncated: /[…]$/.test(title) };
}

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
    const t = trendOf(q.delta);
    const subtotalsLine = (q.subtotals || []).map((s) => `${s.cat} ${s.b}→${s.d}`).join(' · ');
    blocks.push([
      `<section style="margin:34px 0 12px;font-family:${DNA.mono};font-size:20px;color:${DNA.teal};">${q.qName} <span style="font-family:${DNA.sans};font-size:15px;color:${DNA.dim};">（${q.baselineRate} → ${q.ddoRate}${t ? ` <b style="color:${t.color};">${t.glyph}</b>` : ''}）</span></section>`,
      subtotalsLine ? `<section style="margin:0 0 10px;font-family:${DNA.mono};font-size:13px;color:${DNA.dim};">${subtotalsLine}</section>` : '',
      `<section style="display:flex;gap:16px;">`,
      armCol('baseline', '纯 prompt'),
      armCol('ddo', '+ Ddo-Code-Flow'),
      `</section>`,
    ].filter(Boolean).join('\n'));
  }
  const html = fill(loadFormTpl('sheet', 'sheet.html.tmpl'), {
    title: `${round.modelLabel} · 交付能力快览（${round.taskCount} 题小样本 A/B）`,
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

  // 轮级封面（2.35:1，900×383，粘贴安全）：主体 = 模型；多题时以副标注明详情见正文
  {
    const first = pageQs[0];
    const coverTitle = truncate(`${round.modelLabel} 交付能力实测`, 30);
    const coverSub = pageQs.length > 1
      ? truncate(`${pageQs.length} 道页面题 · 同模型两臂 · 唯一变量是过程方法；各题读数见正文`, 120)
      : truncate(`「${shortTitle(first.title)}」· 同模型两臂，唯一变量是过程方法（自由发挥 / Ddo-Code-Flow）`, 120);
    const coverHtml = fill(loadFormTpl('wechat', 'cover.html.tmpl'), {
      title: coverTitle, subtitle: coverSub,
      baselineRate: first ? first.baselineRate : '—', ddoRate: first ? first.ddoRate : '—',
      rateNote: pageQs.length > 1 ? '首页题读数' : '结果层达标', brand: DNA.brand,
    });
    const coverPath = path.join(formDir, 'cover-round.html');
    fs.writeFileSync(coverPath, coverHtml);
    outputs.push('report-wechat/cover-round.html');
    const coverPng = await exportPng(coverPath, path.join(formDir, 'cover-round.png'), { width: 900, height: 383 });
    if (coverPng.skipped) notes.push(`cover-round.png 导出跳过：${coverPng.reason}`);
    else { pngAny = true; outputs.push('report-wechat/cover-round.png'); }
  }

  for (const q of pageQs) {
    const shots = copyArmShots({ formDir, qName: q.qName, armShotsDirs: q.armShotsDirs });
    const { title, subtitle } = wechatCopyFor(q, round);

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
    const gifNote = (shots.baseline.demo || shots.ddo.demo)
      ? `<p style="margin:14px 0;font-size:13px;color:${DNA.dim};text-align:center;"><span leaf="">◆ 交付动图（demo.gif）随物料一并导出，公众号编辑时以动图上传替换占位帧</span></p>` : '';
    const rateCard = (arm, rate, label) => {
      const a = armAccent(arm);
      return `<section style="flex:1;text-align:center;padding:20px 0;background:${a.bg};border:1px solid ${a.border};border-radius:12px;"><p style="margin:0;font-size:34px;font-weight:800;color:${a.color};"><span leaf="">${rate}</span></p><p style="margin:6px 0 0;font-size:14px;color:${DNA.dim};"><span leaf="">${label}</span></p></section>`;
    };
    const t = trendOf(q.delta);
    const dataCards = [
      `<section style="display:flex;gap:16px;margin:22px 0;">`,
      rateCard('baseline', q.baselineRate, '纯 prompt 结果层'),
      rateCard('ddo', q.ddoRate, '+ Ddo 达标（Δ ' + (q.delta || '—') + (t ? ` ${t.glyph}` : '') + '）'),
      `</section>`,
    ].join('\n');
    // 分类小计（粘贴安全：section+p 内联）
    const subtotalBlock = (q.subtotals || []).length ? [
      `<p style="margin:24px 0 8px;font-size:14px;font-weight:700;color:${DNA.teal};"><span leaf="">分类小计（逐项探针按前缀聚合）</span></p>`,
      ...(q.subtotals.map((s) => `<p style="margin:0 0 6px;font-size:13px;color:${DNA.body};"><span leaf=""><span leaf="" style="font-family:${DNA.mono};color:${DNA.dim};">${s.cat} ${s.label}</span>　${s.b} → ${s.d}</span></p>`)),
    ].join('\n') : '';
    const ynTxt = (v) => (v === true ? '✓' : v === false ? '✗' : '—');
    const processBlock = (q.processRows || []).length ? [
      `<p style="margin:24px 0 8px;font-size:14px;font-weight:700;color:${DNA.teal};"><span leaf="">过程信号</span></p>`,
      ...(q.processRows.map((r) => `<p style="margin:0 0 6px;font-size:13px;color:${DNA.body};"><span leaf="">${r.signal}：纯 prompt ${ynTxt(r.b)} · + 流程 ${ynTxt(r.d)}</span></p>`)),
    ].join('\n') : '';
    const tf = q.tokenFull || {};
    const kfmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : '—');
    const costBlock = [
      `<p style="margin:24px 0 8px;font-size:14px;font-weight:700;color:${DNA.teal};"><span leaf="">成本（同模型内对照）</span></p>`,
      `<p style="margin:0 0 6px;font-size:13px;color:${DNA.body};"><span leaf="">调用 ${kfmt(tf.b && tf.b.calls)} → ${kfmt(tf.d && tf.d.calls)} · total ${kfmt(tf.b && tf.b.total)} → ${kfmt(tf.d && tf.d.total)}${q.tokenRatio ? `（${q.tokenRatio}）` : ''}</span></p>`,
      `<p style="margin:0 0 6px;font-size:13px;color:${DNA.body};"><span leaf="">cache 命中 ${kfmt(tf.b && tf.b.cache)} → ${kfmt(tf.d && tf.d.cache)}</span></p>`,
    ].join('\n');
    const declText = declarationsFor(round.taskCount).replace(/^>\s*/gm, '').replace(/\*\*/g, '');
    const declBlock = `<section style="margin:28px 0 0;padding:16px 18px;background:${DNA.panel};border:1px solid ${DNA.line};border-left:4px solid ${DNA.pink};border-radius:10px;"><p style="margin:0 0 6px;font-size:13px;font-weight:700;color:${DNA.pink};"><span leaf="">◆ 口径与边界（打分标准见审阅底稿）</span></p><p style="margin:0;font-size:12px;line-height:1.9;color:${DNA.body};"><span leaf="">${declText}</span></p></section>`;
    const footBlock = `<p style="margin:24px 0 0;padding-top:14px;border-top:1px solid ${DNA.line};font-size:12px;color:${DNA.faint};"><span leaf="">评测方法：Ddo-Code-Flow 工作流 · ${DNA.brand} · ${round.roundId}</span></p>`;
    const articleHtml = fill(loadFormTpl('wechat', 'article.html.tmpl'), {
      title, subtitle, dataCards, subtotalBlock, processBlock, costBlock, imageBlocks: imgPairs, gifNote,
      declarationsBlock: declBlock, footerBlock: footBlock,
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

async function renderXiaohongshu({ round, pageQs, formDir }) {
  const outputs = []; const notes = []; let pngAny = false;
  const emit = async (name, ctx) => {
    const no = String(++pageNo).padStart(2, '0');
    const html = fill(loadFormTpl('xiaohongshu', `${name}.html.tmpl`), { ...ctx, no, kicker: `${no}${ctx.kickerLabel}` });
    const htmlPath = path.join(formDir, `xhs-${no}-${name}.html`);
    fs.writeFileSync(htmlPath, html);
    outputs.push(`report-xiaohongshu/xhs-${no}-${name}.html`);
    const r = await exportPng(htmlPath, htmlPath.replace(/\.html$/, '.png'), { width: 1080, height: 1440 });
    if (r.skipped) notes.push(`xhs-${no}-${name}.png 导出跳过：${r.reason}`);
    else pngAny = true;
    return r.skipped ? null : `xhs-${no}-${name}.png`;
  };
  let pageNo = 0;

  // 轮级封面（主体 = 模型能力）
  {
    const qLines = pageQs.map((q) => {
      const t = trendOf(q.delta);
      return `<div class="qline"><span class="qn">${q.qName}</span><span class="qr">${q.baselineRate} → <b style="color:${t ? t.color : DNA.body};">${q.ddoRate}${t ? ` ${t.glyph}` : ''}</b></span></div>`;
    }).join('\n');
    await emit('cover', {
      kickerLabel: ' / MODEL EVAL',
      title: truncate(`${round.modelLabel} 交付能力实测`, 14),
      subLine: `${round.taskCount} 道题 · 同模型两臂 · 唯一变量是过程方法`,
      hook1: '同一道题，同一个模型，跑两遍', hook2: '一臂自由发挥，一臂走结构化流程', hook3: '结果 / 过程 / 成本，三个切面看能力',
      qLines: qLines || '<div class="qline"><span class="qn">本轮无页面题</span></div>',
      brand: DNA.brand, roundTag: round.roundId,
    });
  }

  for (const q of pageQs) {
    const shots = copyArmShots({ formDir, qName: q.qName, armShotsDirs: q.armShotsDirs });
    const { title: noteTitle, body: noteBody, truncated } = noteBodyFor(q, round);
    if (truncated) notes.push(`note-${q.qName} 标题剥括注后仍超 20 字硬限，确定性截断`);

    const shotSrc = (arm, slot) => shots[arm].demo || shots[arm][slot] || '';
    const winBlock = (arm, slot) => {
      const src = shotSrc(arm, slot);
      if (!src) return '';
      const isGif = src.endsWith('.gif');
      return `<div class="win"><div class="bar"><i></i><i></i><i></i><span class="url">${q.qName}/${arm}/${isGif ? 'demo.gif' : `${slot}.png`}</span></div><img src="${src}" alt="${arm} ${slot}"></div>`;
    };
    const t = trendOf(q.delta);
    // 语义色（report-design.md：✓ 青绿 / ✗ 品红 / — 中性）——F3 process 页两臂对照符号
    const ynC = (v) => (v === true ? `<b style="color:${DNA.teal};">✓</b>` : v === false ? `<b style="color:${DNA.pink};">✗</b>` : `<span style="color:${DNA.faint};">—</span>`);
    const specRow = (label, value, trend) => `<div class="row"><span class="k">${label}</span><span class="v">${value}${trend ? `&nbsp;<b style="color:${trend.color};">${trend.glyph}</b>` : ''}</span></div>`;
    const catRow = (s) => {
      const ct = trendOf(`${s.b} → ${s.d}`); // 分类行方向符：与 Δ 同一算术推导，不新造结论
      return `<div class="row"><span class="k">${s.cat} · ${s.label}</span><span class="v">${s.b} → ${s.d}${ct ? `&nbsp;<b style="color:${ct.color};">${ct.glyph}</b>` : ''}</span></div>`;
    };
    const kfmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : '—');
    const tf = q.tokenFull || {};

    await emit('compare', {
      kickerLabel: ' / DELIVERABLES', title: noteTitle, subtitle: '同一道题，两臂交付对照（动图）',
      winBaseline1: winBlock('baseline', 'initial'), winBaseline2: winBlock('baseline', 'rotated'),
      winDdo1: winBlock('ddo', 'initial'), winDdo2: winBlock('ddo', 'rotated'),
      baselineRate: q.baselineRate, ddoRate: q.ddoRate, brand: DNA.brand, roundTag: round.roundId,
    });
    await emit('results', {
      kickerLabel: ' / RESULTS', title: noteTitle, baselineRate: q.baselineRate, ddoRate: q.ddoRate,
      deltaMini: q.delta ? (t ? `<span style="color:${t.color};">Δ ${q.delta} ${t.glyph}</span>` : `Δ ${q.delta}`) : '',
      deltaRow: specRow('Δ 结果层', q.delta || '（结果层关闭）', t),
      catRows: (q.subtotals || []).map(catRow).join('\n') || specRow('分类小计', '无逐项数据', null),
      brand: DNA.brand, roundTag: round.roundId,
    });
    await emit('process', {
      kickerLabel: ' / PROCESS & COST', title: noteTitle,
      signalRows: (q.processRows || []).map((r) => specRow(`信号 · ${r.signal}`, `${ynC(r.b)} → ${ynC(r.d)}`, null)).join('\n')
        || specRow('过程信号', '本轮未采集', null),
      tokenRows: [
        specRow('调用次数', `${kfmt(tf.b && tf.b.calls)} → ${kfmt(tf.d && tf.d.calls)}`, null),
        specRow('input tokens', `${kfmt(tf.b && tf.b.input)} → ${kfmt(tf.d && tf.d.input)}`, null),
        specRow('output tokens', `${kfmt(tf.b && tf.b.output)} → ${kfmt(tf.d && tf.d.output)}`, null),
        specRow('total（纯 prompt → + 流程）', `${q.tokenB || '—'} → ${q.tokenD || '—'}`, null),
        specRow('倍率（ddo ÷ 基线 total）', q.tokenRatio || '—', null),
        specRow('cache 命中', `${kfmt(tf.b && tf.b.cache)} → ${kfmt(tf.d && tf.d.cache)}`, null),
      ].join('\n'),
      brand: DNA.brand, roundTag: round.roundId,
    });

    // 文字包（标题 ≤20 硬限；正文 ≤1000；标签 3–6，固定池取子集）
    const notePath = path.join(formDir, `note-${q.qName}.md`);
    fs.writeFileSync(notePath, truncate(noteBody, 1000));
    outputs.push(`report-xiaohongshu/note-${q.qName}.md`);
  }

  // 轮级打分标准与口径（收尾页：进度点）
  {
    await emit('rubric', {
      kickerLabel: ' / RUBRIC', title: '怎么评的：打分标准与口径',
      rubricLines: [
        '<p><i>◆</i>判定单元 = 逐项探针（自动读 DOM/场景实况），两臂同一判据</p>',
        '<p><i>◆</i>分类：A 结构 · B 光照 · C 相机 · D 动画 · E 文案 · F 参考分层 · G 画质 · H 交互 · I 读数</p>',
        '<p><i>◆</i>参考分层：题库 golden 样例（reference 全过 / flawed 缺陷对照）锚定判据</p>',
        '<p><i>◆</i>不加权、不折总分；Δ 按题按指标呈现；结果层关闭如实标注</p>',
        '<p><i>◆</i>过程信号与 token 为同模型内对照（方法：Ddo-Code-Flow 工作流）</p>',
      ].join('\n'),
      declarations: declarationsFor(round.taskCount).replace(/^>\s*/gm, '').replace(/\*\*/g, ''),
      brand: DNA.brand, roundTag: round.roundId,
    });
  }
  if (!pageQs.length) notes.push('本轮无页面题：未产出物料（如实留痕）');
  return { outputs, skipped: !pngAny, notes };
}

/** 分发入口：cli.js report 子命令调用。pageQs = 页面题 ctx 列表（rates/token/逐项/过程/shots 等）。 */
async function renderForm({ form, round, brief, pageQs, publishDir }) {
  const formDir = path.join(publishDir, `report-${form}`);
  fs.mkdirSync(formDir, { recursive: true });
  if (form === 'draft') {
    const { renderDraftForm } = require('./draft');
    return renderDraftForm({ round, brief, pageQs, formDir });
  }
  const renderer = { sheet: renderSheet, wechat: renderWechat, xiaohongshu: renderXiaohongshu }[form];
  return renderer({ round, brief, pageQs, formDir });
}

module.exports = {
  FORMS, renderForm, DNA, truncate, shortTitle, trendOf, copyArmShots,
  wechatCopyFor, noteBodyFor, XHS_TAG_POOL,
};
