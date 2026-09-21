'use strict';
// coding 的 ctx 引擎（D12）：按「存在性容错」动态注入——
// spec.md / plan.md 必需；test-plan.md、tasks/ 目录下的 task-NN.md 存在才注入。

const fs = require('fs');
const path = require('path');

module.exports = {
  assemble({ statePath, sections }) {
    const runDir = path.dirname(statePath);
    const ctxParts = [];

    const pushFile = (title, file, required) => {
      const p = path.join(runDir, file);
      if (fs.existsSync(p)) {
        ctxParts.push(`## Context: ${title}\n\n${fs.readFileSync(p, 'utf8').trim()}`);
      } else if (required) {
        throw new Error(`必需上下文缺失: ${p}`);
      }
    };

    pushFile('Alignment Spec', 'spec.md', true);
    pushFile('Plan', 'plan.md', true);
    pushFile('Test Plan', 'test-plan.md', false);

    const tasksDir = path.join(runDir, 'tasks');
    if (fs.existsSync(tasksDir) && fs.statSync(tasksDir).isDirectory()) {
      const taskFiles = fs.readdirSync(tasksDir).filter((f) => /^task-.*\.md$/.test(f)).sort();
      if (taskFiles.length) {
        const body = taskFiles.map((f) => `### ${f}\n\n${fs.readFileSync(path.join(tasksDir, f), 'utf8').trim()}`).join('\n\n');
        ctxParts.push(`## Context: Tasks\n\n${body}`);
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
