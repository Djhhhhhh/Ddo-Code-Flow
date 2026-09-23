'use strict';
// plan 的 ctx 引擎（D12：执行时基于唯一事实源动态计算）。
// 工作目录（09 弱依赖：state 现算）；Alignment Spec 必需 + Context Summary 可选。

const fs = require('fs');
const path = require('path');
const { resolveWorkdir } = require('../../tools/lib/workdir');

const WANTED = [["Alignment Spec（已确认）", "spec.md", true], ["Context Summary", "context-summary.md", false]];

module.exports = {
  assemble({ state, statePath, sections }) {
    const runDir = path.dirname(statePath);
    const ctxParts = [resolveWorkdir(state, statePath).ctx];
    for (const [title, file, required] of WANTED) {
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
