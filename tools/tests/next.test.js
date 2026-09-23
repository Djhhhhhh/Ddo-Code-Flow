'use strict';
// tools/tests/next.test.js — next 推进行为测试（06 plan v1.0 契约）。
//
// 隔离约定（同 cli.test.js）：每用例 mkdtemp 独立沙箱，DDO_HOME 指向沙箱内，
// state 手写在沙箱 run 目录（basic 链的 stages 形态）；finally 递归删除。
// 原子任务直接读仓库 atom-tasks/（只读）——相位声明以任务 config 为准（D4）。

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI = path.join(__dirname, '..', 'cli.js');

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddo-next-test-'));
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

/** basic 链 stages 骨架；overrides 覆盖单个阶段条目。 */
function basicStages(overrides = {}) {
  const base = {};
  for (const [id, dependOn] of [
    ['requirement', []],
    ['spec', ['requirement']],
    ['plan', ['spec']],
    ['coding', ['plan']],
    ['reporting', ['coding']],
  ]) {
    base[id] = { status: 'pending', dependOn, at: '2026-09-22T18:00:00+08:00' };
  }
  return Object.assign(base, overrides);
}

function writeState(sb, currentStage, stages) {
  fs.mkdirSync(sb.runDir, { recursive: true });
  fs.writeFileSync(
    sb.statePath,
    JSON.stringify({
      runId: '20260922-180000-next1',
      title: 'next 测试',
      startedAt: '2026-09-22T18:00:00+08:00',
      git: { mainBranch: 'main' },
      currentStage,
      stages,
      atomTasks: {},
    })
  );
}

const readBack = (sb) => JSON.parse(fs.readFileSync(sb.statePath, 'utf8'));

// ---------------------------------------------------------------- 相位内 / 跨阶段

test('next：单相位任务（requirement:01）→ 阶段 done + spec 就绪点亮', () => {
  const sb = sandbox();
  try {
    writeState(sb, ['requirement:01'], basicStages({ requirement: { status: 'running', dependOn: [], at: '2026-09-22T18:00:00+08:00' } }));
    const r = cli(['next', '--state', sb.statePath], sb);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.deepStrictEqual(out.finished, ['requirement']);
    assert.deepStrictEqual(out.advanced, []);
    assert.deepStrictEqual(out.activated, ['spec']);
    assert.deepStrictEqual(out.currentStage, ['spec:01']);
    assert.equal(out.completed, false);

    const state = readBack(sb);
    assert.equal(state.stages.requirement.status, 'done');
    assert.equal(state.stages.spec.status, 'running'); // spec:01 是 action 相位
    assert.deepStrictEqual(state.currentStage, ['spec:01']);
  } finally {
    cleanup(sb);
  }
});

test('next：spec:01 → :02（相位内推进，human 相位置 waiting-human + 开门）', () => {
  const sb = sandbox();
  try {
    const done = { status: 'done', dependOn: [], at: '2026-09-22T18:00:00+08:00' };
    writeState(sb, ['spec:01'], basicStages({
      requirement: done,
      spec: { status: 'running', dependOn: ['requirement'], at: '2026-09-22T18:00:00+08:00' },
    }));
    const r = cli(['next', '--state', sb.statePath], sb);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.deepStrictEqual(out.advanced, [{ stage: 'spec', from: 'spec:01', to: 'spec:02' }]);
    assert.deepStrictEqual(out.finished, []);
    assert.deepStrictEqual(out.activated, []); // 无阶段收尾 → 不触发 DAG 推进
    assert.deepStrictEqual(out.currentStage, ['spec:02']);

    // 07：进入 human 相位即写门（spec:02 已声明 gate.options——v1.4 用户词汇 + in-phase）
    assert.deepStrictEqual(out.openedGates, [{
      stage: 'spec', phase: '02',
      options: [
        { name: '同意', desc: '批准当前 spec（仅当不存在未解决 BQ），本相位完成', action: 'next --decision 同意' },
        { name: '驳回', desc: '回滚 spec 阶段，按意见回到相位 01 重新生成', action: 'rollback --stage spec' },
        { name: '修改', desc: '把反馈作为新的需求证据更新受影响条目，展示变化摘要后重新送审', action: 'in-phase' },
        { name: '提问', desc: '只读答疑，不修改 spec、不改变任何 ID 与确认状态', action: 'in-phase' },
      ],
    }]);
    assert.deepStrictEqual(out.closedGates, []);

    const state = readBack(sb);
    assert.equal(state.stages.spec.status, 'waiting-human'); // P2：数据先行
    assert.deepStrictEqual(state.currentStage, ['spec:02']);
    const gate = state.stages.spec.gate;
    assert.equal(gate.phase, '02');
    assert.ok(gate.openedAt);
    assert.equal(gate.options.length, 4); // v1.4：spec 声明 同意/驳回/修改/提问
    assert.equal(gate.decision, undefined); // 开着
  } finally {
    cleanup(sb);
  }
});

test('next：spec:02（相位耗尽）→ spec done + plan 就绪', () => {
  const sb = sandbox();
  try {
    const done = { status: 'done', dependOn: [], at: '2026-09-22T18:00:00+08:00' };
    // 门已由用户决议关闭（decision 落盘）→ 正常推进
    writeState(sb, ['spec:02'], basicStages({
      requirement: done,
      spec: {
        status: 'waiting-human', dependOn: ['requirement'], at: '2026-09-22T18:00:00+08:00',
        gate: {
          phase: '02', openedAt: '2026-09-22T18:01:00+08:00',
          options: [{ name: 'approve', desc: '确认通过', action: 'next --decision approve' }],
          decision: 'approve', closedAt: '2026-09-22T18:02:00+08:00',
        },
      },
    }));
    const r = cli(['next', '--state', sb.statePath], sb);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.deepStrictEqual(out.finished, ['spec']);
    assert.deepStrictEqual(out.activated, ['plan']);
    assert.deepStrictEqual(out.currentStage, ['plan:01']);
    const state = readBack(sb);
    assert.equal(state.stages.spec.status, 'done');
    assert.equal(state.stages.plan.status, 'running');
    assert.equal(state.stages.spec.gate.decision, 'approve'); // 留痕保留
  } finally {
    cleanup(sb);
  }
});

test('next：reporting:01（终点）→ 全链完成，completed=true，不自动 run finish', () => {
  const sb = sandbox();
  try {
    const done = (dependOn, at = '2026-09-22T18:00:00+08:00') => ({ status: 'done', dependOn, at });
    writeState(sb, ['reporting:01'], basicStages({
      requirement: done([]),
      spec: done(['requirement']),
      plan: done(['spec']),
      coding: done(['plan']),
      reporting: { status: 'running', dependOn: ['coding'], at: '2026-09-22T18:00:00+08:00' },
    }));
    const r = cli(['next', '--state', sb.statePath], sb);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.deepStrictEqual(out.finished, ['reporting']);
    assert.deepStrictEqual(out.activated, []);
    assert.deepStrictEqual(out.currentStage, []);
    assert.equal(out.completed, true);
    const state = readBack(sb);
    assert.equal(state.stages.reporting.status, 'done');
    assert.deepStrictEqual(state.currentStage, []);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- 边界报错

test('next：currentStage 为空 → exit 1（run 已结束或未启动）', () => {
  const sb = sandbox();
  try {
    writeState(sb, [], basicStages());
    const r = cli(['next', '--state', sb.statePath], sb);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /无待推进阶段/);
  } finally {
    cleanup(sb);
  }
});

test('next：相位未在任务声明（requirement:02）→ exit 1', () => {
  const sb = sandbox();
  try {
    writeState(sb, ['requirement:02'], basicStages({ requirement: { status: 'running', dependOn: [], at: '2026-09-22T18:00:00+08:00' } }));
    const r = cli(['next', '--state', sb.statePath], sb);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /相位 02 未在任务 requirement 声明/);
  } finally {
    cleanup(sb);
  }
});
