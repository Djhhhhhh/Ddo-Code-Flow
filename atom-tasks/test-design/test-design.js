'use strict';
// test-design 的 ctx 引擎：:01 注入 test-scope.md（必需）+ 启用能力（旋钮现算）；
// :02 追加刚生成的 test-design.md（待审对象）。

const fs = require('fs');
const path = require('path');

module.exports = {
  assemble({ phase, state, statePath, sections }) {
    const runDir = path.dirname(statePath);
    const scopeFile = path.join(runDir, 'test-scope.md');
    if (!fs.existsSync(scopeFile)) throw new Error(`必需上下文缺失: ${scopeFile}`);
    const caps = (((state.atomTasks || {})['test-design']) || {}).capabilities;
    const capList = Array.isArray(caps) && caps.length ? caps.join('、') : '（未启用任何执行层——仅产出计划，无执行阶段）';

    const parts = [];
    if (sections.preamble) parts.push(sections.preamble);
    if (sections.instruction) parts.push(sections.instruction);
    parts.push(`## Context: 测试范围确认文档\n\n${fs.readFileSync(scopeFile, 'utf8').trim()}`);
    parts.push(`## Context: 启用能力（state.atomTasks.test-design.capabilities）\n\n- ${capList}`);
    if (phase === '02') {
      const planFile = path.join(runDir, 'test-design.md');
      if (!fs.existsSync(planFile)) throw new Error(`必需上下文缺失: ${planFile}`);
      parts.push(`## Context: 测试计划（待确认）\n\n${fs.readFileSync(planFile, 'utf8').trim()}`);
    }
    if (sections.extraCtx) parts.push(`## Extra Context\n\n${sections.extraCtx}`);
    if (sections.rules.length) parts.push(`## Rules\n\n${sections.rules.map((r) => `- ${r}`).join('\n')}`);
    return parts.join('\n\n---\n\n');
  },
};
