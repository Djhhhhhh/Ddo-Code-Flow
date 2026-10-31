'use strict';
// tools/tests/skill-consistency.test.js — SKILL.md ↔ CLI 命令面一致性测试。
//
// 契约（fix/20261031-190338-e4e2 plan DEC-4）：
//   1. SKILL.md 中的 exec/validate 用法必须与引擎实际语法一致
//      （--task <任务名> --phase <相位>，不允许 `--task "<stageId>"` 旧形态）；
//   2. SKILL.md 中通过 `tools/cli.js` 显式调用的命令必须存在于 `cli.js --help`
//      注册的命令面（顶层动词与「域 子命令」）；
//   3. SKILL.md 必须保留「引用关系」section（入口 ↔ 引擎权威来源的定义落点）。
//
// 断言只覆盖稳定契约（命令存在性、用法语法、section 存在性），不匹配具体文案。
//
// 运行：node --test tools/tests/

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const CLI = path.join(__dirname, '..', 'cli.js');
const SKILL = path.join(__dirname, '..', '..', 'SKILL.md');

function skillMd() {
  return fs.readFileSync(SKILL, 'utf8');
}

function registryNames(helpText) {
  // 解析总览「命令:」区块内登记的命令名（4 空格缩进行首的命令词/域子命令）。
  const names = new Set();
  const re = /^ {4}([a-z]+(?: [a-z]+)?)\s*/gm;
  let m;
  while ((m = re.exec(helpText)) !== null) names.add(m[1].trim());
  return names;
}

test('SKILL.md 的 exec/validate 用法与引擎语法一致', () => {
  const md = skillMd();
  const usageLines = md.split('\n').filter((l) => /cli\.js" (exec|validate)/.test(l));
  assert.ok(usageLines.length > 0, 'SKILL.md 应至少展示一处 exec/validate 调用');
  for (const line of usageLines) {
    assert.match(line, /--task/, `用法行缺少 --task: ${line}`);
    assert.match(line, /--phase/, `用法行缺少 --phase: ${line}`);
  }
  assert.doesNotMatch(md, /--task "<[^"]*"/, 'SKILL.md 不得再出现 --task "<stageId>" 旧用法');
});

test('SKILL.md 显式调用的命令都存在于 CLI 命令面', () => {
  const md = skillMd();
  const help = spawnSync(process.execPath, [CLI, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0, 'cli.js --help 应成功');
  const registry = registryNames(help.stdout);
  assert.ok(registry.size > 0, '命令面解析应得到非空注册表');

  const invoked = new Set();
  const re = /cli\.js" ([a-z]+(?: [a-z]+)?)/g;
  let m;
  while ((m = re.exec(md)) !== null) {
    // 跳过占位符形态（如 <命令>）与 --help 等旗标
    const tok = m[1].trim();
    if (tok.startsWith('<') || tok.startsWith('--')) continue;
    invoked.add(tok);
  }
  assert.ok(invoked.size > 0, '应解析到至少一个显式命令调用');
  for (const cmd of invoked) {
    assert.ok(
      registry.has(cmd) || [...registry].some((r) => r.startsWith(`${cmd} `)),
      `SKILL.md 调用的命令不在 CLI 命令面: ${cmd}`,
    );
  }
});

test('SKILL.md 保留「引用关系」section', () => {
  const md = skillMd();
  assert.match(md, /^## 引用关系$/m, 'SKILL.md 应含「## 引用关系」小节');
  assert.match(md, /--help/, '引用关系应指向引擎 --help 权威来源');
});
