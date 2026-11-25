'use strict';
// 运行记录读取层（q_export-command fixture）：.ddo/runs/<type>/<runId>/record.json 为记录单元。
const fs = require('node:fs');
const path = require('node:path');

const RUNS_ROOT = path.join(__dirname, '..', '.ddo', 'runs');

/** 全部记录（type × runId 展开，按 runId 升序）。损坏 JSON 跳过（不中断列表）。 */
function listRuns() {
  const out = [];
  if (!fs.existsSync(RUNS_ROOT)) return out;
  for (const type of fs.readdirSync(RUNS_ROOT)) {
    const typeDir = path.join(RUNS_ROOT, type);
    if (!fs.statSync(typeDir).isDirectory()) continue;
    for (const runId of fs.readdirSync(typeDir)) {
      const recPath = path.join(typeDir, runId, 'record.json');
      if (!fs.existsSync(recPath)) continue;
      try {
        const rec = JSON.parse(fs.readFileSync(recPath, 'utf8'));
        out.push({ runId, type, title: rec.title || '' });
      } catch { /* 损坏记录跳过 */ }
    }
  }
  return out.sort((a, b) => (a.runId < b.runId ? -1 : 1));
}

/** 单条记录完整内容；不存在返回 null。 */
function readRun(runId) {
  for (const type of fs.existsSync(RUNS_ROOT) ? fs.readdirSync(RUNS_ROOT) : []) {
    const recPath = path.join(RUNS_ROOT, type, runId, 'record.json');
    if (fs.existsSync(recPath)) return JSON.parse(fs.readFileSync(recPath, 'utf8'));
  }
  return null;
}

module.exports = { RUNS_ROOT, listRuns, readRun };
