'use strict';
// tools/tests/list.test.js — list 域发现命令测试（09 plan 契约：D1/D4/D5/D6）。
//
// 覆盖：list tasks（desc/相位概要/可配置项）、list workflows（描述/阶段链/自定义目录）、
// run start configurable 预填（有 default 预填 / 无 default 不填 / 不在链中不填）、
// 错误联动（未知预设列现有 / 任务不存在指路 list tasks）。
// 隔离约定同前：mkdtemp 沙箱 + DDO_HOME 指内 + finally 递归删除。

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI = path.join(__dirname, '..', 'cli.js');

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddo-list-test-'));
  return { dir, ddoHome: path.join(dir, 'ddo-home'), project: path.join(dir, 'proj'), wf: path.join(dir, 'wf') };
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

// ---------------------------------------------------------------- list tasks / list workflows

test('list tasks：全量任务注册表（desc/相位/人审位/可配置项，config 直读）', () => {
  const sb = sandbox();
  try {
    const r = cli(['list', 'tasks'], sb);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.ok(out.tasks.length >= 17, `任务数异常: ${out.tasks.length}`);

    const spec = out.tasks.find((t) => t.name === 'spec');
    assert.match(spec.desc, /对齐规格/);
    assert.deepEqual(
      spec.phases.map((p) => `${p.id}:${p.type}`),
      ['01:action', '02:human']
    );
    assert.equal(spec.configurable, undefined); // 无可配置项不输出该字段

    const tp = out.tasks.find((t) => t.name === 'test-plan');
    assert.deepEqual(tp.configurable, [
      { key: 'tdd', desc: '为 cmd 验收项生成 TDD Red 测试骨架（相位 03）', default: false },
    ]);

    const cp = out.tasks.find((t) => t.name === 'create-pr');
    assert.deepEqual(cp.configurable.map((c) => c.key), ['issueNumber']);
    assert.equal(cp.configurable[0].default, undefined); // 无 default：仅呈现不预填
  } finally {
    cleanup(sb);
  }
});

test('list workflows：默认目录与 --workflows-dir 自定义目录（描述 + 阶段链）', () => {
  const sb = sandbox();
  try {
    const def = JSON.parse(cli(['list', 'workflows'], sb).stdout);
    const basic = def.workflows.find((w) => w.name === 'basic');
    assert.equal(basic.version, '1.0.0');
    assert.match(basic.description, /基础链路/);
    assert.deepEqual(basic.stages, ['requirement', 'spec', 'plan', 'coding', 'reporting']);

    const standard = def.workflows.find((w) => w.name === 'standard'); // 12 D2：标准链全量呈现
    assert.deepEqual(standard.stages, [
      'requirement', 'spec', 'plan', 'test-plan', 'tasking',
      'coding', 'verification', 'review', 'reporting', 'reflection',
    ]);

    fs.mkdirSync(sb.wf, { recursive: true });
    fs.writeFileSync(path.join(sb.wf, 'custom-demo.json'), JSON.stringify({
      name: 'custom-demo', version: '1.0.0', description: '引导拼出的自定义链',
      stages: [{ task: 'requirement', dependOn: [] }, { task: 'test-plan', dependOn: ['requirement'] }],
    }));
    const custom = JSON.parse(cli(['list', 'workflows', '--workflows-dir', sb.wf], sb).stdout);
    assert.deepEqual(custom.workflows.map((w) => w.name), ['custom-demo']);
    assert.deepEqual(custom.workflows[0].stages, ['requirement', 'test-plan']);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- configurable 预填（D3）

test('run start 预填：链内任务有 default 的旋钮进 state.atomTasks；无 default 与链外任务不进', () => {
  const sb = sandbox();
  try {
    fs.mkdirSync(sb.wf, { recursive: true });
    fs.writeFileSync(path.join(sb.wf, 'mixed.json'), JSON.stringify({
      name: 'mixed', version: '1.0.0',
      stages: [
        { task: 'requirement', dependOn: [] },
        { task: 'test-plan', dependOn: ['requirement'] },     // tdd 有 default → 预填
        { task: 'create-pr', dependOn: ['test-plan'] },       // issueNumber 无 default → 不填
      ],
    }));
    const r = cli(['run', 'start', '--title', 't', '--workflow', 'mixed',
      '--workflows-dir', sb.wf, '--project', sb.project], sb);
    assert.equal(r.status, 0, r.stderr);
    const state = JSON.parse(fs.readFileSync(JSON.parse(r.stdout).statePath, 'utf8'));
    assert.deepEqual(state.atomTasks, { 'test-plan': { tdd: false } }); // create-pr 无 default、basic 外任务不预填
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- 错误联动发现层（D5）

test('错误指路：未知预设列现有；任务不存在指向 list tasks', () => {
  const sb = sandbox();
  try {
    const r = cli(['run', 'start', '--title', 't', '--workflow', 'ghost', '--project', sb.project], sb);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /现有: basic/);
    assert.match(r.stderr, /list workflows/);

    // 构造：currentStage 含任务名但任务目录缺失（模拟环境破损）→ 任务不存在错误
    const runDir = path.join(sb.project, '.ddo', 'runs', 'feat', 'x');
    fs.mkdirSync(runDir, { recursive: true });
    const statePath = path.join(runDir, '.state.json');
    fs.writeFileSync(statePath, JSON.stringify({
      runId: '20260924-100000-l001', title: 't', startedAt: 't',
      git: { mainBranch: '' }, currentStage: ['ghost-task:01'],
      stages: { 'ghost-task': { status: 'running', dependOn: [], at: 't' } }, atomTasks: {},
    }));
    const e = cli(['exec', '--state', statePath, '--task', 'ghost-task'], sb);
    assert.equal(e.status, 1);
    assert.match(e.stderr, /原子任务不存在/);
    assert.match(e.stderr, /list tasks/);
  } finally {
    cleanup(sb);
  }
});
