'use strict';
// 同源 policy 生成（plan Part 02 §5，FR-3/AC-3）：
// 题包 clarify.json → ①ddo 臂 gate auto 策略文件；②baseline 臂应答查表。
// 两通道出自同一份冻结清单——对称性自检的数据基础。

const fs = require('node:fs');
const path = require('node:path');

/**
 * 生成 gate auto 策略（引擎通用 schema，见 tools/STATE-SPEC §4.3.6）。
 * 基础链两个门（spec:02 / plan:02）：prefer 同意。
 * BQ 动态选项（回答BQ-N，N 由被测模型的 spec 现算、不可预知）一律映射到冻结清单的
 * fallback 中性应答——不猜序号对应、不生成新文本（应答源仍是同一份冻结文件，对称性成立）。
 */
function buildGateAutoPolicy(clarify) {
  const fallback = clarify.fallback || '按你的假设继续，并显式记录该假设。';
  const inPhase = {};
  for (let i = 1; i <= 10; i++) inPhase[`回答BQ-${i}`] = fallback; // 预置常见序号；超出未命中→gate auto 硬错（如实记录）
  return {
    rules: [
      {
        id: 'spec-approve',
        match: { stage: 'spec', phase: '02' },
        prefer: ['同意'],
        inPhase,
      },
      {
        id: 'plan-approve',
        match: { stage: 'plan', phase: '02' },
        prefer: ['同意'],
      },
    ],
    defaults: { prefer: ['同意'] },
  };
}

/** 展平策略为引擎消费形态（当前已无内部字段，保留做幂等深拷贝与兼容点）。 */
function materializePolicy(policy) {
  return JSON.parse(JSON.stringify(policy));
}

/** baseline 臂应答查表：关键词命中 → 既定应答；未命中 → 中性回退（回退本身入对称性记录）。
 *  clarify schema（issue #92 DEC-2/10）：{ note?, fallback, items[{id,keywords,answer}] }——question 键已废除。 */
function buildResponderTable(clarify) {
  return {
    fallback: clarify.fallback || '按你的假设继续，并显式记录该假设。',
    entries: (clarify.items || []).map((it) => ({ id: it.id, keywords: it.keywords, answer: it.answer })),
  };
}

/** 查表应答：返回 { text, hitId | 'fallback' }。匹配 = 应答文本含任一关键词（不生成新文本）。 */
function lookupAnswer(table, questionText) {
  const q = String(questionText || '');
  for (const e of table.entries) {
    if (e.keywords.some((k) => q.includes(k))) return { text: e.answer, hitId: e.id };
  }
  return { text: table.fallback, hitId: 'fallback' };
}

/** 写出策略文件与查表（同源生成物入轮次目录留痕）。 */
function writePolicyArtifacts({ roundQDir, clarify }) {
  fs.mkdirSync(roundQDir, { recursive: true });
  const policy = buildGateAutoPolicy(clarify);
  const table = buildResponderTable(clarify);
  const policyPath = path.join(roundQDir, 'gate-auto.policy.json');
  fs.writeFileSync(policyPath, JSON.stringify(materializePolicy(policy), null, 2) + '\n');
  fs.writeFileSync(path.join(roundQDir, 'responder.table.json'), JSON.stringify(table, null, 2) + '\n');
  return { policyPath, table, rawPolicy: policy };
}

module.exports = { buildGateAutoPolicy, materializePolicy, buildResponderTable, lookupAnswer, writePolicyArtifacts };
