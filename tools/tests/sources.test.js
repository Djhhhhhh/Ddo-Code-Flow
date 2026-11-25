'use strict';
// tools/tests/sources.test.js — 用户本地注册源合并解析测试（run 20261125-221045-c6ec，spec FR-1~FR-6 / plan FC-6）。
//
// 隔离约定（同 start.test.js）：mkdtemp 沙箱 + DDO_HOME 指内（用户注册源 = 沙箱内 ddo-home/，
// 天然隔离真实 ~/.ddo）；project 也在沙箱内；finally 递归删除。
// 内置源读仓库 workflows/、atom-tasks/（只读）。

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI = path.join(__dirname, '..', 'cli.js');

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddo-sources-test-'));
  return { dir, ddoHome: path.join(dir, 'ddo-home'), project: path.join(dir, 'project') };
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

/** 在 DDO_HOME 下注册用户预设（可选：同时注册其引用的自定义原子任务）。 */
function registerUserFlow(sb, name, stages, tasks = []) {
  const wfDir = path.join(sb.ddoHome, 'workflows');
  fs.mkdirSync(wfDir, { recursive: true });
  fs.writeFileSync(path.join(wfDir, `${name}.json`), JSON.stringify({
    name, version: '1.0.0', description: `本地注册预设 ${name}`,
    stages: stages.map((task) => ({ task, dependOn: [] })),
  }));
  for (const task of tasks) {
    const dir = path.join(sb.ddoHome, 'atom-tasks', task);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({
      name: task, version: '1.0.0', desc: `本地任务 ${task}`,
    }));
    fs.writeFileSync(path.join(dir, 'prompt.md'), `# ${task}\n\n本地任务指令体。\n`);
  }
}

// ---------------------------------------------------------------- AC-2 / AC-3：合并列出

test('list workflows 缺省合并：user 预设可见且标 source:user；builtin 行保持原样', () => {
  const sb = sandbox();
  try {
    registerUserFlow(sb, 'ones-d', ['ones-deliver']);
    const out = JSON.parse(cli(['list', 'workflows'], sb).stdout);
    const names = out.workflows.map((w) => w.name);
    assert.ok(names.includes('ones-d'), 'user 预设应出现在缺省清单');
    assert.ok(names.includes('basic') && names.includes('standard'), '内置预设不因合并消失');
    const userRow = out.workflows.find((w) => w.name === 'ones-d');
    assert.equal(userRow.source, 'user');
    const basicRow = out.workflows.find((w) => w.name === 'basic');
    assert.equal(basicRow.source, undefined, 'builtin 行保持原样（AC-3/AC-5 等价性）');
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- AC-5：空注册等价性 + 显式通道密闭

test('空注册环境：list workflows 与现状基线一致（无 source 字段、无 user 行）', () => {
  const sb = sandbox();
  try {
    const out = JSON.parse(cli(['list', 'workflows'], sb).stdout);
    const repoWorkflows = fs.readdirSync(path.join(__dirname, '..', '..', 'workflows'))
      .filter((x) => x.endsWith('.json')).map((x) => x.slice(0, -5)).sort();
    assert.deepEqual(out.workflows.map((w) => w.name).sort(), repoWorkflows);
    assert.ok(out.workflows.every((w) => w.source === undefined));
    // run start 既有路径不受影响
    const r = cli(['run', 'start', '--title', 't', '--workflow', 'basic', '--project', sb.project], sb);
    assert.equal(r.status, 0);
  } finally {
    cleanup(sb);
  }
});

test('显式 --workflows-dir：密闭单源通道，不合并用户源（DEC-2）', () => {
  const sb = sandbox();
  try {
    registerUserFlow(sb, 'ones-d', ['ones-deliver']);
    const custom = path.join(sb.dir, 'wf');
    fs.mkdirSync(custom, { recursive: true });
    fs.writeFileSync(path.join(custom, 'solo.json'), JSON.stringify({
      name: 'solo', version: '1.0.0', stages: [{ task: 'requirement', dependOn: [] }],
    }));
    const out = JSON.parse(cli(['list', 'workflows', '--workflows-dir', custom], sb).stdout);
    assert.deepEqual(out.workflows.map((w) => w.name), ['solo'], '显式通道只见所指定目录');
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- AC-1 / FR-3：按名启动 + 任务合并解析

test('run start 按名启动本地预设：混引内置任务与本地任务，走一轮 exec/validate/next', () => {
  const sb = sandbox();
  try {
    // ones-d：requirement（内置）→ ones-deliver（本地，单相位 action，产出 report.md）
    const wfDir = path.join(sb.ddoHome, 'workflows');
    fs.mkdirSync(wfDir, { recursive: true });
    fs.writeFileSync(path.join(wfDir, 'ones-d.json'), JSON.stringify({
      name: 'ones-d', version: '1.0.0', description: '本地注册：交付 RND+变更项+绑定',
      stages: [
        { task: 'requirement', dependOn: [] },
        { task: 'ones-deliver', dependOn: ['requirement'] },
      ],
    }));
    const dir = path.join(sb.ddoHome, 'atom-tasks', 'ones-deliver');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({
      name: 'ones-deliver', version: '1.0.0', desc: '本地交付任务',
      phases: [{ id: '01', type: 'action', output: 'ones-report.md' }],
    }));
    fs.writeFileSync(path.join(dir, 'prompt.md'), `# ones-deliver\n\n<!-- @phase:01 -->\n写交付记录。<!-- /phase:01 -->\n`);

    const start = cli(['run', 'start', '--title', '本地流程启动', '--workflow', 'ones-d', '--project', sb.project], sb);
    assert.equal(start.status, 0, `启动应成功: ${start.stderr}`);
    const { statePath } = JSON.parse(start.stdout);

    // requirement:01（内置任务，经 primary 命中）
    const st = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.deepEqual(st.currentStage, ['requirement:01']);
    assert.equal(st.dirs.tasksDir, path.join(__dirname, '..', '..', 'atom-tasks'), '主目录仍为内置缺省（DEC-4 不落用户源）');

    const requirementDir = path.join(sb.project, '.ddo', 'runs', 'feat');
    const ex1 = cli(['exec', '--state', statePath, '--task', 'requirement'], sb);
    assert.equal(ex1.status, 0, '内置任务 exec 正常');
    fs.mkdirSync(requirementDir, { recursive: true }); // noop 兜底（runDir 已存在）
    const runDir = path.dirname(statePath);
    fs.writeFileSync(path.join(runDir, 'requirement.md'), '# 用户需求\n\n## 原始需求\n\nr\n\n## 需求摘要\n\ns\n');
    const v1 = cli(['validate', '--state', statePath, '--task', 'requirement'], sb);
    assert.equal(v1.status, 0, `requirement 校验: ${v1.stderr}`);
    const n1 = cli(['next', '--state', statePath], sb);
    assert.equal(n1.status, 0, `推进: ${n1.stderr}`);

    // ones-deliver:01（本地任务，经 user fallback 命中）
    const ex2 = cli(['exec', '--state', statePath, '--task', 'ones-deliver'], sb);
    assert.equal(ex2.status, 0, `本地任务 exec 应经 user 源命中: ${ex2.stderr}`);
    assert.match(ex2.stdout, /ones-deliver/);
    fs.writeFileSync(path.join(runDir, 'ones-report.md'), '交付记录\n');
    const v2 = cli(['validate', '--state', statePath, '--task', 'ones-deliver'], sb);
    assert.equal(v2.status, 0, `本地任务校验: ${v2.stderr}`);
    const n2 = cli(['next', '--state', statePath], sb);
    assert.equal(n2.status, 0);
    assert.equal(JSON.parse(n2.stdout).completed, true, '链走完');
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- AC-4 / FR-5：冲突 fail-fast

test('预设同名冲突：list workflows 与 run start 双拦截（消息含两路径）', () => {
  const sb = sandbox();
  try {
    registerUserFlow(sb, 'basic', ['requirement']); // 与内置 basic 同名
    const lst = cli(['list', 'workflows'], sb);
    assert.equal(lst.status, 1);
    assert.match(lst.stderr, /预设同名冲突: basic/);
    assert.match(lst.stderr, /builtin: .*workflows\/basic\.json/);
    assert.match(lst.stderr, /user: .*ddo-home\/workflows\/basic\.json/);

    const start = cli(['run', 'start', '--title', 't', '--workflow', 'basic', '--project', sb.project], sb);
    assert.equal(start.status, 1);
    assert.match(start.stderr, /预设同名冲突: basic/);
    assert.ok(!fs.existsSync(path.join(sb.project, '.ddo')), '不产生半截 run');
  } finally {
    cleanup(sb);
  }
});

test('任务同名冲突：run start 启动期拦截（消息含两路径）', () => {
  const sb = sandbox();
  try {
    // 预设引用 coding（内置同名任务在 user 源也存在）→ expandStages 解析时冲突
    const wfDir = path.join(sb.ddoHome, 'workflows');
    fs.mkdirSync(wfDir, { recursive: true });
    fs.writeFileSync(path.join(wfDir, 'chain.json'), JSON.stringify({
      name: 'chain', version: '1.0.0', stages: [{ task: 'coding', dependOn: [] }],
    }));
    const dir = path.join(sb.ddoHome, 'atom-tasks', 'coding');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ name: 'coding', version: '9.9.9' }));
    fs.writeFileSync(path.join(dir, 'prompt.md'), '# coding\n');

    const start = cli(['run', 'start', '--title', 't', '--workflow', 'chain', '--project', sb.project], sb);
    assert.equal(start.status, 1);
    assert.match(start.stderr, /原子任务同名冲突: coding/);
    assert.match(start.stderr, /builtin: .*atom-tasks\/coding/);
    assert.match(start.stderr, /user: .*ddo-home\/atom-tasks\/coding/);
    assert.ok(!fs.existsSync(path.join(sb.project, '.ddo')), '不产生半截 run');
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- FR-2：guide 一步命中

test('guide：mode 选项含本地注册预设（数据面经 listWorkflows 合并）', () => {
  const sb = sandbox();
  try {
    registerUserFlow(sb, 'ones-d', ['ones-deliver'], ['ones-deliver']);
    const out = JSON.parse(cli(['guide'], sb).stdout);
    const mode = out.questions.find((q) => q.id === 'mode');
    const opt = mode.options.find((o) => o.name === 'ones-d');
    assert.ok(opt, 'guide mode 选项应含本地预设');
    assert.match(opt.desc, /本地注册预设 ones-d/);
    assert.ok(mode.options.some((o) => o.name === 'basic'), '内置选项仍在');
  } finally {
    cleanup(sb);
  }
});
