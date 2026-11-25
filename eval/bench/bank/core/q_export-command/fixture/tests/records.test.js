'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { listRuns, readRun } = require('../lib/records');

test('listRuns：列出样例记录并按 runId 排序', () => {
  const runs = listRuns();
  assert.equal(runs.length, 2);
  assert.equal(runs[0].runId, '20261101-100000-ex01');
  assert.equal(runs[1].type, 'fix');
});

test('readRun：返回完整记录；不存在返回 null', () => {
  assert.equal(readRun('20261101-100000-ex01').title, '为 runs 命令补充 tabular 输出');
  assert.equal(readRun('nope'), null);
});

test('runs list / show 命令行为与序列化约定', () => {
  const out = execFileSync(process.execPath, [path.join(__dirname, '..', 'bin', 'runs.js'), 'list'], { encoding: 'utf8' });
  assert.match(out, /20261101-100000-ex01\s+feat\s+/);
  const shown = execFileSync(process.execPath, [path.join(__dirname, '..', 'bin', 'runs.js'), 'show', '20261103-140000-ex02'], { encoding: 'utf8' });
  assert.match(shown, /"runId": "20261103-140000-ex02"/); // 2 空格缩进约定
  assert.ok(shown.endsWith('\n')); // 尾随换行约定
});
