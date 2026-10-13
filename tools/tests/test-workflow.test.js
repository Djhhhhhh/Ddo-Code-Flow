'use strict';
// tools/tests/test-workflow.test.js — 测试工作流（test 预设 + when 裁剪 + --config 覆盖）测试。
//
// 覆盖：test 预设加载（list workflows 含 when/startup 传导）、全能力链物化（6 阶段线性依赖）、
// --config 能力裁剪与依赖重接（中段/全部裁剪形态）、--config 错误形态（exit 2）、
// when 旋钮缺失 fail fast、标量 when、loadWorkflow when/startup 声明校验、
// 新任务钩子的必需上下文缺失抛错。
// 隔离约定同前：mkdtemp 沙箱 + DDO_HOME 覆写 + finally 递归删除。

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI = path.join(__dirname, '..', 'cli.js');
const REPO = path.join(__dirname, '..', '..');

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddo-testwf-test-'));
  return { dir, ddoHome: path.join(dir, 'ddo-home'), project: path.join(dir, 'project'), tasks: path.join(dir, 'tasks'), wf: path.join(dir, 'wf') };
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

/** 沙箱最小任务：config.json + prompt.md（可选 configurable/dependencies/额外字段）。 */
function writeTask(sb, name, cfgExtra = {}) {
  const dir = path.join(sb.tasks, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ name, version: '1.0.0', ...cfgExtra }, null, 2));
  fs.writeFileSync(path.join(dir, 'prompt.md'), `# ${name}\n\n沙箱占位任务。\n`);
}

function writePreset(sb, name, body) {
  fs.mkdirSync(sb.wf, { recursive: true });
  fs.writeFileSync(path.join(sb.wf, `${name}.json`), JSON.stringify(body, null, 2));
}

// ---------------------------------------------------------------- test 预设与全能力链

test('test 预设：list workflows 传导 stages 与 startup 声明', () => {
  const sb = sandbox();
  try {
    const r = cli(['list', 'workflows'], sb);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    const t = out.workflows.find((w) => w.name === 'test');
    assert.ok(t, 'test 预设应出现在清单');
    assert.deepStrictEqual(t.stages, ['test-scope', 'test-design', 'test-unit', 'test-api', 'test-e2e', 'test-reporting']);
    assert.equal(t.startup.mapToConfig, 'test-design.capabilities');
    assert.ok(t.startup.options.length >= 3);
  } finally {
    cleanup(sb);
  }
});

test('run start --workflow test：全能力链物化 6 阶段 + capabilities 预填', () => {
  const sb = sandbox();
  try {
    const r = cli(['run', 'start', '--title', '测试链冒烟', '--workflow', 'test', '--project', sb.project], sb);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.deepStrictEqual(out.currentStage, ['test-scope:01']);
    assert.deepStrictEqual(out.atomTasks['test-design'].capabilities, ['unit', 'api', 'e2e']);
    assert.ok(!('prunedStages' in out), '全能力链无裁剪');
    const state = JSON.parse(fs.readFileSync(out.statePath, 'utf8'));
    assert.equal(Object.keys(state.stages).length, 6);
    assert.deepStrictEqual(state.stages['test-api'].dependOn, ['test-unit']); // 线性链
    assert.deepStrictEqual(state.stages['test-reporting'].dependOn, ['test-e2e']);
    // exec 冒烟：首相位指令可组装（含产出契约）
    const e = cli(['exec', '--state', out.statePath, '--task', 'test-scope'], sb);
    assert.equal(e.status, 0, e.stderr);
    assert.match(e.stdout, /设定测试范围/);
    assert.match(e.stdout, /Output Contract（产出契约：test-scope\.md）/);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- --config 裁剪

test('--config capabilities=["unit"]：裁掉 api/e2e，依赖重接到最近存活祖先', () => {
  const sb = sandbox();
  try {
    const r = cli([
      'run', 'start', '--title', '仅单测', '--workflow', 'test', '--project', sb.project,
      '--config', 'test-design.capabilities=["unit"]',
    ], sb);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.deepStrictEqual(out.prunedStages, ['test-api', 'test-e2e']);
    const state = JSON.parse(fs.readFileSync(out.statePath, 'utf8'));
    assert.deepStrictEqual(Object.keys(state.stages), ['test-scope', 'test-design', 'test-unit', 'test-reporting']);
    assert.deepStrictEqual(state.stages['test-reporting'].dependOn, ['test-unit']); // e2e 被裁 → 重接到 unit
    assert.deepStrictEqual(state.atomTasks['test-design'].capabilities, ['unit']);
  } finally {
    cleanup(sb);
  }
});

test('--config capabilities=[]：全部执行层裁掉，reporting 重接到 design（仅计划形态）', () => {
  const sb = sandbox();
  try {
    const r = cli([
      'run', 'start', '--title', '仅计划', '--workflow', 'test', '--project', sb.project,
      '--config', 'test-design.capabilities=[]',
    ], sb);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.deepStrictEqual(out.prunedStages, ['test-unit', 'test-api', 'test-e2e']);
    const state = JSON.parse(fs.readFileSync(out.statePath, 'utf8'));
    assert.deepStrictEqual(Object.keys(state.stages), ['test-scope', 'test-design', 'test-reporting']);
    assert.deepStrictEqual(state.stages['test-reporting'].dependOn, ['test-design']);
  } finally {
    cleanup(sb);
  }
});

test('--config 错误形态：任务不在链 / 键未声明 / 格式非法 → exit 2', () => {
  const sb = sandbox();
  try {
    const base = ['run', 'start', '--title', 't', '--workflow', 'test', '--project', sb.project];
    let r = cli([...base, '--config', 'no-such-task.k=1'], sb);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /任务不在链内/);
    r = cli([...base, '--config', 'test-design.no-such-key=1'], sb);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /键未声明/);
    r = cli([...base, '--config', ' malformed'], sb);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /--config 非法/);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- when 通用机制（沙箱预设+任务）

test('when 旋钮缺失（无 default 且未 --config）→ run start fail fast', () => {
  const sb = sandbox();
  try {
    writeTask(sb, 'knob-holder', { configurable: [{ key: 'flag', desc: '沙箱旋钮（无 default）' }] });
    writeTask(sb, 'plain');
    writeTask(sb, 'cond', { when: undefined });
    writePreset(sb, 'sb', {
      name: 'sb', version: '1.0.0',
      stages: [
        { task: 'knob-holder', dependOn: [] },
        { task: 'plain', dependOn: ['knob-holder'], when: { config: 'knob-holder.flag', includes: true } },
      ],
    });
    const r = cli(['run', 'start', '--title', 't', '--project', sb.project, '--workflow', 'sb',
      '--workflows-dir', sb.wf, '--tasks-dir', sb.tasks], sb);
    assert.equal(r.status, 1, r.stderr);
    assert.match(r.stderr, /旋钮未生效/);
  } finally {
    cleanup(sb);
  }
});

test('标量 when：default false 裁剪、--config true 保留', () => {
  const sb = sandbox();
  try {
    writeTask(sb, 'knob-holder', { configurable: [{ key: 'flag', desc: '沙箱旋钮', default: false }] });
    writeTask(sb, 'plain');
    writePreset(sb, 'sb', {
      name: 'sb', version: '1.0.0',
      stages: [
        { task: 'knob-holder', dependOn: [] },
        { task: 'plain', dependOn: ['knob-holder'], when: { config: 'knob-holder.flag', includes: true } },
      ],
    });
    const common = ['run', 'start', '--title', 't', '--project', sb.project, '--workflow', 'sb',
      '--workflows-dir', sb.wf, '--tasks-dir', sb.tasks];
    let r = cli(common, sb);
    assert.equal(r.status, 0, r.stderr);
    assert.deepStrictEqual(JSON.parse(r.stdout).prunedStages, ['plain']); // default false → 裁
    r = cli([...common, '--config', 'knob-holder.flag=true'], sb);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.ok(!('prunedStages' in out) || out.prunedStages.length === 0);
    assert.equal(out.atomTasks['knob-holder'].flag, true);
    assert.strictEqual(typeof out.atomTasks['knob-holder'].flag, 'boolean', 'JSON 布尔不应回退字符串');
  } finally {
    cleanup(sb);
  }
});

test('loadWorkflow 声明校验：when 缺 includes / startup 缺 mapToConfig → exit 1', () => {
  const sb = sandbox();
  try {
    writeTask(sb, 'a');
    writeTask(sb, 'b');
    writePreset(sb, 'bad-when', {
      name: 'bad-when', version: '1.0.0',
      stages: [
        { task: 'a', dependOn: [] },
        { task: 'b', dependOn: ['a'], when: { config: 'a.flag' } },
      ],
    });
    let r = cli(['run', 'start', '--title', 't', '--project', sb.project, '--workflow', 'bad-when',
      '--workflows-dir', sb.wf, '--tasks-dir', sb.tasks], sb);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /when\.includes 非法/);
    writePreset(sb, 'bad-startup', {
      name: 'bad-startup', version: '1.0.0',
      stages: [{ task: 'a', dependOn: [] }],
      startup: { question: 'q', options: [{ name: 'x', desc: 'd' }] }, // 缺 mapToConfig
    });
    r = cli(['run', 'start', '--title', 't', '--project', sb.project, '--workflow', 'bad-startup',
      '--workflows-dir', sb.wf, '--tasks-dir', sb.tasks], sb);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /mapToConfig 非法/);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- 新任务钩子（ctx 缺失硬失败）

test('执行任务钩子：上游产物缺失 → assemble 抛错（不静默降级）', () => {
  const hook = require(path.join(REPO, 'atom-tasks', 'test-unit', 'test-unit.js'));
  const sbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddo-hook-'));
  try {
    assert.throws(() => hook.assemble({ phase: '01', statePath: path.join(sbDir, '.state.json'), sections: { preamble: '', instruction: 'x', extraCtx: '', rules: [] } }), /必需上下文缺失.*test-design\.md/);
  } finally {
    fs.rmSync(sbDir, { recursive: true, force: true });
  }
});
