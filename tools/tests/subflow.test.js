'use strict';
// tools/tests/subflow.test.js — 子流程编排测试（plan DEC-1/2/3/4，AC-1/2/4）。
//
// 隔离约定（同 next.test.js）：每用例 mkdtemp 独立沙箱，DDO_HOME 指向沙箱内，
// state 手写在沙箱 run 目录；原子任务直接读仓库 atom-tasks/（只读）。

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI = path.join(__dirname, '..', 'cli.js');
const REPO_ATOM_TASKS = path.join(__dirname, '..', '..', 'atom-tasks');

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddo-subflow-test-'));
  return { dir, ddoHome: path.join(dir, 'ddo-home'), statePath: path.join(dir, 'run', '.state.json'), runDir: path.join(dir, 'run') };
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

const ISO = '2026-01-01T00:00:00.000+08:00';

/** 手写父 state（basic 链子集，plan:01 当前位）。 */
function parentState(sb, overrides = {}) {
  return {
    runId: '20260101-000000-test',
    title: 'subflow test parent',
    startedAt: ISO,
    git: { mainBranch: 'main', branch: 'feat/x', worktreePath: sb.runDir },
    dirs: { projectRoot: sb.runDir, runDir: sb.runDir, tasksDir: REPO_ATOM_TASKS },
    currentStage: ['plan:01'],
    stages: {
      requirement: { status: 'done', dependOn: [], at: ISO },
      spec: { status: 'done', dependOn: ['requirement'], at: ISO },
      plan: { status: 'running', dependOn: ['spec'], at: ISO },
      coding: { status: 'pending', dependOn: ['plan'], at: ISO },
    },
    atomTasks: {},
    ...overrides,
  };
}

function writeState(statePath, state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

/** 手写子 state（收口用例的夹具）。 */
function childState(sb, { depth = 2, parentPath, runDir, currentStage = [], subflowsEntry } = {}) {
  return {
    runId: '20260101-000000-test-sf1',
    title: (subflowsEntry && subflowsEntry.title) || '调研 X',
    startedAt: ISO,
    dirs: { projectRoot: sb.runDir, runDir: runDir || path.join(sb.runDir, 'subflows', 'sf-1'), tasksDir: REPO_ATOM_TASKS },
    currentStage,
    stages: { requirement: { status: 'done', dependOn: [], at: ISO } },
    atomTasks: {},
    subflow: { depth, parentStatePath: parentPath || sb.statePath, parentRunId: '20260101-000000-test', atStage: 'plan', title: (subflowsEntry && subflowsEntry.title) || '调研 X' },
  };
}

function activeEntry(sb, { id = 'sf-1', statePath } = {}) {
  return {
    id, title: '调研 X', workflow: 'basic', atStage: 'plan',
    statePath: statePath || path.join(sb.runDir, 'subflows', id, '.state.json'),
    status: 'active', startedAt: ISO,
  };
}

// ---------------------------------------------------------------- subflow start

test('subflow start：物化嵌套子 state 并注册父 subflows（AC-1）', () => {
  const sb = sandbox();
  try {
    writeState(sb.statePath, parentState(sb));
    const r = cli(['subflow', 'start', '--state', sb.statePath, '--at', 'plan', '--title', '调研 X'], sb);
    assert.strictEqual(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.strictEqual(out.subflowId, 'sf-1');
    assert.strictEqual(out.depth, 2);
    assert.strictEqual(out.workflow, 'basic');
    assert.deepStrictEqual(out.currentStage, ['requirement:01']);
    const childPath = path.join(sb.runDir, 'subflows', 'sf-1', '.state.json');
    assert.strictEqual(out.statePath, childPath);
    assert.ok(fs.existsSync(childPath));
    const child = JSON.parse(fs.readFileSync(childPath, 'utf8'));
    assert.strictEqual(child.subflow.depth, 2);
    assert.strictEqual(child.subflow.parentRunId, '20260101-000000-test');
    assert.strictEqual(child.subflow.atStage, 'plan');
    assert.strictEqual(child.dirs.runDir, path.join(sb.runDir, 'subflows', 'sf-1'));
    assert.deepStrictEqual(child.currentStage, ['requirement:01']);
    const parent = JSON.parse(fs.readFileSync(sb.statePath, 'utf8'));
    assert.strictEqual(parent.subflows.length, 1);
    assert.strictEqual(parent.subflows[0].id, 'sf-1');
    assert.strictEqual(parent.subflows[0].status, 'active');
  } finally {
    cleanup(sb);
  }
});

test('subflow start：--at 不在父 currentStage → exit 1', () => {
  const sb = sandbox();
  try {
    writeState(sb.statePath, parentState(sb));
    const r = cli(['subflow', 'start', '--state', sb.statePath, '--at', 'spec', '--title', 'x'], sb);
    assert.strictEqual(r.status, 1);
    assert.ok(r.stderr.includes('不在父 currentStage'));
  } finally {
    cleanup(sb);
  }
});

test('subflow start：depth=3 的子 state 再下沉 → exit 1 三层上限（AC-2）', () => {
  const sb = sandbox();
  try {
    const grandchild = parentState(sb, {
      runId: '20260101-000000-test-sf1-sf2',
      currentStage: ['plan:01'],
      subflow: { depth: 3, parentStatePath: path.join(sb.runDir, 'subflows', 'sf-1', '.state.json'), parentRunId: '20260101-000000-test-sf1', atStage: 'plan', title: '调研 X' },
    });
    const gcPath = path.join(sb.runDir, 'subflows', 'sf-1', 'subflows', 'sf-2', '.state.json');
    writeState(gcPath, grandchild);
    const r = cli(['subflow', 'start', '--state', gcPath, '--at', 'plan', '--title', '第四层'], sb);
    assert.strictEqual(r.status, 1);
    assert.ok(r.stderr.includes('三层上限'));
  } finally {
    cleanup(sb);
  }
});

test('subflow start：子流程 id 全 run 唯一（孙流程跳过已占 sf-1）→ sf-2、depth=3', () => {
  const sb = sandbox();
  try {
    writeState(sb.statePath, parentState(sb, { subflows: [activeEntry(sb)] }));
    const childPath = path.join(sb.runDir, 'subflows', 'sf-1', '.state.json');
    writeState(childPath, childState(sb, { currentStage: ['requirement:01'] }));
    const r = cli(['subflow', 'start', '--state', childPath, '--at', 'requirement', '--title', '孙流程'], sb);
    assert.strictEqual(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.strictEqual(out.subflowId, 'sf-2');
    assert.strictEqual(out.depth, 3);
    assert.strictEqual(out.statePath, path.join(sb.runDir, 'subflows', 'sf-1', 'subflows', 'sf-2', '.state.json'));
  } finally {
    cleanup(sb);
  }
});

test('subflow start：目标目录已存在（残留未注册）→ exit 1', () => {
  const sb = sandbox();
  try {
    // 目录残留但父注册表无对应条目（如历史中断）——编号复用 sf-1 时撞目录，fail fast
    const childPath = path.join(sb.runDir, 'subflows', 'sf-1', '.state.json');
    writeState(childPath, childState(sb, { currentStage: ['requirement:01'] }));
    writeState(sb.statePath, parentState(sb));
    const r = cli(['subflow', 'start', '--state', sb.statePath, '--at', 'plan', '--title', 'x'], sb);
    assert.strictEqual(r.status, 1);
    assert.ok(r.stderr.includes('已存在'));
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- 阻塞式（FR-5）

test('next：active 子流程存在 → exit 1 blocked:subflow-active；close 后恢复推进（AC-1）', () => {
  const sb = sandbox();
  try {
    const childPath = path.join(sb.runDir, 'subflows', 'sf-1', '.state.json');
    writeState(childPath, childState(sb, { currentStage: ['requirement:01'] }));
    writeState(sb.statePath, parentState(sb, { subflows: [activeEntry(sb, { statePath: childPath })] }));

    const blocked = cli(['next', '--state', sb.statePath], sb);
    assert.strictEqual(blocked.status, 1);
    const bo = JSON.parse(blocked.stdout);
    assert.strictEqual(bo.blocked, 'subflow-active');
    assert.strictEqual(bo.subflows.length, 1);

    // 子流程未终态：close 拒绝
    const early = cli(['subflow', 'close', '--state', sb.statePath, '--id', 'sf-1'], sb);
    assert.strictEqual(early.status, 1);
    assert.ok(early.stderr.includes('未到终态'));

    // 子流程终态后 close → 父 next 正常推进（plan:01 → plan:02 门相位）
    const done = JSON.parse(fs.readFileSync(childPath, 'utf8'));
    done.currentStage = [];
    writeState(childPath, done);
    const close = cli(['subflow', 'close', '--state', sb.statePath, '--id', 'sf-1'], sb);
    assert.strictEqual(close.status, 0, close.stderr);
    const parent = JSON.parse(fs.readFileSync(sb.statePath, 'utf8'));
    assert.strictEqual(parent.subflows[0].status, 'closed');
    assert.ok(parent.subflows[0].closedAt);

    const next = cli(['next', '--state', sb.statePath], sb);
    assert.strictEqual(next.status, 0, next.stderr);
    const no = JSON.parse(next.stdout);
    assert.strictEqual(no.advanced[0].to, 'plan:02');
    assert.strictEqual(no.blocked, undefined);
  } finally {
    cleanup(sb);
  }
});

test('next：旧 state（无 subflows 段）行为不变（AC-4）', () => {
  const sb = sandbox();
  try {
    writeState(sb.statePath, parentState(sb));
    const r = cli(['next', '--state', sb.statePath], sb);
    assert.strictEqual(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.strictEqual(out.advanced[0].to, 'plan:02');
    assert.strictEqual(out.blocked, undefined);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- close 边界

test('close：--abandon 跳过终态校验并标 abandoned', () => {
  const sb = sandbox();
  try {
    const childPath = path.join(sb.runDir, 'subflows', 'sf-1', '.state.json');
    writeState(childPath, childState(sb, { currentStage: ['requirement:01'] }));
    writeState(sb.statePath, parentState(sb, { subflows: [activeEntry(sb, { statePath: childPath })] }));
    const r = cli(['subflow', 'close', '--state', sb.statePath, '--id', 'sf-1', '--abandon'], sb);
    assert.strictEqual(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.strictEqual(out.closed.id, 'sf-1');
    assert.strictEqual(out.closed.abandoned, true);
    const parent = JSON.parse(fs.readFileSync(sb.statePath, 'utf8'));
    assert.strictEqual(parent.subflows[0].status, 'closed');
    assert.strictEqual(parent.subflows[0].abandoned, true);
    // 放弃收口后父 next 恢复
    const next = cli(['next', '--state', sb.statePath], sb);
    assert.strictEqual(next.status, 0, next.stderr);
  } finally {
    cleanup(sb);
  }
});

test('close：id 不存在 / 已 closed → exit 1', () => {
  const sb = sandbox();
  try {
    writeState(sb.statePath, parentState(sb));
    const miss = cli(['subflow', 'close', '--state', sb.statePath, '--id', 'sf-9'], sb);
    assert.strictEqual(miss.status, 1);
    assert.ok(miss.stderr.includes('不存在'));

    const childPath = path.join(sb.runDir, 'subflows', 'sf-1', '.state.json');
    writeState(childPath, childState(sb));
    writeState(sb.statePath, parentState(sb, {
      subflows: [{ ...activeEntry(sb, { statePath: childPath }), status: 'closed', closedAt: ISO }],
    }));
    const again = cli(['subflow', 'close', '--state', sb.statePath, '--id', 'sf-1'], sb);
    assert.strictEqual(again.status, 1);
    assert.ok(again.stderr.includes('已 closed'));
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- run finish 边界（DEC-5）

test('run finish：active 子流程拦截；收口后 finish 正常（AC-1）', () => {
  const sb = sandbox();
  try {
    const childPath = path.join(sb.runDir, 'subflows', 'sf-1', '.state.json');
    writeState(childPath, childState(sb));
    writeState(sb.statePath, parentState(sb, { subflows: [activeEntry(sb, { statePath: childPath })] }));
    const blocked = cli(['run', 'finish', '--state', sb.statePath, '--status', 'done'], sb);
    assert.strictEqual(blocked.status, 1);
    assert.strictEqual(JSON.parse(blocked.stdout).blocked, 'subflow-active');

    const close = cli(['subflow', 'close', '--state', sb.statePath, '--id', 'sf-1'], sb);
    assert.strictEqual(close.status, 0, close.stderr);
    const finish = cli(['run', 'finish', '--state', sb.statePath, '--status', 'done'], sb);
    assert.strictEqual(finish.status, 0, finish.stderr);
    assert.strictEqual(JSON.parse(finish.stdout).finalStatus !== undefined || JSON.parse(finish.stdout).finished !== undefined, true);
  } finally {
    cleanup(sb);
  }
});

test('run finish：子 state 不走 run finish → exit 1 提示 subflow close', () => {
  const sb = sandbox();
  try {
    const childPath = path.join(sb.runDir, 'subflows', 'sf-1', '.state.json');
    writeState(childPath, childState(sb, { currentStage: [] }));
    const r = cli(['run', 'finish', '--state', childPath, '--status', 'done'], sb);
    assert.strictEqual(r.status, 1);
    assert.ok(r.stderr.includes('subflow close'));
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- state 契约校验

test('assertState：subflows 非法形态硬失败（id 重复 / statePath 越界 / active 带 closedAt）', () => {
  const sb = sandbox();
  try {
    const childPath = path.join(sb.runDir, 'subflows', 'sf-1', '.state.json');
    writeState(childPath, childState(sb));
    const dup = parentState(sb, { subflows: [activeEntry(sb, { statePath: childPath }), activeEntry(sb, { id: 'sf-1', statePath: childPath })] });
    writeState(sb.statePath, dup);
    assert.ok(cli(['subflow', 'list', '--state', sb.statePath], sb).status === 1);

    const escape = parentState(sb, { subflows: [activeEntry(sb, { statePath: path.join(sb.dir, 'elsewhere', '.state.json') })] });
    writeState(sb.statePath, escape);
    assert.ok(cli(['subflow', 'list', '--state', sb.statePath], sb).status === 1);

    const staleClosed = parentState(sb, { subflows: [{ ...activeEntry(sb, { statePath: childPath }), closedAt: ISO }] });
    writeState(sb.statePath, staleClosed);
    assert.ok(cli(['subflow', 'list', '--state', sb.statePath], sb).status === 1);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- list / status 可观察性

test('subflow list 与 status：子流程可观察（无 subflows → 空清单不报错）', () => {
  const sb = sandbox();
  try {
    writeState(sb.statePath, parentState(sb));
    const ls = cli(['subflow', 'list', '--state', sb.statePath], sb);
    assert.strictEqual(ls.status, 0, ls.stderr);
    assert.deepStrictEqual(JSON.parse(ls.stdout).subflows, []);
    const st = cli(['status', '--state', sb.statePath], sb);
    assert.strictEqual(st.status, 0, st.stderr);
    assert.ok(!st.stdout.includes('subflows')); // 无子流程时 status 不带该字段（可选段语义）

    const childPath = path.join(sb.runDir, 'subflows', 'sf-1', '.state.json');
    writeState(childPath, childState(sb, { currentStage: ['requirement:01'] }));
    writeState(sb.statePath, parentState(sb, { subflows: [activeEntry(sb, { statePath: childPath })] }));
    const ls2 = cli(['subflow', 'list', '--state', sb.statePath], sb);
    assert.strictEqual(JSON.parse(ls2.stdout).subflows[0].id, 'sf-1');
    const st2 = cli(['status', '--state', sb.statePath], sb);
    const so = JSON.parse(st2.stdout);
    assert.strictEqual(so.subflows[0].status, 'active');
    assert.ok(so.availableCommands.some((c) => c.cmd.includes(childPath)));
  } finally {
    cleanup(sb);
  }
});
