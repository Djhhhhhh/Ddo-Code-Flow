'use strict';
// 报告对齐稿（issue #100 跟进：生成报告前先对齐「主体/客体/读者/核心问题」）。
// 单一来源：默认稿由轮次数据推导；用户可在确认门修改 runs/<rid>/report-brief.json 后重跑。
// 渲染器（forms.js/draft.js）只消费本文件 normalizeBrief() 的字段，不内嵌定位文案副本。

const fs = require('node:fs');
const path = require('node:path');

/** 主体枚举：model=被测模型能力为主体（工作流是方法）；workflow=工作流收益为主体。 */
const SUBJECTS = ['model', 'workflow'];

/** 从轮次数据推导默认对齐稿。round = { roundId, modelLabel, taskCount, pageQCount }。 */
function defaultBrief(round) {
  const model = round.modelLabel || '本地缺省模型';
  return {
    version: 1,
    subject: 'model',
    modelLabel: model,
    angle: '同一模型在两种过程约束下的交付对照：自由发挥 vs 结构化流程（Ddo-Code-Flow）',
    audience: '关注模型实测能力的开发者',
    coreQuestion: `${model} 的交付能力到哪一步？过程方法改变它多少？`,
    tone: '数据先行；不加权不总分；负增益如实呈现',
    createdAt: new Date().toISOString(),
  };
}

/** 读取并校验对齐稿；缺失返回 null（调用方决定生成默认稿）。字段异常时给出可读错误。 */
function readBrief(roundDir) {
  const p = path.join(roundDir, 'report-brief.json');
  if (!fs.existsSync(p)) return null;
  const b = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!SUBJECTS.includes(b.subject)) throw new Error(`report-brief.subject 非法: ${b.subject}（合法: ${SUBJECTS.join(' | ')}）`);
  for (const k of ['angle', 'audience', 'coreQuestion', 'tone']) {
    if (typeof b[k] !== 'string' || !b[k].trim()) throw new Error(`report-brief.${k} 缺失或为空`);
  }
  return b;
}

/** 写默认稿（幂等：已存在则原样返回，不覆盖用户修改）。 */
function ensureBrief(roundDir, round) {
  const existing = readBrief(roundDir);
  if (existing) return { brief: existing, created: false };
  const brief = defaultBrief(round);
  fs.mkdirSync(roundDir, { recursive: true });
  fs.writeFileSync(path.join(roundDir, 'report-brief.json'), `${JSON.stringify(brief, null, 2)}\n`);
  return { brief, created: true };
}

/** 确认门呈现文本（供 cli brief 子命令 stdout / Ddo report-align 任务送审）。 */
function renderBriefText(brief, { created }) {
  return [
    created ? '（默认对齐稿已生成，请审阅；如需调整请编辑 report-brief.json 后重跑）' : '（沿用已有对齐稿）',
    `主体 subject：${brief.subject === 'model' ? '被测模型能力（工作流 = 评测方法）' : '工作流收益（模型 = 载体）'}`,
    `视角 angle：${brief.angle}`,
    `读者 audience：${brief.audience}`,
    `核心问题 coreQuestion：${brief.coreQuestion}`,
    `基调 tone：${brief.tone}`,
  ].join('\n');
}

module.exports = { SUBJECTS, defaultBrief, readBrief, ensureBrief, renderBriefText };
