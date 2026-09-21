'use strict';
// tools/tests/cli.test.js — cli 命令行为测试（04 plan v1.0 契约）。
//
// 隔离约定（硬要求）：
//   每个测试用例在 os.tmpdir() 下 mkdtemp 出独立沙箱目录，DDO_HOME 指向沙箱内的
//   ddo-home/，state 文件也只写在沙箱内；用例结束（无论成败）finally 递归删除整个
//   沙箱——不产出残留中间文件，不触碰真实 ~/.ddo。
//
// 运行：node --test tools/tests/

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI = path.join(__dirname, '..', 'cli.js');

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddo-cli-test-'));
  return {
    dir,
    ddoHome: path.join(dir, 'ddo-home'),
    statePath: path.join(dir, 'run', '.state.json'),
  };
}

function cleanup(sb) {
  fs.rmSync(sb.dir, { recursive: true, force: true });
}

function cli(args, sb) {
  return spawnSync(process.execPath, [CLI, ...args], {
    env: { ...process.env, DDO_HOME: sb.ddoHome },
    encoding: 'utf8',
  });
}

function writeState(sb, state) {
  fs.mkdirSync(path.dirname(sb.statePath), { recursive: true });
  fs.writeFileSync(sb.statePath, `${JSON.stringify(state, null, 2)}\n`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** 测试夹具：context → spec → plan → { parallel-a（路径外并行分支）, coding（当前执行位置） } */
function sampleState() {
  return {
    runId: '20260922-100000-ab01',
    title: 'cli 测试',
    startedAt: '2026-09-22T10:00:00+08:00',
    git: { mainBranch: 'main' },
    currentStage: ['coding:01'],
    stages: {
      context: { status: 'done', dependOn: [], at: '2026-09-22T10:00:01+08:00' },
      spec: { status: 'done', dependOn: ['context'], at: '2026-09-22T10:00:02+08:00' },
      plan: { status: 'done', dependOn: ['spec'], at: '2026-09-22T10:00:03+08:00' },
      'parallel-a': { status: 'done', dependOn: ['plan'], at: '2026-09-22T10:00:04+08:00' },
      coding: { status: 'running', dependOn: ['plan'], at: '2026-09-22T10:00:05+08:00' },
    },
    atomTasks: {},
  };
}

// ---------------------------------------------------------------- 框架行为

test('全局 help：exit 0，含顶层动词与域命令两组', () => {
  const sb = sandbox();
  try {
    const r = cli([], sb);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /顶层动词:/);
    assert.match(r.stdout, /rollback/);
    assert.match(r.stdout, /run 域:/);
    assert.match(r.stdout, /run finish/);
  } finally {
    cleanup(sb);
  }
});

test('命令级 help：rollback --help 输出用法与参数', () => {
  const sb = sandbox();
  try {
    const r = cli(['rollback', '--help'], sb);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /--stage/);
    assert.match(r.stdout, /--reason/);
  } finally {
    cleanup(sb);
  }
});

test('未知命令（顶层/两段式）：exit 2 + stderr', () => {
  const sb = sandbox();
  try {
    assert.equal(cli(['frobnicate'], sb).status, 2);
    assert.match(cli(['frobnicate'], sb).stderr, /未知命令/);
    assert.equal(cli(['run', 'jump'], sb).status, 2);
  } finally {
    cleanup(sb);
  }
});

test('必填参数缺失：exit 2，提示参数名（注册表驱动）', () => {
  const sb = sandbox();
  try {
    const r = cli(['run', 'finish', '--state', sb.statePath], sb);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /--status/);
  } finally {
    cleanup(sb);
  }
});

test('--flag=value 等价形态可用', () => {
  const sb = sandbox();
  try {
    writeState(sb, sampleState());
    const r = cli(['rollback', `--state=${sb.statePath}`, '--stage=spec'], sb);
    assert.equal(r.status, 0);
    assert.equal(JSON.parse(r.stdout).currentStage[0], 'spec:01');
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- rollback

test('rollback：DAG 路径重置——目标+路径节点（含当前执行位置终点），路径外并行分支不动', () => {
  const sb = sandbox();
  try {
    writeState(sb, sampleState());
    const r = cli(['rollback', '--state', sb.statePath, '--stage', 'spec'], sb);
    assert.equal(r.status, 0);
    const out = JSON.parse(r.stdout);
    assert.deepEqual(out.rolledBack, [{ stage: 'spec', from: 'done', to: 'pending' }]);
    assert.deepEqual([...out.pathReset].sort(), ['coding', 'plan']);
    assert.deepEqual(out.currentStage, ['spec:01']);

    const state = readJson(sb.statePath);
    assert.equal(state.stages.spec.status, 'pending');
    assert.equal(state.stages.plan.status, 'pending');
    assert.equal(state.stages.coding.status, 'pending');
    assert.equal(state.stages['parallel-a'].status, 'done'); // 不在路径上
    assert.equal(state.stages.context.status, 'done'); // 目标之前
    assert.deepEqual(state.currentStage, ['spec:01']);
  } finally {
    cleanup(sb);
  }
});

test('rollback：pending 目标 exit 1；不存在目标 exit 1', () => {
  const sb = sandbox();
  try {
    writeState(sb, sampleState());
    const state = readJson(sb.statePath);
    state.stages.spec.status = 'pending';
    writeState(sb, state);
    assert.equal(cli(['rollback', '--state', sb.statePath, '--stage', 'spec'], sb).status, 1);
    assert.equal(cli(['rollback', '--state', sb.statePath, '--stage', 'nope'], sb).status, 1);
  } finally {
    cleanup(sb);
  }
});

test('rollback --reason：写入 stderr 日志，不进 state/stdout', () => {
  const sb = sandbox();
  try {
    writeState(sb, sampleState());
    const r = cli(['rollback', '--state', sb.statePath, '--stage', 'spec', '--reason', '人审驳回'], sb);
    assert.equal(r.status, 0);
    assert.match(r.stderr, /人审驳回/);
    assert.doesNotMatch(r.stdout, /人审驳回/);
    assert.equal(JSON.stringify(readJson(sb.statePath)).includes('人审驳回'), false);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- run finish

test('run finish：清 currentStage → history 追加 → index 移除', () => {
  const sb = sandbox();
  try {
    writeState(sb, sampleState());
    const r = cli(['run', 'finish', '--state', sb.statePath, '--status', 'aborted'], sb);
    assert.equal(r.status, 0);
    assert.deepEqual(JSON.parse(r.stdout), { finished: '20260922-100000-ab01', finalStatus: 'aborted' });

    assert.deepEqual(readJson(sb.statePath).currentStage, []);
    const hist = readJson(path.join(sb.ddoHome, 'history', 'runs.jsonl'));
    assert.equal(hist.runId, '20260922-100000-ab01');
    assert.equal(hist.finalStatus, 'aborted');
    assert.equal(hist.statePath, sb.statePath);
    assert.deepEqual(readJson(path.join(sb.ddoHome, 'index.json')), {});
  } finally {
    cleanup(sb);
  }
});

test('run finish：--status 非法 exit 2；state 不存在 exit 1', () => {
  const sb = sandbox();
  try {
    writeState(sb, sampleState());
    assert.equal(cli(['run', 'finish', '--state', sb.statePath, '--status', 'oops'], sb).status, 2);
    assert.equal(cli(['run', 'finish', '--state', path.join(sb.dir, 'none.json'), '--status', 'done'], sb).status, 1);
  } finally {
    cleanup(sb);
  }
});

test('run finish 幂等：重复调用 exit 0，history 追加由读取方容忍', () => {
  const sb = sandbox();
  try {
    writeState(sb, sampleState());
    assert.equal(cli(['run', 'finish', '--state', sb.statePath, '--status', 'done'], sb).status, 0);
    const r2 = cli(['run', 'finish', '--state', sb.statePath, '--status', 'done'], sb);
    assert.equal(r2.status, 0);
    const lines = fs.readFileSync(path.join(sb.ddoHome, 'history', 'runs.jsonl'), 'utf8')
      .split('\n').filter((l) => l.trim());
    assert.equal(lines.length, 2);
  } finally {
    cleanup(sb);
  }
});
