'use strict';
// 审阅底稿（issue #100 跟进）：平台物料渲染前的「真实报告」md，供人工审阅与对齐。
// 结构：对齐摘要 → 轮次概览 → 每题完整数据（逐项探针/分类小计/过程信号/Token 全量）→
//       样式对照 → 打分标准 → 附录A 平台文案（与渲染器同源逐字）→ 附录B 平台呈现说明。
// 不变式：不新造结论性文案；声明一律引 render.js declarationsFor(n)；附录A 文案从 forms.js 单源取。

const fs = require('node:fs');
const path = require('node:path');
const { declarationsFor } = require('./render');
const { wechatCopyFor, noteBodyFor, copyArmShots, trendOf } = require('./forms');

/** 探针项 id 前缀 → 分类名（打分标准的分类层；未知前缀归「其他」）。 */
const CATEGORY_NAMES = {
  A: '结构与场景', B: '光照与材质', C: '相机与响应式', D: '动画',
  E: '文案与图例', F: '参考分层', G: '画质与后处理', H: '交互', I: '读数',
};

const catOf = (id) => CATEGORY_NAMES[String(id).trim()[0].toUpperCase()] || '其他';

/** 两臂逐项 checks → 分类小计行 [{cat, label, b, d}]（按首个出现顺序）。 */
function subtotalsOf(checks) {
  const b = checks.baseline || []; const d = checks.ddo || [];
  const ids = [...new Set([...b, ...d].map((c) => String(c.id).trim()[0].toUpperCase()))]
    .sort();
  return ids.map((p) => {
    const inCat = (arr) => arr.filter((c) => String(c.id).trim()[0].toUpperCase() === p);
    const bc = inCat(b); const dc = inCat(d);
    const fmt = (arr, all) => `${all ? arr.filter((c) => c.pass).length : '—'}/${arr.length || '—'}`;
    return { cat: p, label: catOf(p), b: fmt(bc, true), d: fmt(dc, true) };
  });
}

/** process.json signals → 行 [{signal, b, d, detail}]（detail 摘两臂 metrics 键值）。 */
function processRowsOf(processJson) {
  return (processJson.signals || []).map((s) => {
    const row = (arm) => s.rows.find((r) => r.arm === arm) || {};
    const detail = (r) => Object.entries(r.metrics || {}).map(([k, v]) => `${k}=${v}`).join(' · ')
      + (r.negative ? `；负向{${Object.entries(r.negative).map(([k, v]) => `${k}=${v}`).join(' · ')}}` : '');
    return { signal: s.signal, b: row('baseline').binary, d: row('ddo').binary, detail: `${detail(row('baseline'))} ｜ ${detail(row('ddo'))}` };
  });
}

const yn = (v) => (v === true ? '✓' : v === false ? '✗' : '—');
const kfmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : '—');

/** 渲染审阅底稿 md。ctx = { round, brief, pageQs, created }。 */
function renderDraft({ round, brief, pageQs }) {
  const L = [];
  L.push(`# 模型快速评测 · 审阅底稿 · ${round.roundId}`, '',
    '> 本稿是平台物料的上游审阅件：先审改对齐（report-brief.json）与本稿文案，再渲染平台形式。',
    `> 生成入口：\`cli.js report --form draft --round ${round.roundId}\`（确定性重渲染，幂等）`, '');

  L.push('## 0 对齐摘要（report-brief）', '',
    `- 主体：${brief.subject === 'model' ? '被测模型能力（工作流 = 评测方法/出发点）' : '工作流收益（模型 = 载体）'}`,
    `- 视角：${brief.angle}`, `- 读者：${brief.audience}`,
    `- 核心问题：${brief.coreQuestion}`, `- 基调：${brief.tone}`, '');

  L.push('## 1 轮次概览', '',
    `| 项 | 值 |`, `| --- | --- |`,
    `| 模型 | ${round.modelLabel} |`,
    `| 题数 | ${round.taskCount}（页面题 ${pageQs.length}） |`,
    `| 轮次 | ${round.roundId}${round.dryRun ? ' · dry-run' : ''} |`, '');

  for (const q of pageQs) {
    const t = trendOf(q.delta);
    L.push(`## 2 ${q.qName} · ${q.title}`, '',
      `结果层：纯 prompt **${q.baselineRate}** · + Ddo **${q.ddoRate}** · Δ \`${q.delta || '（结果层关闭）'}\` ${t ? t.glyph : ''}`, '',
      `FPS（探针实测）：${q.fps && q.fps.baseline} / ${q.fps && q.fps.ddo}`, '');

    const byId = (arr) => new Map((arr || []).map((c) => [String(c.id), c]));
    const bMap = byId(q.checks && q.checks.baseline); const dMap = byId(q.checks && q.checks.ddo);
    const ids = [...new Set([...(q.checks ? q.checks.baseline : []), ...(q.checks ? q.checks.ddo : [])].map((c) => String(c.id)))];
    L.push('### 逐项探针', '', '| # | 分类 | 判据（expected） | 纯 prompt | + Ddo | 实测（未过侧摘录） |', '| --- | --- | --- | --- | --- | --- |');
    for (const id of ids) {
      const bc = bMap.get(id); const dc = dMap.get(id);
      const loser = bc && dc ? (!bc.pass ? bc : !dc.pass ? dc : null) : (bc || dc);
      L.push(`| ${id} | ${catOf(id)} | ${((bc || dc) || {}).expected || ''} | ${yn(bc && bc.pass)} | ${yn(dc && dc.pass)} | ${loser && !loser.pass ? String(loser.actual).slice(0, 80) : ''} |`);
    }
    L.push('');

    L.push('### 分类小计', '', '| 类 | 分类 | 纯 prompt | + Ddo |', '| --- | --- | --- | --- |',
      ...q.subtotals.map((s) => `| ${s.cat} | ${s.label} | ${s.b} | ${s.d} |`), '');

    L.push('### 过程信号', '', '| 信号 | 纯 prompt | + Ddo | 明细（两臂） |', '| --- | --- | --- | --- |',
      ...q.processRows.map((r) => `| ${r.signal} | ${yn(r.b)} | ${yn(r.d)} | ${r.detail} |`), '');

    const tf = q.tokenFull || {};
    L.push('### Token 与调用（同模型内对照）', '', '| 指标 | 纯 prompt | + Ddo |', '| --- | --- | --- |',
      `| 调用次数 | ${kfmt(tf.b && tf.b.calls)} | ${kfmt(tf.d && tf.d.calls)} |`,
      `| input | ${kfmt(tf.b && tf.b.input)} | ${kfmt(tf.d && tf.d.input)} |`,
      `| output | ${kfmt(tf.b && tf.b.output)} | ${kfmt(tf.d && tf.d.output)} |`,
      `| total | ${kfmt(tf.b && tf.b.total)} | ${kfmt(tf.d && tf.d.total)} |`,
      `| cache 命中 | ${kfmt(tf.b && tf.b.cache)} | ${kfmt(tf.d && tf.d.cache)} |`,
      `| 倍率（ddo ÷ 基线 total） | — | ${q.tokenRatio || '—'} |`, '');

    L.push('### 样式对照（截图/GIF，相对 report-draft/）', '');
    for (const arm of ['baseline', 'ddo']) {
      L.push(`- ${arm === 'baseline' ? '纯 prompt' : '+ Ddo'}：`);
      for (const n of ['initial', 'rotated', 'narrow']) {
        if (q.shotRel && q.shotRel[arm][n]) L.push(`  - ${n}: ${q.shotRel[arm][n]}`);
      }
      if (q.shotRel && q.shotRel[arm].demo) L.push(`  - GIF: ${q.shotRel[arm].demo}（发布时以动图上传）`);
    }
    L.push('');
  }

  L.push('## 3 打分标准（怎么评的）', '',
    '- 判定单元 = 探针项（每题逐项 id，自动读 DOM/场景实况，expected 即判据；两臂同一探针同一判据）。',
    `- 分类体系（id 前缀）：${Object.entries(CATEGORY_NAMES).map(([k, v]) => `${k}=${v}`).join('；')}。`,
    '- 参考分层：题库 golden 样例分 reference（全过基准）与 flawed（缺陷对照），探针在两臂交付上执行同一判据；分层说明见各题 acceptance/CHECKS.md。',
    '- 口径：不加权、不折总分；Δ 按题按指标呈现；结果层关闭或探针跳过时如实标注；小样本声明见文末。', '',
    declarationsFor(round.taskCount), '');

  L.push('## 附录A 平台文案（与渲染器同源，逐字）', '');
  for (const q of pageQs) {
    const note = noteBodyFor(q, round);
    L.push(`### 小红书 note（${q.qName}；标题 ≤20 字硬限；正文 ≤1000 字；标签 3–6）`, '', '```', note.body, '```', '');
    const wc = wechatCopyFor(q, round);
    L.push(`### 公众号 cover/article（${q.qName}）`, '', '- 标题：', '```', wc.title, '```', '- 摘要：', '```', wc.subtitle, '```', '');
  }

  L.push('## 附录B 各平台呈现说明', '',
    '- F1 sheet（1080 宽快览 PNG）：轮级头（模型主题）→ 每题双臂截图列（initial/rotated/narrow）→ 分类小计 → 声明卡。存档/快速翻阅用。',
    '- F2 wechat（封面 900×383 + 正文长图 900 宽）：封面为轮级模型主题；正文含结果层双卡、分类小计、过程与成本段、截图/GIF 对照、声明卡。粘贴安全（全内联、`<span leaf>`、无样式表）；GIF 在公众号编辑器以动图上传后替换占位图。',
    '- F3 xiaohongshu（3:4 1080×1440 图组）：01 轮级封面（模型能力主题）→ 每题 02 交付对照（GIF/截图）→ 03 结果层全景（分类小计）→ 04 过程与成本 → 末页打分标准与口径（进度点收尾）。发布注意：标题 ≤20 字；GIF 在小红书部分端转静态，建议 GIF 与关键帧 PNG 都入素材库；判定层以核心集报告（card/summary）为准。', '');

  return L.join('\n');
}

const q0 = (pageQs) => pageQs[0];

/** draft 形式渲染入口（cli.js renderForm 分发）。截图/GIF 复制进 report-draft/shots 自包含引用。 */
async function renderDraftForm({ round, brief, pageQs, formDir }) {
  for (const q of pageQs) q.shotRel = copyArmShots({ formDir, qName: q.qName, armShotsDirs: q.armShotsDirs });
  const md = renderDraft({ round, brief, pageQs });
  const name = `draft-${round.roundId}.md`;
  fs.mkdirSync(formDir, { recursive: true });
  fs.writeFileSync(path.join(formDir, name), md);
  return { outputs: [`report-draft/${name}`], skipped: false, notes: [`审阅底稿：${path.join(formDir, name)}`] };
}

module.exports = { CATEGORY_NAMES, catOf, subtotalsOf, processRowsOf, renderDraft, renderDraftForm };
