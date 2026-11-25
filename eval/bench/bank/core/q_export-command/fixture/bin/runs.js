#!/usr/bin/env node
'use strict';
// runs 命令（q_export-command fixture 的既有 CLI）：查看 .ddo/runs/ 运行记录。
// 用法：
//   node bin/runs.js list                     列出全部运行记录（一行一条：runId type title）
//   node bin/runs.js show <runId>             以 JSON 打印单条记录（项目序列化约定：2 空格缩进 + 尾随换行）
// 项目错误约定：用法错误 exit 2（stderr 人话）；找不到记录 exit 1（stderr 人话）。
const fs = require('node:fs');
const path = require('node:path');
const { listRuns, readRun } = require('../lib/records');

function main(argv) {
  const [cmd, ...rest] = argv.slice(2);
  if (cmd === 'list') {
    for (const r of listRuns()) console.log(`${r.runId}  ${r.type.padEnd(6)}  ${r.title}`);
    return;
  }
  if (cmd === 'show') {
    const runId = rest[0];
    if (!runId) { console.error('用法: runs show <runId>'); process.exit(2); }
    const rec = readRun(runId);
    if (!rec) { console.error(`未找到运行记录: ${runId}`); process.exit(1); }
    process.stdout.write(JSON.stringify(rec, null, 2) + '\n'); // 项目序列化约定
    return;
  }
  console.error('用法: runs list | runs show <runId>');
  process.exit(2);
}
main(process.argv);
