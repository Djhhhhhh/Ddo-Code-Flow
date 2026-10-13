'use strict';
// test-scope 的 ctx 引擎：:01 无上游产物（走默认模板）；
// :02 确认门注入刚生成的 test-scope.md（待审对象，同 spec.js 模式）。

const fs = require('fs');
const path = require('path');

module.exports = {
  assemble({ phase, statePath, sections }) {
    if (phase !== '02') return undefined;
    const file = path.join(path.dirname(statePath), 'test-scope.md');
    if (!fs.existsSync(file)) throw new Error(`必需上下文缺失: ${file}`);
    const parts = [];
    if (sections.preamble) parts.push(sections.preamble);
    if (sections.instruction) parts.push(sections.instruction);
    parts.push(`## Context: 测试范围确认文档（待确认）\n\n${fs.readFileSync(file, 'utf8').trim()}`);
    if (sections.extraCtx) parts.push(`## Extra Context\n\n${sections.extraCtx}`);
    if (sections.rules.length) parts.push(`## Rules\n\n${sections.rules.map((r) => `- ${r}`).join('\n')}`);
    return parts.join('\n\n---\n\n');
  },
};
