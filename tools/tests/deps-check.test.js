'use strict';
// tools/tests/deps-check.test.js — deps check 依赖检查命令测试（测试工作流 DEC-E）。
//
// 覆盖：链上无声明 → 空报告；--task 指定（可为链外任务）逐项执行与汇总；
// 支持脚本 exit 0 / 非零 / 脚本缺失 三形态；--task 不存在 → exit 1；--state 必填。
// 隔离约定同前：mkdtemp 沙箱 + DDO_HOME 覆写 + finally 递归删除。

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI = path.join(__dirname, '..', 'cli.js');

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddo-deps-test-'));
  return { dir, ddoHome: path.join(dir, 'ddo-home'), project: path.join(dir, 'project'), tasks: path.join(dir, 'tasks') };
}

function cleanup(sb) {
  fs.rmSync(sb.dir, { recursive: true, force: true });
}

function cli(args, sb) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: sb.dir,
    env: { ...process.env, DDO_HOME: sb.ddoHome },
    encoding: 'utf8',
  });
}

function startRun(sb) {
  const r = cli(['run', 'start', '--title', 'deps 冒烟', '--project', sb.project], sb);
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout).statePath;
}

/** 沙箱任务：带 dependencies 与 checks 脚本。 */
function writeDepTask(sb, name, scripts) {
  const dir = path.join(sb.tasks, name);
  fs.mkdirSync(path.join(dir, 'checks'), { recursive: true });
  for (const [file, body] of Object.entries(scripts || {})) {
    fs.writeFileSync(path.join(dir, 'checks', file), `#!/usr/bin/env bash\n${body}\n`);
  }
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({
    name, version: '1.0.0',
    dependencies: [
      { id: 'ok-dep', desc: '恒支持依赖', required: false, check: 'checks/ok.sh', install: 'echo install-ok' },
      { id: 'broken-dep', desc: '恒不支持依赖', required: true, check: 'checks/broken.sh' },
      { id: 'ghost-dep', desc: '脚本缺失依赖', required: false, check: 'checks/ghost.sh' },
    ],
  }, null, 2));
  fs.writeFileSync(path.join(dir, 'prompt.md'), `# ${name}\n\n沙箱占位任务。\n`);
}

// ---------------------------------------------------------------- 链上无声明

test('deps check（链上无声明）：空报告 + 全部通过 hint + exit 0', () => {
  const sb = sandbox();
  try {
    const statePath = startRun(sb);
    const r = cli(['deps', 'check', '--state', statePath], sb);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.deepStrictEqual(out.checks, []);
    assert.equal(out.summary.total, 0);
    assert.match(out.hint, /全部依赖检查通过/);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- --task 逐项执行

test('deps check --task：支持/不支持/脚本缺失三形态 + 汇总', () => {
  const sb = sandbox();
  try {
    const statePath = startRun(sb);
    writeDepTask(sb, 'dep-demo', {
      'ok.sh': 'exit 0',
      'broken.sh': 'echo "boom" >&2; exit 3',
    });
    const r = cli(['deps', 'check', '--state', statePath, '--task', 'dep-demo', '--tasks-dir', sb.tasks], sb);
    assert.equal(r.status, 0, r.stderr); // 结果型命令：有不支持项也不是命令错误
    const out = JSON.parse(r.stdout);
    assert.equal(out.checks.length, 3);
    const byId = Object.fromEntries(out.checks.map((c) => [c.id, c]));
    assert.equal(byId['ok-dep'].supported, true);
    assert.equal(byId['broken-dep'].supported, false);
    assert.match(byId['broken-dep'].detail, /boom/);
    assert.equal(byId['ghost-dep'].supported, false);
    assert.match(byId['ghost-dep'].detail, /检查脚本缺失/);
    assert.equal(byId['ok-dep'].install, 'echo install-ok');
    assert.equal(out.summary.total, 3);
    assert.equal(out.summary.supported, 1);
    assert.equal(out.summary.missing, 2);
    assert.equal(out.summary.missingRequired, 1);
    assert.match(out.hint, /存在不支持项/);
  } finally {
    cleanup(sb);
  }
});

test('deps check --task test-e2e（仓库任务）：browser-automation 逐项报告（本机支持性不断言）', () => {
  const sb = sandbox();
  try {
    const statePath = startRun(sb);
    const r = cli(['deps', 'check', '--state', statePath, '--task', 'test-e2e'], sb);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.checks.length, 1);
    const c = out.checks[0];
    assert.equal(c.task, 'test-e2e');
    assert.equal(c.id, 'browser-automation');
    assert.equal(c.required, false);
    assert.equal(typeof c.supported, 'boolean'); // 本机是否装 playwright 不作断言
    assert.ok(c.install && c.install.includes('playwright'));
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- 错误形态

test('deps check --task 不存在 → exit 1；缺 --state → exit 2', () => {
  const sb = sandbox();
  try {
    const statePath = startRun(sb);
    let r = cli(['deps', 'check', '--state', statePath, '--task', 'no-such-task'], sb);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /原子任务不存在/);
    r = cli(['deps', 'check'], sb);
    assert.equal(r.status, 2);
  } finally {
    cleanup(sb);
  }
});
