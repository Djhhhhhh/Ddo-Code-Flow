'use strict';
// link-issue 的 ctx 引擎：必需 pr-info.md（deliver-pr:01 产出，本任务唯一输入）。

const fs = require('fs');
const path = require('path');

module.exports = {
  assemble({ statePath, sections }) {
    const runDir = path.dirname(statePath);
    const p = path.join(runDir, 'pr-info.md');
    if (!fs.existsSync(p)) throw new Error(`必需上下文缺失: ${p}`);
    const parts = [];
    if (sections.preamble) parts.push(sections.preamble);
    if (sections.instruction) parts.push(sections.instruction);
    parts.push(`## Context: PR 信息\n\n${fs.readFileSync(p, 'utf8').trim()}`);
    if (sections.extraCtx) parts.push(`## Extra Context\n\n${sections.extraCtx}`);
    if (sections.rules.length) parts.push(`## Rules\n\n${sections.rules.map((r) => `- ${r}`).join('\n')}`);
    return parts.join('\n\n---\n\n');
  },
};
