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
};
