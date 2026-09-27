'use strict';
// deliver-pr 的 ctx 引擎（相位感知）：01 可选注入交付文档（作 PR 正文基础）；
// 02 必需注入 pr-info.md（合并确认门的呈现数据）。

const fs = require('fs');
const path = require('path');

module.exports = {
  assemble({ phase, statePath, sections }) {
    const runDir = path.dirname(statePath);
    const ctxParts = [];
    if (phase === '01') {
      const p = path.join(runDir, 'delivery-doc.md');
      if (fs.existsSync(p)) {
        ctxParts.push(`## Context: 交付文档\n\n${fs.readFileSync(p, 'utf8').trim()}`);
      }
    } else if (phase === '02') {
      const p = path.join(runDir, 'pr-info.md');
      if (!fs.existsSync(p)) throw new Error(`必需上下文缺失: ${p}`);
      ctxParts.push(`## Context: PR 信息\n\n${fs.readFileSync(p, 'utf8').trim()}`);
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
