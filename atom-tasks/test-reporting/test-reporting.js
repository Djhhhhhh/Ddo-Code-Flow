'use strict';
// test-reporting 的 ctx 引擎：test-scope/test-design 必需；各层报告按存在性注入
// （裁剪形态下未启用层无报告——可选注入，缺失即未启用）。

const fs = require('fs');
const path = require('path');

module.exports = {
  assemble({ statePath, sections }) {
    const runDir = path.dirname(statePath);
    const wanted = [
      ['测试范围确认文档', 'test-scope.md', true],
      ['测试计划', 'test-design.md', true],
      ['单元测试报告', 'unit-test-report.md', false],
      ['接口测试报告', 'api-test-report.md', false],
      ['e2e 测试报告', 'e2e-test-report.md', false],
    ];
    const ctxParts = [];
    const missing = [];
    for (const [title, file, required] of wanted) {
      const p = path.join(runDir, file);
      if (fs.existsSync(p)) ctxParts.push(`## Context: ${title}\n\n${fs.readFileSync(p, 'utf8').trim()}`);
      else if (required) throw new Error(`必需上下文缺失: ${p}`);
      else missing.push(title);
    }
    if (missing.length) {
      ctxParts.push(`## Context: 未注入的报告（对应层级未启用，如实标注）\n\n${missing.map((t) => `- ${t}`).join('\n')}`);
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
