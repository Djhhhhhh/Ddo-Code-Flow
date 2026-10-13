'use strict';
// test-e2e 的 ctx 引擎：注入 test-design.md（必需）与 test-scope.md（必需）。同 test-unit 模式。

const fs = require('fs');
const path = require('path');

module.exports = {
  assemble({ statePath, sections }) {
    const runDir = path.dirname(statePath);
    const wanted = [
      ['测试计划', 'test-design.md', true],
      ['测试范围确认文档', 'test-scope.md', true],
    ];
    const ctxParts = [];
    for (const [title, file, required] of wanted) {
      const p = path.join(runDir, file);
      if (fs.existsSync(p)) ctxParts.push(`## Context: ${title}\n\n${fs.readFileSync(p, 'utf8').trim()}`);
      else if (required) throw new Error(`必需上下文缺失: ${p}`);
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
