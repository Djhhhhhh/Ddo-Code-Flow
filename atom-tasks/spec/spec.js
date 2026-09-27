'use strict';
// spec 的 ctx 引擎（D12：执行时基于唯一事实源动态计算）。
// :01 需要 Requirement（必需）+ Context Summary（可选）；
// :02 需要 Requirement + 刚生成的 spec.md（均必需——确认门要审的就是它）。

const fs = require('fs');
const path = require('path');

module.exports = {
  assemble({ phase, statePath, sections }) {
    const runDir = path.dirname(statePath);
    const wanted = phase === '02'
      ? [
        ['Requirement', 'requirement.md', true],
        ['Alignment Spec（待确认）', 'spec.md', true],
      ]
      : [
        ['Requirement', 'requirement.md', true],
        ['Context Summary', 'context-summary.md', false],
      ];

    const ctxParts = [];
    for (const [title, file, required] of wanted) {
      const p = path.join(runDir, file);
      if (fs.existsSync(p)) {
        ctxParts.push(`## Context: ${title}\n\n${fs.readFileSync(p, 'utf8').trim()}`);
      } else if (required) {
        throw new Error(`必需上下文缺失: ${p}`);
      }
    }

    const parts = [];
    if (sections.preamble) parts.push(sections.preamble);
    if (sections.instruction) parts.push(sections.instruction);
    if (ctxParts.length) parts.push(ctxParts.join('\n\n'));
    if (sections.extraCtx) parts.push(`## Extra Context\n\n${sections.extraCtx}`);
    if (sections.rules.length) parts.push(`## Rules\n\n${sections.rules.map((r) => `- ${r}`).join('\n')}`);
    return parts.join('\n\n---\n\n');
  },

  // present 钩子（交互协议结构闭环）：确认门（相位 02）动态选项现算——
  // 解析 runDir/spec.md「## 需要用户确认」的未解决 BQ，产出 回答BQ-N 选项进 gate present payload。
  // 降级语义：spec.md 缺失 / 无该 section / 无 BQ 条目 → 无动态选项（呈现不阻塞）。
  present({ phase, statePath }) {
    if (phase !== '02') return { options: [] };
    const specFile = path.join(path.dirname(statePath), 'spec.md');
    if (!fs.existsSync(specFile)) return { options: [] };
    const lines = fs.readFileSync(specFile, 'utf8').split(/\r?\n/);
    let inSection = false;
    const bqs = [];
    for (const line of lines) {
      if (/^##\s/.test(line)) {
        inSection = /^##\s*需要用户确认/.test(line);
        continue;
      }
      if (!inSection) continue;
      const m = line.match(/^\s*-\s+\*\*(BQ-\d+)\*\*\s*[：:]?\s*(.*)$/);
      if (m) bqs.push({ id: m[1], text: m[2].trim() });
    }
    return {
      options: bqs.map((b) => ({
        name: `回答${b.id}`, // 决议名词汇无空格（DECISION_RE），desc 承载原文
        desc: b.text ? `${b.id}：${b.text}` : `${b.id}（见 spec.md 需要用户确认）`,
        action: 'in-phase',
      })),
    };
  },
};
