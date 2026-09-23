'use strict';
// tools/tests/start.test.js — run start 装配行为测试（06 plan v1.0 契约）。
//
// 隔离约定（同 cli.test.js）：每用例 mkdtemp 独立沙箱，DDO_HOME 指向沙箱内，
// project 也在沙箱内（state / .ddo 目录只写沙箱）；finally 递归删除，不触碰真实 ~/.ddo。
// 原子任务与预设直接读仓库 atom-tasks/、workflows/（只读）；坏预设写在沙箱内经 --workflows-dir 传入。

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI = path.join(__dirname, '..', 'cli.js');

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddo-start-test-'));
  return { dir, ddoHome: path.join(dir, 'ddo-home'), project: path.join(dir, 'project'), wf: path.join(dir, 'wf') };
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

function writePreset(sb, name, body) {
  fs.mkdirSync(sb.wf, { recursive: true });
  fs.writeFileSync(path.join(sb.wf, `${name}.json`), JSON.stringify(body));
}

// ---------------------------------------------------------------- run start 成功路径

test('run start：物化 state（basic 五阶段）+ 注册 index', () => {
  const sb = sandbox();
  try {
    const r = cli(['run', 'start', '--title', '链路冒烟', '--project', sb.project], sb);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.match(out.runId, /^\d{8}-\d{6}-[0-9a-f]{4}$/);
    assert.equal(out.workflow, 'basic');
    assert.deepStrictEqual(out.currentStage, ['requirement:01']);
    assert.equal(out.title, '链路冒烟');

    // state 结构（02 §5）
    const state = JSON.parse(fs.readFileSync(out.statePath, 'utf8'));
    assert.equal(state.runId, out.runId);
    assert.equal(state.title, '链路冒烟');
    assert.deepStrictEqual(state.currentStage, ['requirement:01']);
    assert.equal(Object.keys(state.stages).length, 5);
    assert.equal(state.stages.requirement.status, 'running'); // 首相位 action → running（P2）
    assert.equal(state.stages.spec.status, 'pending');
    assert.deepStrictEqual(state.stages.spec.dependOn, ['requirement']);
    assert.deepStrictEqual(state.atomTasks, {});
    // 非 git 沙箱 → mainBranch 为空串（D5：字段必存、值可空）
    assert.strictEqual(state.git.mainBranch, '');

    // index 注册（02 §4：纯指针）
    const idx = JSON.parse(fs.readFileSync(path.join(sb.ddoHome, 'index.json'), 'utf8'));
    assert.ok(idx[out.runId]);
    assert.equal(idx[out.runId].statePath, out.statePath);
    assert.ok(idx[out.runId].startedAt);
  } finally {
    cleanup(sb);
  }
});

test('run start：目录布局 .ddo/runs/<type>/<dirName>，index 含 startedAt', () => {
  const sb = sandbox();
  try {
    const r = cli(['run', 'start', '--title', 't', '--project', sb.project, '--type', 'fix', '--dir-name', 'my-run'], sb);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.statePath, path.join(sb.project, '.ddo', 'runs', 'fix', 'my-run', '.state.json'));
  } finally {
    cleanup(sb);
  }
});

test('run start：git 仓库 → mainBranch 走推断链（init.defaultBranch 档）', () => {
  const sb = sandbox();
  try {
    fs.mkdirSync(sb.project, { recursive: true });
    spawnSync('git', ['init', '-q'], { cwd: sb.project });
    spawnSync('git', ['config', 'init.defaultBranch', 'trunk'], { cwd: sb.project });
    const r = cli(['run', 'start', '--title', 't', '--project', sb.project], sb);
    assert.equal(r.status, 0, r.stderr);
    const state = JSON.parse(fs.readFileSync(JSON.parse(r.stdout).statePath, 'utf8'));
    assert.equal(state.git.mainBranch, 'trunk');
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- 预设校验 fail fast

test('run start：任务不存在 → exit 1（不产生半截 run）', () => {
  const sb = sandbox();
  try {
    writePreset(sb, 'bad-task', { name: 'bad-task', version: '1.0.0', stages: [{ task: 'no-such-task', dependOn: [] }] });
    const r = cli(['run', 'start', '--title', 't', '--project', sb.project, '--workflow', 'bad-task', '--workflows-dir', sb.wf], sb);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /原子任务不存在/);
    assert.ok(!fs.existsSync(path.join(sb.project, '.ddo'))); // 无半截产物
    assert.ok(!fs.existsSync(path.join(sb.ddoHome, 'index.json'))); // index 未注册
  } finally {
    cleanup(sb);
  }
});

test('run start：DAG 有环 → exit 1', () => {
  const sb = sandbox();
  try {
    writePreset(sb, 'cycle', {
      name: 'cycle', version: '1.0.0',
      stages: [
        { task: 'requirement', dependOn: ['spec'] },
        { task: 'spec', dependOn: ['requirement'] },
      ],
    });
    const r = cli(['run', 'start', '--title', 't', '--project', sb.project, '--workflow', 'cycle', '--workflows-dir', sb.wf], sb);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /存在环/);
  } finally {
    cleanup(sb);
  }
});

test('run start：任务重复出现 → exit 1', () => {
  const sb = sandbox();
  try {
    writePreset(sb, 'dup', {
      name: 'dup', version: '1.0.0',
      stages: [
        { task: 'requirement', dependOn: [] },
        { task: 'requirement', dependOn: [] },
      ],
    });
    const r = cli(['run', 'start', '--title', 't', '--project', sb.project, '--workflow', 'dup', '--workflows-dir', sb.wf], sb);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /任务重复出现/);
  } finally {
    cleanup(sb);
  }
});

test('run start：dependOn 引用不存在 → exit 1；预设文件不存在 → exit 1', () => {
  const sb = sandbox();
  try {
    writePreset(sb, 'badref', {
      name: 'badref', version: '1.0.0',
      stages: [{ task: 'requirement', dependOn: ['ghost'] }],
    });
    const r1 = cli(['run', 'start', '--title', 't', '--project', sb.project, '--workflow', 'badref', '--workflows-dir', sb.wf], sb);
    assert.equal(r1.status, 1);
    assert.match(r1.stderr, /引用不存在的 stage: ghost/);

    const r2 = cli(['run', 'start', '--title', 't', '--project', sb.project, '--workflow', 'ghost', '--workflows-dir', sb.wf], sb);
    assert.equal(r2.status, 1);
    assert.match(r2.stderr, /预设不存在/);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- 参数边界

test('run start：--dir-name 含路径段 → exit 2（用法错误）', () => {
  const sb = sandbox();
  try {
    const r = cli(['run', 'start', '--title', 't', '--project', sb.project, '--dir-name', 'a/b'], sb);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /dir-name 非法/);
  } finally {
    cleanup(sb);
  }
});

test('run start：运行目录已存在（同 --dir-name 二次启动）→ exit 1', () => {
  const sb = sandbox();
  try {
    const first = cli(['run', 'start', '--title', 't1', '--project', sb.project, '--dir-name', 'dup-run'], sb);
    assert.equal(first.status, 0, first.stderr);
    const second = cli(['run', 'start', '--title', 't2', '--project', sb.project, '--dir-name', 'dup-run'], sb);
    assert.equal(second.status, 1);
    assert.match(second.stderr, /运行目录已存在/);
    // index 中只有第一次的注册
    const idx = JSON.parse(fs.readFileSync(path.join(sb.ddoHome, 'index.json'), 'utf8'));
    assert.equal(Object.keys(idx).length, 1);
  } finally {
    cleanup(sb);
  }
});
