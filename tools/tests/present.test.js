'use strict';
// tools/tests/present.test.js — 交互协议结构闭环契约测试。
//
// 覆盖：gate present 统一 payload（静态∪动态 + dispatch + presentedAt 留痕 + 隐式门物化）、
// gate interact 留痕与呈现过期、决议前置校验（next/rollback 载体）、re-ask 闭环
// （present→interact→决议被拦→重新呈现→决议成功）、assertGate 留痕字段校验、
// guide 冷启动 payload、resume --run-id 与 present payload 同源（含动态选项）。
// 隔离约定同 gate.test.js：mkdtemp 沙箱 + finally 递归删除；动态选项用仓库真实 spec 任务钩子。

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI = path.join(__dirname, '..', 'cli.js');
const REPO_ATOM_TASKS = path.join(__dirname, '..', '..', 'atom-tasks');

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddo-present-test-'));
  return {
    dir,
    ddoHome: path.join(dir, 'ddo-home'),
    statePath: path.join(dir, 'run', '.state.json'),
    runDir: path.join(dir, 'run'),
    tasksDir: path.join(dir, 'tasks'),
    wfDir: path.join(dir, 'wf'),
  };
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

const readBack = (sb) => JSON.parse(fs.readFileSync(sb.statePath, 'utf8'));

function writeState(sb, currentStage, stages, extra = {}) {
  fs.mkdirSync(sb.runDir, { recursive: true });
  fs.writeFileSync(
    sb.statePath,
    JSON.stringify({
      runId: '20260927-090000-prst1',
      title: 'present 测试',
      startedAt: '2026-09-27T09:00:00+08:00',
      git: { mainBranch: 'main' },
      currentStage,
      stages,
      atomTasks: {},
      ...extra,
    })
  );
}

const DEMO_OPTIONS = [
  { name: '同意', desc: '确认通过并推进', action: 'next --decision 同意' },
  { name: '驳回', desc: '回滚本阶段重做', action: 'rollback --stage gate-demo' },
  { name: '修改', desc: '按反馈更新后重审', action: 'in-phase' },
  { name: '提问', desc: '只答疑', action: 'in-phase' },
];

function writeGateDemo(sb, options = DEMO_OPTIONS) {
  const dir = path.join(sb.tasksDir, 'gate-demo');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'prompt.md'), [
    '# gate-demo', '',
    '<!-- @phase:01 -->', '做事。', '<!-- /phase:01 -->', '',
    '<!-- @phase:02 -->', '等待用户确认。', '<!-- /phase:02 -->', '',
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({
    name: 'gate-demo',
    version: '2.0.0',
    phases: [
      { id: '01', summary: '做事', type: 'action' },
      { id: '02', summary: '确认门', type: 'human', ...(options ? { gate: { options } } : {}) },
    ],
  }));
  const down = path.join(sb.tasksDir, 'downstream');
  fs.mkdirSync(down, { recursive: true });
  fs.writeFileSync(path.join(down, 'prompt.md'), '# downstream\n');
  fs.writeFileSync(path.join(down, 'config.json'), JSON.stringify({ name: 'downstream', version: '2.0.0' }));
}

const demoStages = () => ({
  'gate-demo': {
    status: 'waiting-human', dependOn: [], at: '2026-09-27T09:00:01+08:00',
    gate: { phase: '02', openedAt: '2026-09-27T09:00:01+08:00', options: DEMO_OPTIONS },
  },
  downstream: { status: 'pending', dependOn: ['gate-demo'], at: '2026-09-27T09:00:01+08:00' },
});

const present = (sb, extra = []) => cli(['gate', 'present', '--state', sb.statePath, '--tasks-dir', sb.tasksDir, ...extra], sb);
const interact = (sb, option, extra = []) => cli(['gate', 'interact', '--state', sb.statePath, '--option', option, '--tasks-dir', sb.tasksDir, ...extra], sb);
const decide = (sb, name) => cli(['next', '--state', sb.statePath, '--decision', name, '--tasks-dir', sb.tasksDir], sb);

// ---------------------------------------------------------------- gate present

test('gate present：统一 payload（静态选项 + dispatch）+ presentedAt 留痕', () => {
  const sb = sandbox();
  try {
    writeGateDemo(sb);
    writeState(sb, ['gate-demo:02'], demoStages());
    const r = present(sb);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.deepEqual(out.presented, ['gate-demo']);
    assert.ok(out.presentedAt);
    assert.match(out.hint, /原样呈现/);
    const g = out.gates[0];
    assert.equal(g.stage, 'gate-demo');
    assert.equal(g.phase, '02');
    assert.match(g.question, /确认门等待用户决议/);
    const byName = Object.fromEntries(g.options.map((t) => [t.name, t]));
    assert.match(byName['同意'].dispatch, new RegExp(`^next --state ${sb.statePath} --decision 同意$`));
    assert.match(byName['驳回'].dispatch, new RegExp(`^rollback --state ${sb.statePath} --stage gate-demo$`));
    assert.match(byName['提问'].dispatch, /gate interact --state/);
    assert.match(byName['提问'].dispatch, /重新 gate present/);
    const gate = readBack(sb).stages['gate-demo'].gate;
    assert.equal(gate.presentedAt, out.presentedAt); // 留痕写入门实例
    assert.equal(gate.decision, undefined);          // 呈现不是决议
  } finally {
    cleanup(sb);
  }
});

test('gate present：隐式门（无门实例手写 state）物化——选项来自相位声明，留痕落新实例', () => {
  const sb = sandbox();
  try {
    writeGateDemo(sb);
    writeState(sb, ['gate-demo:02'], {
      'gate-demo': { status: 'waiting-human', dependOn: [], at: 't' },
      downstream: { status: 'pending', dependOn: ['gate-demo'], at: 't' },
    });
    const r = present(sb);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.deepEqual(out.gates[0].options.map((t) => t.name), ['同意', '驳回', '修改', '提问']); // 声明选项集
    const gate = readBack(sb).stages['gate-demo'].gate; // 物化
    assert.equal(gate.phase, '02');
    assert.ok(gate.openedAt && gate.presentedAt);
  } finally {
    cleanup(sb);
  }
});

test('gate present：无开门 → exit 1 + stderr 指引', () => {
  const sb = sandbox();
  try {
    writeGateDemo(sb);
    writeState(sb, ['gate-demo:01'], {
      'gate-demo': { status: 'running', dependOn: [], at: 't' },
      downstream: { status: 'pending', dependOn: ['gate-demo'], at: 't' },
    });
    const r = present(sb);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /无开门/);
    assert.equal(JSON.parse(r.stdout).presented, 0);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- 动态选项（真实 spec 钩子）

function writeSpecState(sb, withBq) {
  writeState(sb, ['spec:02'], {
    requirement: { status: 'done', dependOn: [], at: 't' },
    spec: {
      status: 'waiting-human', dependOn: ['requirement'], at: 't',
      gate: {
        phase: '02', openedAt: 't',
        options: [
          { name: '同意', desc: '批准当前 spec', action: 'next --decision 同意' },
          { name: '驳回', desc: '回滚 spec 阶段', action: 'rollback --stage spec' },
          { name: '修改', desc: '按反馈更新后重审', action: 'in-phase' },
          { name: '提问', desc: '只答疑', action: 'in-phase' },
        ],
      },
    },
  });
  fs.writeFileSync(path.join(sb.runDir, 'spec.md'), withBq
    ? '# Spec\n\n## 需要用户确认\n\n- **BQ-1**：覆盖时刻只做门还是全部统一？\n- **BQ-2**：动态选项是否纳入 payload？\n\n## 成功结果\n\n无。\n'
    : '# Spec\n\n## 成功结果\n\n无 BQ 版本。\n');
}

test('动态选项：spec 门 present 产出 回答BQ-N（present 钩子现算，name 无空格）', () => {
  const sb = sandbox();
  try {
    writeSpecState(sb, true);
    const r = cli(['gate', 'present', '--state', sb.statePath, '--tasks-dir', REPO_ATOM_TASKS], sb);
    assert.equal(r.status, 0, r.stderr);
    const names = JSON.parse(r.stdout).gates[0].options.map((t) => t.name);
    assert.deepEqual(names, ['同意', '驳回', '修改', '提问', '回答BQ-1', '回答BQ-2']); // 静态在前，动态在后
    const bq1 = JSON.parse(r.stdout).gates[0].options.find((t) => t.name === '回答BQ-1');
    assert.equal(bq1.action, 'in-phase');
    assert.match(bq1.desc, /覆盖时刻/);
  } finally {
    cleanup(sb);
  }
});

test('动态选项：spec.md 无未解决 BQ → payload 不含动态项（降级不阻塞）', () => {
  const sb = sandbox();
  try {
    writeSpecState(sb, false);
    const r = cli(['gate', 'present', '--state', sb.statePath, '--tasks-dir', REPO_ATOM_TASKS], sb);
    assert.equal(r.status, 0, r.stderr);
    const names = JSON.parse(r.stdout).gates[0].options.map((t) => t.name);
    assert.deepEqual(names, ['同意', '驳回', '修改', '提问']);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- 决议前置校验

test('未呈现决议被拦：next --decision → exit 1（blocked gate-unpresented）+ stderr 指引 gate present', () => {
  const sb = sandbox();
  try {
    writeGateDemo(sb);
    writeState(sb, ['gate-demo:02'], demoStages());
    const r = decide(sb, '同意');
    assert.equal(r.status, 1);
    assert.match(r.stderr, /呈现未更新/);
    assert.match(r.stderr, /gate present/);
    assert.match(r.stderr, /同意：确认通过并推进/); // 同源选项清单重发
    const out = JSON.parse(r.stdout);
    assert.equal(out.blocked, 'gate-unpresented');
    assert.deepEqual(readBack(sb).currentStage, ['gate-demo:02']); // 未推进
    assert.equal(readBack(sb).stages['gate-demo'].gate.decision, undefined);
  } finally {
    cleanup(sb);
  }
});

test('补呈现后决议成功：presentedAt 与 decision/closedAt 留痕并存', () => {
  const sb = sandbox();
  try {
    writeGateDemo(sb);
    writeState(sb, ['gate-demo:02'], demoStages());
    assert.equal(present(sb).status, 0);
    const r = decide(sb, '同意');
    assert.equal(r.status, 0, r.stderr);
    const gate = readBack(sb).stages['gate-demo'].gate;
    assert.equal(gate.decision, '同意');
    assert.ok(gate.presentedAt && gate.closedAt);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- in-phase 交互与 re-ask 闭环

test('re-ask 闭环：present → interact(提问) → 决议被拦 → 重新 present → 决议成功', () => {
  const sb = sandbox();
  try {
    writeGateDemo(sb);
    writeState(sb, ['gate-demo:02'], demoStages());
    assert.equal(present(sb).status, 0);

    const i = interact(sb, '提问', ['--note', '这个方案影响范围？']);
    assert.equal(i.status, 0, i.stderr);
    assert.deepEqual(JSON.parse(i.stdout).recorded.option, '提问');
    const gate1 = readBack(sb).stages['gate-demo'].gate;
    assert.equal(gate1.interactions.length, 1);
    assert.equal(gate1.interactions[0].option, '提问');
    assert.equal(gate1.interactions[0].note, '这个方案影响范围？');
    assert.ok(gate1.interactions[0].at >= gate1.presentedAt); // 交互使呈现过期

    const blocked = decide(sb, '同意');
    assert.equal(blocked.status, 1);
    assert.equal(JSON.parse(blocked.stdout).blocked, 'gate-unpresented');
    assert.match(blocked.stderr, /上次相位内交互后未重新呈现/);

    assert.equal(present(sb).status, 0); // 重新呈现（re-ask 由结构强制）
    const ok = decide(sb, '同意');
    assert.equal(ok.status, 0, ok.stderr);
    const gate2 = readBack(sb).stages['gate-demo'].gate;
    assert.equal(gate2.decision, '同意');
    assert.ok(gate2.presentedAt > gate1.interactions[0].at);
  } finally {
    cleanup(sb);
  }
});

test('gate interact：命令型选项报错指引走声明命令；未知选项列有效 in-phase 名单', () => {
  const sb = sandbox();
  try {
    writeGateDemo(sb);
    writeState(sb, ['gate-demo:02'], demoStages());
    const cmdType = interact(sb, '同意');
    assert.equal(cmdType.status, 1);
    assert.match(cmdType.stderr, /命令型决议/);
    const unknown = interact(sb, '好');
    assert.equal(unknown.status, 1);
    assert.match(unknown.stderr, /未知交互选项/);
    assert.match(unknown.stderr, /修改, 提问/);
  } finally {
    cleanup(sb);
  }
});

test('gate interact：动态选项名（回答BQ-1）合法记录', () => {
  const sb = sandbox();
  try {
    writeSpecState(sb, true);
    const r = cli(['gate', 'interact', '--state', sb.statePath, '--option', '回答BQ-1', '--tasks-dir', REPO_ATOM_TASKS], sb);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(r.stdout).recorded.option, '回答BQ-1');
    assert.equal(readBack(sb).stages.spec.gate.interactions[0].option, '回答BQ-1');
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- rollback 载体校验

test('rollback 作为门决议载体：未呈现被拦，补呈现后放行', () => {
  const sb = sandbox();
  try {
    writeGateDemo(sb);
    writeState(sb, ['gate-demo:02'], demoStages());
    const blocked = cli(['rollback', '--state', sb.statePath, '--stage', 'gate-demo', '--tasks-dir', sb.tasksDir], sb);
    assert.equal(blocked.status, 1);
    assert.equal(JSON.parse(blocked.stdout).blocked, 'gate-unpresented');
    assert.match(blocked.stderr, /驳回类回滚同样需要用户先看到选项/);
    assert.deepEqual(readBack(sb).currentStage, ['gate-demo:02']); // 未回滚

    assert.equal(present(sb).status, 0);
    const ok = cli(['rollback', '--state', sb.statePath, '--stage', 'gate-demo', '--tasks-dir', sb.tasksDir], sb);
    assert.equal(ok.status, 0, ok.stderr);
    assert.deepEqual(JSON.parse(ok.stdout).clearedGates, ['gate-demo']); // 门连同留痕一起清
  } finally {
    cleanup(sb);
  }
});

test('rollback 非门用途不受呈现校验影响（action 相位回滚）', () => {
  const sb = sandbox();
  try {
    writeGateDemo(sb);
    writeState(sb, ['gate-demo:01'], {
      'gate-demo': { status: 'running', dependOn: [], at: 't' },
      downstream: { status: 'pending', dependOn: ['gate-demo'], at: 't' },
    });
    const r = cli(['rollback', '--state', sb.statePath, '--stage', 'gate-demo', '--tasks-dir', sb.tasksDir], sb);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(readBack(sb).currentStage, ['gate-demo:01']);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- state 断言

test('assertGate 留痕字段：非法 presentedAt / interactions → exit 1', () => {
  const sb = sandbox();
  try {
    writeGateDemo(sb);
    const base = demoStages();
    writeState(sb, ['gate-demo:02'], {
      ...base,
      'gate-demo': { ...base['gate-demo'], gate: { ...base['gate-demo'].gate, presentedAt: 'not-a-time' } },
    });
    const r = present(sb);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /presentedAt/);

    writeState(sb, ['gate-demo:02'], {
      ...base,
      'gate-demo': { ...base['gate-demo'], gate: { ...base['gate-demo'].gate, interactions: [{ option: '', at: 't' }] } },
    });
    const r2 = decide(sb, '同意');
    assert.equal(r2.status, 1);
    assert.match(r2.stderr, /interactions\[0\]\.option/);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- next 无决议拦截的新指引

test('next 无 --decision：stderr 指引先跑 gate present（同源清单重发）', () => {
  const sb = sandbox();
  try {
    writeGateDemo(sb);
    writeState(sb, ['gate-demo:02'], demoStages());
    const r = cli(['next', '--state', sb.statePath, '--tasks-dir', sb.tasksDir], sb);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /先跑 gate present/);
    assert.match(r.stderr, /提问：只答疑（相位内交互）/);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- guide

test('guide：冷启动三问 payload（问目标 freeText / 问模式含真实预设 / 问类型枚举）', () => {
  const sb = sandbox();
  try {
    const r = cli(['guide'], sb);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.deepEqual(out.questions.map((q) => q.id), ['goal', 'mode', 'type']);
    assert.equal(out.questions[0].freeText, true);
    const modeNames = out.questions[1].options.map((o) => o.name);
    assert.ok(modeNames.includes('basic') && modeNames.includes('standard'), `预设缺失: ${modeNames}`);
    assert.ok(modeNames.includes('自定义'));
    const basic = out.questions[1].options.find((o) => o.name === 'basic');
    assert.match(basic.desc, /requirement/); // desc 含阶段链
    assert.ok(out.questions[2].options.some((o) => o.name === 'fix'));
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- resume 同源

test('resume --run-id：gateOptions 与 gate present payload 同源（含动态选项）', () => {
  const sb = sandbox();
  try {
    // 真实任务目录启动（state.dirs.tasksDir 落库，后续免 flag），推进到 spec:02 开门
    const start = cli([
      'run', 'start', '--project', sb.dir, '--title', '同源测试', '--dir-name', 'r',
      '--tasks-dir', REPO_ATOM_TASKS,
    ], sb);
    assert.equal(start.status, 0, start.stderr);
    const statePath = JSON.parse(start.stdout).statePath;
    const st = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    st.currentStage = ['spec:02'];
    st.stages.requirement.status = 'done';
    st.stages.spec.status = 'waiting-human';
    fs.writeFileSync(statePath, JSON.stringify(st));
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(path.join(path.dirname(statePath), 'spec.md'),
      '# Spec\n\n## 需要用户确认\n\n- **BQ-1**：范围确认？\n');

    const runId = st.runId;
    const resume = cli(['resume', '--run-id', runId], sb);
    assert.equal(resume.status, 0, resume.stderr);
    const gateOptions = JSON.parse(resume.stdout).gateOptions;

    const presentCmd = cli(['gate', 'present', '--state', statePath], sb);
    assert.equal(presentCmd.status, 0, presentCmd.stderr);
    const payload = JSON.parse(presentCmd.stdout);

    const triple = (t) => ({ name: t.name, desc: t.desc, action: t.action });
    assert.deepEqual(gateOptions.map(triple), payload.gates[0].options.map(triple)); // 同源同形态
    assert.ok(gateOptions.some((o) => o.name === '回答BQ-1'), 'resume 呈现集含动态选项');
  } finally {
    cleanup(sb);
  }
});
