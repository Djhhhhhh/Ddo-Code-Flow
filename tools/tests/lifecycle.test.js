'use strict';
// tools/tests/lifecycle.test.js — 产物生命周期测试（11 plan §6）。
//
// 覆盖：dirs 字段（run start 物化 + 历史 state 缺失容错）/ state 结束归档
// （~/.ddo/history/<runId>/，幂等覆盖，原文件不动）/ _del 回滚归档（移动语义、
// 重置集合汇总同一 rollback-n、缺失跳过、重做产新文件）/ output 声明防逃逸
// （validateTaskConfig 语义层 + runValidate 运行时双保险）。
// 隔离约定同前：mkdtemp 沙箱 + DDO_HOME 指内 + finally 递归删除；
// 手写 state 与测试原子任务落沙箱，run start 场景读仓库 atom-tasks/（只读）。

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI = path.join(__dirname, '..', 'cli.js');
const { validateTaskConfig } = require(path.join(__dirname, '..', 'lib', 'workflow'));

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddo-life-test-'));
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

/** 沙箱原子任务：<dir>/<name>/{config.json, prompt.md}；cfg 补齐 name/version。 */
function putTask(tasksDir, name, cfg) {
  const dir = path.join(tasksDir, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ name, version: '2.0.0', ...cfg }, null, 2));
  fs.writeFileSync(path.join(dir, 'prompt.md'), `# ${name}\n`);
  return dir;
}

/**
 * 手写 state（含 dirs）并落盘；返回 statePath。
 * stages 形如 { spec: { status, dependOn } }，at/dirs 自动补齐。
 */
function putState(sb, { runId, currentStage, stages, withDirs = true }) {
  const project = path.join(sb.dir, 'proj', runId);
  const runDir = path.join(project, '.ddo', 'runs', 'feat', runId);
  fs.mkdirSync(runDir, { recursive: true });
  const state = {
    runId,
    title: `t-${runId}`,
    startedAt: '2026-09-24T09:00:00+08:00',
    git: {},
    currentStage,
    stages: Object.fromEntries(
      Object.entries(stages).map(([id, s]) => [id, { at: 't', ...s }])
    ),
    atomTasks: {},
  };
  if (withDirs) state.dirs = { projectRoot: project, runDir };
  const statePath = path.join(runDir, '.state.json');
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  return statePath;
}

// ---------------------------------------------------------------- dirs 字段

test('run start 物化 dirs：两绝对路径且 runDir ⊂ projectRoot；历史 state 缺 dirs → 命令容错回落 dirname', () => {
  const sb = sandbox();
  try {
    const proj = path.join(sb.dir, 'proj');
    const r = cli(['run', 'start', '--project', proj, '--title', 'dirs 定版', '--dir-name', 'd1'], sb);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    const state = JSON.parse(fs.readFileSync(out.statePath, 'utf8'));
    assert.equal(state.dirs.projectRoot, proj);
    assert.equal(state.dirs.runDir, path.dirname(out.statePath));
    assert.ok(state.dirs.runDir.startsWith(proj + path.sep), 'runDir 必须位于 projectRoot 之内');

    // 历史 state（无 dirs）：rollback / validate 以 dirname(statePath) 为锚，不炸
    const tasksDir = path.join(sb.dir, 'tasks');
    putTask(tasksDir, 'spec', { output: 'spec.md' });
    putTask(tasksDir, 'plan', { output: 'plan.md' });
    const statePath = putState(sb, {
      runId: 'legacy1',
      currentStage: ['plan:01'],
      stages: { spec: { status: 'done', dependOn: [] }, plan: { status: 'running', dependOn: ['spec'] } },
      withDirs: false,
    });
    fs.writeFileSync(path.join(path.dirname(statePath), 'spec.md'), '旧 spec');
    fs.writeFileSync(path.join(path.dirname(statePath), 'plan.md'), '旧 plan');

    const v = cli(['validate', '--state', statePath, '--task', 'plan', '--tasks-dir', tasksDir], sb);
    assert.equal(v.status, 0, v.stderr);

    const rb = cli(['rollback', '--state', statePath, '--stage', 'spec', '--tasks-dir', tasksDir], sb);
    assert.equal(rb.status, 0, rb.stderr);
    const rout = JSON.parse(rb.stdout);
    assert.equal(rout.archivedTo, '_del/rollback-1'); // 锚点回落正确（_del 落在 state 所在目录）
    assert.ok(fs.existsSync(path.join(path.dirname(statePath), '_del', 'rollback-1', 'spec.md')));
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- state 结束归档

test('run finish 归档 state 副本到 ~/.ddo/history/<runId>/：收束前位置保留、原文件不动、重复 finish 幂等', () => {
  const sb = sandbox();
  try {
    const proj = path.join(sb.dir, 'proj');
    const r = cli(['run', 'start', '--project', proj, '--title', '归档验证', '--dir-name', 'd2'], sb);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    const statePath = out.statePath;

    const f1 = cli(['run', 'finish', '--state', statePath, '--status', 'aborted'], sb);
    assert.equal(f1.status, 0, f1.stderr);

    const archive = path.join(sb.ddoHome, 'history', out.runId, '.state.json');
    assert.ok(fs.existsSync(archive), '归档副本应存在');
    const archived = JSON.parse(fs.readFileSync(archive, 'utf8'));
    assert.equal(archived.runId, out.runId);
    assert.deepEqual(archived.currentStage, out.currentStage, '归档保留收束前最后位置（先归档后清空）');

    const original = JSON.parse(fs.readFileSync(statePath, 'utf8')); // 原文件仍在，随项目版控走
    assert.deepEqual(original.currentStage, []);

    const jsonl = fs.readFileSync(path.join(sb.ddoHome, 'history', 'runs.jsonl'), 'utf8');
    assert.ok(jsonl.includes(`"runId":"${out.runId}"`));

    const f2 = cli(['run', 'finish', '--state', statePath, '--status', 'aborted'], sb);
    assert.equal(f2.status, 0, f2.stderr); // 幂等覆盖，不报错
    assert.ok(fs.existsSync(archive));
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- _del 回滚归档

test('rollback 激活 _del 归档：重置集合汇总同一 rollback-n、移动语义、编号递增、重做产新文件', () => {
  const sb = sandbox();
  try {
    const tasksDir = path.join(sb.dir, 'tasks');
    putTask(tasksDir, 'spec', { output: 'spec.md' });
    putTask(tasksDir, 'plan', { output: 'plan.md' });
    const statePath = putState(sb, {
      runId: 'del1',
      currentStage: ['plan:01'],
      stages: { spec: { status: 'done', dependOn: [] }, plan: { status: 'running', dependOn: ['spec'] } },
    });
    const runDir = path.dirname(statePath);
    fs.writeFileSync(path.join(runDir, 'spec.md'), 'v1 spec');
    fs.writeFileSync(path.join(runDir, 'plan.md'), 'v1 plan');

    // ① 一次 rollback 重置集合 {spec, plan}：两文件同入 rollback-1，原位消失
    const rb1 = cli(['rollback', '--state', statePath, '--stage', 'spec', '--tasks-dir', tasksDir], sb);
    assert.equal(rb1.status, 0, rb1.stderr);
    const o1 = JSON.parse(rb1.stdout);
    assert.equal(o1.archivedTo, '_del/rollback-1');
    assert.deepEqual([...o1.archived].sort(), ['plan.md', 'spec.md']);
    assert.ok(!fs.existsSync(path.join(runDir, 'spec.md')) && !fs.existsSync(path.join(runDir, 'plan.md')), '移动语义：原位消失');
    assert.equal(fs.readFileSync(path.join(runDir, '_del', 'rollback-1', 'spec.md'), 'utf8'), 'v1 spec');

    // ② 重做产新文件；再回滚 → rollback-2（扫描目录推导编号），旧版留在 rollback-1
    fs.writeFileSync(path.join(runDir, 'spec.md'), 'v2 spec');
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    state.stages.spec.status = 'done';
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    const rb2 = cli(['rollback', '--state', statePath, '--stage', 'spec', '--tasks-dir', tasksDir], sb);
    assert.equal(rb2.status, 0, rb2.stderr);
    assert.equal(JSON.parse(rb2.stdout).archivedTo, '_del/rollback-2');
    assert.equal(fs.readFileSync(path.join(runDir, '_del', 'rollback-2', 'spec.md'), 'utf8'), 'v2 spec');
    assert.equal(fs.readFileSync(path.join(runDir, '_del', 'rollback-1', 'spec.md'), 'utf8'), 'v1 spec');

    // ③ 重做后的新文件落 runDir（不在 _del 里混放）
    fs.writeFileSync(path.join(runDir, 'spec.md'), 'v3 spec');
    assert.ok(fs.existsSync(path.join(runDir, 'spec.md')));
  } finally {
    cleanup(sb);
  }
});

test('rollback 产物缺失：跳过不报错，不产生空 rollback-n 目录', () => {
  const sb = sandbox();
  try {
    const tasksDir = path.join(sb.dir, 'tasks');
    putTask(tasksDir, 'spec', { output: 'spec.md' });
    const statePath = putState(sb, {
      runId: 'del2',
      currentStage: ['spec:01'],
      stages: { spec: { status: 'done', dependOn: [] } },
    });
    const rb = cli(['rollback', '--state', statePath, '--stage', 'spec', '--tasks-dir', tasksDir], sb);
    assert.equal(rb.status, 0, rb.stderr);
    const out = JSON.parse(rb.stdout);
    assert.equal(out.archivedTo, undefined);
    assert.equal(out.archived, undefined);
    assert.ok(!fs.existsSync(path.join(path.dirname(statePath), '_del')), '无产物可归档时不建目录');
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- tasksDir 自包含（12 D1）

test('run start 记录 dirs.tasksDir：自定义链后续命令免 flag 读 state，门决议正常走通', () => {
  const sb = sandbox();
  try {
    // 自定义任务目录 + 临时预设（10 引导的自定义链形态）
    const tasksDir = path.join(sb.dir, 'tasks');
    putTask(tasksDir, 'alpha', {
      phases: [
        { id: '01', type: 'action', output: 'alpha.md' },
        { id: '02', type: 'human', gate: { options: [{ name: '同意', desc: '通过', action: 'next --decision 同意' }] } },
      ],
    });
    const wfDir = path.join(sb.dir, 'wf');
    fs.mkdirSync(wfDir, { recursive: true });
    fs.writeFileSync(path.join(wfDir, 'alpha-only.json'), JSON.stringify({
      name: 'alpha-only', version: '1.0.0',
      stages: [{ task: 'alpha', dependOn: [] }],
    }));

    const proj = path.join(sb.dir, 'proj');
    const r = cli([
      'run', 'start', '--project', proj, '--title', '自包含', '--dir-name', 'd3',
      '--tasks-dir', tasksDir, '--workflows-dir', wfDir, '--workflow', 'alpha-only',
    ], sb);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    const state = JSON.parse(fs.readFileSync(out.statePath, 'utf8'));
    assert.equal(state.dirs.tasksDir, tasksDir, '启动时任务目录记入 state');

    // 后续命令一律不带 --tasks-dir：位置推进 / 门注册 / 决议全部经 state 内声明解析
    const n1 = cli(['next', '--state', out.statePath], sb);
    assert.equal(n1.status, 0, n1.stderr);
    assert.ok(JSON.parse(n1.stdout).openedGates.length, 'human 相位开门（phaseType 读自定义 config）');

    const blocked = cli(['next', '--state', out.statePath], sb);
    assert.equal(blocked.status, 1);
    assert.match(blocked.stderr, /同意/);

    const n2 = cli(['next', '--state', out.statePath, '--decision', '同意'], sb);
    assert.equal(n2.status, 0, n2.stderr);
    assert.equal(JSON.parse(n2.stdout).completed, true);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- 防逃逸

test('output 声明防逃逸：validateTaskConfig 拒绝 .. 与绝对路径（顶层 / 相位级 updates）', () => {
  assert.equal(validateTaskConfig({ name: 't1', version: '2.0.0', output: 'spec.md' }, 't1'), true);
  assert.throws(() => validateTaskConfig({ name: 't1', version: '2.0.0', output: '../evil.md' }, 't1'), /非法/);
  assert.throws(() => validateTaskConfig({ name: 't1', version: '2.0.0', output: '/etc/passwd' }, 't1'), /非法/);
  assert.throws(
    () => validateTaskConfig({ name: 't1', version: '2.0.0', phases: [{ id: '01', output: { updates: ['../x.md'] } }] }, 't1'),
    /非法/
  );
});

test('runValidate 运行时防逃逸：非法声明在拼路径前被拦（exit 1，不触产物）', () => {
  const sb = sandbox();
  try {
    const tasksDir = path.join(sb.dir, 'tasks');
    putTask(tasksDir, 'evil1', { output: '../evil.md' });
    putTask(tasksDir, 'evil2', { output: path.join(sb.dir, 'abs.md') });
    for (const name of ['evil1', 'evil2']) {
      const statePath = putState(sb, {
        runId: name,
        currentStage: [`${name}:01`],
        stages: { [name]: { status: 'running', dependOn: [] } },
      });
      const r = cli(['validate', '--state', statePath, '--task', name, '--tasks-dir', tasksDir], sb);
      assert.equal(r.status, 1, `${name} 应被拦截`);
      assert.match(r.stderr, /产物声明非法|产物声明越界/);
    }
  } finally {
    cleanup(sb);
  }
});
