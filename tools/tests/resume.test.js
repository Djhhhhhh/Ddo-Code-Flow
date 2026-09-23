'use strict';
// tools/tests/resume.test.js — resume 断点重续发现层测试（08 plan 契约：D1–D5）。
//
// 覆盖：全局清单（D2）/ 一律先列清单（D3）/ --run-id 完整视图（与 status 同构）/
// 惰性校验（stale 不展示 + 待收束展示，D4）/ --project 过滤 / 空 index。
// 隔离约定同前：mkdtemp 沙箱 + DDO_HOME 指内 + finally 递归删除；
// index 与 state 手写在沙箱内，原子任务读仓库 atom-tasks/（只读）。

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI = path.join(__dirname, '..', 'cli.js');

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddo-resume-test-'));
  return { dir, ddoHome: path.join(dir, 'ddo-home') };
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

/** 在沙箱内物化一个 run：写 state 文件并登记 index；返回 statePath。 */
function putRun(sb, { runId, project, type = 'feat', dirName = runId, currentStage, stages, title = runId }) {
  const runDir = path.join(project, '.ddo', 'runs', type, dirName);
  fs.mkdirSync(runDir, { recursive: true });
  const statePath = path.join(runDir, '.state.json');
  fs.writeFileSync(statePath, JSON.stringify({
    runId,
    title,
    startedAt: '2026-09-24T09:00:00+08:00',
    git: { mainBranch: 'main' },
    currentStage,
    stages,
    atomTasks: {},
  }));
  register(sb, runId, statePath);
  return statePath;
}

/** 手写 index 条目（含 stale 场景）。 */
function register(sb, runId, statePath) {
  fs.mkdirSync(sb.ddoHome, { recursive: true });
  const idxPath = path.join(sb.ddoHome, 'index.json');
  const idx = fs.existsSync(idxPath) ? JSON.parse(fs.readFileSync(idxPath, 'utf8')) : {};
  idx[runId] = { statePath, startedAt: '2026-09-24T09:00:00+08:00' };
  fs.writeFileSync(idxPath, JSON.stringify(idx));
}

const DONE = (dependOn, at = 't') => ({ status: 'done', dependOn, at });

/** spec 停在 :02 且门开着（带声明选项）的 stages。 */
const specGateStages = () => ({
  requirement: DONE([]),
  spec: {
    status: 'waiting-human', dependOn: ['requirement'], at: 't',
    gate: {
      phase: '02', openedAt: 't',
      options: [
        { name: '同意', desc: '批准当前 spec（仅当不存在未解决 BQ），本相位完成', action: 'next --decision 同意' },
        { name: '驳回', desc: '回滚 spec 阶段，按意见回到相位 01 重新生成', action: 'rollback --stage spec' },
        { name: '修改', desc: '把反馈作为新的需求证据更新受影响条目，展示变化摘要后重新送审', action: 'in-phase' },
        { name: '提问', desc: '只读答疑，不修改 spec、不改变任何 ID 与确认状态', action: 'in-phase' },
      ],
    },
  },
  plan: { status: 'pending', dependOn: ['spec'], at: 't' },
});

// ---------------------------------------------------------------- 发现层

test('resume 无参：全局清单（一律先列）——位置/门概要 + 待收束标记 + stale 计数', () => {
  const sb = sandbox();
  try {
    putRun(sb, { runId: 'r1', project: path.join(sb.dir, 'projA'), currentStage: ['spec:02'], stages: specGateStages(), title: '带门运行' });
    putRun(sb, { runId: 'r2', project: path.join(sb.dir, 'projB'), currentStage: ['coding:01'], stages: { coding: { status: 'running', dependOn: [], at: 't' } } });
    putRun(sb, { runId: 'r3', project: path.join(sb.dir, 'projA'), currentStage: [], stages: { reporting: DONE(['coding']) } });
    register(sb, 'r4', path.join(sb.dir, 'ghost', '.state.json')); // statePath 失效

    const r = cli(['resume'], sb);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.runs.length, 3);
    assert.equal(out.staleCount, 1); // r4 惰性校验淘汰
    assert.match(out.hint, /--run-id/);

    const r1 = out.runs.find((x) => x.runId === 'r1');
    assert.equal(r1.title, '带门运行');
    assert.equal(r1.projectRoot, path.join(sb.dir, 'projA'));
    assert.equal(r1.type, 'feat');
    assert.deepEqual(r1.currentStage, [{ stage: 'spec', phase: '02', phaseType: 'human', gateOpen: true }]);
    assert.equal(r1.completable, undefined);

    const r2 = out.runs.find((x) => x.runId === 'r2');
    assert.deepEqual(r2.currentStage, [{ stage: 'coding', phase: '01', phaseType: 'action' }]);

    const r3 = out.runs.find((x) => x.runId === 'r3');
    assert.deepEqual(r3.currentStage, []);
    assert.equal(r3.completable, true); // 待收束仍展示（D4 细化）
    assert.match(r3.note, /待收束/);
  } finally {
    cleanup(sb);
  }
});

test('resume --run-id：完整状态视图（与 status 同构）+ 元数据；未知 runId → exit 1', () => {
  const sb = sandbox();
  try {
    const statePath = putRun(sb, { runId: 'r1', project: path.join(sb.dir, 'projA'), currentStage: ['spec:02'], stages: specGateStages() });

    const r = cli(['resume', '--run-id', 'r1'], sb);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.runId, 'r1');
    assert.equal(out.statePath, statePath);
    assert.equal(out.projectRoot, path.join(sb.dir, 'projA'));
    // 门视图（07 双清单同构）
    assert.deepEqual(out.gateOptions.map((o) => o.name), ['同意', '驳回', '修改', '提问']);
    const named = out.availableCommands.filter((o) => o.name);
    assert.deepEqual(named.map((o) => o.name), ['同意', '驳回']);
    assert.match(named[0].cmd, new RegExp(`^next --state ${statePath} --decision 同意$`));

    const bad = cli(['resume', '--run-id', 'nope'], sb);
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /未知 runId/);
  } finally {
    cleanup(sb);
  }
});

test('resume --project 过滤：只列 statePath 前缀匹配的 run；--run-id 指向 stale → exit 1', () => {
  const sb = sandbox();
  try {
    putRun(sb, { runId: 'r1', project: path.join(sb.dir, 'projA'), currentStage: ['coding:01'], stages: { coding: { status: 'running', dependOn: [], at: 't' } } });
    putRun(sb, { runId: 'r2', project: path.join(sb.dir, 'projB'), currentStage: ['coding:01'], stages: { coding: { status: 'running', dependOn: [], at: 't' } } });
    register(sb, 'r3', path.join(sb.dir, 'ghost', '.state.json'));

    const only = cli(['resume', '--project', path.join(sb.dir, 'projA')], sb);
    assert.equal(only.status, 0, only.stderr);
    const out = JSON.parse(only.stdout);
    assert.deepEqual(out.runs.map((x) => x.runId), ['r1']);
    assert.equal(out.staleCount, 0); // projA 之外的不参与惰性校验计数

    const stale = cli(['resume', '--run-id', 'r3'], sb);
    assert.equal(stale.status, 1);
    assert.match(stale.stderr, /失效/);
  } finally {
    cleanup(sb);
  }
});

test('resume 空 index：runs 空 + 引导提示，exit 0', () => {
  const sb = sandbox();
  try {
    const r = cli(['resume'], sb);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.deepEqual(out.runs, []);
    assert.equal(out.staleCount, 0);
    assert.match(out.hint, /run start/);
    assert.match(out.hint, /history/);
  } finally {
    cleanup(sb);
  }
});
