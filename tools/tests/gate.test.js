'use strict';
// tools/tests/gate.test.js — 确认门生命周期测试（07 plan v1.0/v1.3/v1.4 契约）。
//
// 覆盖：门拦截与决议（--decision，用户词汇决议名）、任务级定制选项集、action 四类白名单
// （含 in-phase 相位内交互）、无门 human 位置严格拦截、rollback 清门、run start 首相位开门、
// status 双清单派生（gateOptions 呈现集 / availableCommands 可执行集）、exec/validate 位置协议、
// config 标准格式校验（_schema/task-config.schema.json）。
// 隔离约定同前：mkdtemp 沙箱 + finally 递归删除；定制任务写在沙箱经 --tasks-dir 传入。

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI = path.join(__dirname, '..', 'cli.js');

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddo-gate-test-'));
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

function writeState(sb, currentStage, stages) {
  fs.mkdirSync(sb.runDir, { recursive: true });
  fs.writeFileSync(
    sb.statePath,
    JSON.stringify({
      runId: '20260923-090000-gate1',
      title: 'gate 测试',
      startedAt: '2026-09-23T09:00:00+08:00',
      git: { mainBranch: 'main' },
      currentStage,
      stages,
      atomTasks: {},
    })
  );
}

/** 定制任务：gate-demo（01 action → 02 human，声明用户词汇选项集，含 in-phase）。 */
function writeGateDemo(sb, options) {
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
  // 下游任务（DAG 点亮时 next/status 需读其相位声明）
  const down = path.join(sb.tasksDir, 'downstream');
  fs.mkdirSync(down, { recursive: true });
  fs.writeFileSync(path.join(down, 'prompt.md'), '# downstream\n\n做事。\n');
  fs.writeFileSync(path.join(down, 'config.json'), JSON.stringify({ name: 'downstream', version: '2.0.0' }));
}

const DEMO_OPTIONS = [
  { name: '同意', desc: '确认通过并推进', action: 'next --decision 同意' },
  { name: '带修改通过', desc: '按修改意见通过', action: 'next --decision 带修改通过' },
  { name: '驳回', desc: '回滚本阶段重做', action: 'rollback --stage gate-demo' },
  { name: '提问', desc: '只答疑', action: 'in-phase' },
];

/** gate-demo 的 stages 骨架。 */
const demoStages = (overrides = {}) =>
  Object.assign(
    {
      'gate-demo': { status: 'running', dependOn: [], at: '2026-09-23T09:00:01+08:00' },
      downstream: { status: 'pending', dependOn: ['gate-demo'], at: '2026-09-23T09:00:01+08:00' },
    },
    overrides
  );

const withGate = () => demoStages({
  'gate-demo': {
    status: 'waiting-human', dependOn: [], at: 't',
    gate: { phase: '02', openedAt: 't', options: DEMO_OPTIONS },
  },
});

// ---------------------------------------------------------------- 拦截与决议

test('门拦截：开门位 next 无 --decision → exit 1，错误即提示（stderr 选项人话版 + stdout gate JSON）', () => {
  const sb = sandbox();
  try {
    writeGateDemo(sb, DEMO_OPTIONS);
    writeState(sb, ['gate-demo:02'], withGate());
    const r = cli(['next', '--state', sb.statePath, '--tasks-dir', sb.tasksDir], sb);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /确认门未关闭/);
    assert.match(r.stderr, /gate-demo:02 需用户决议/);
    assert.match(r.stderr, /带修改通过：按修改意见通过/); // 选项人话渲染
    assert.match(r.stderr, /提问：只答疑（相位内交互）/);   // in-phase 显示为人话
    const out = JSON.parse(r.stdout);
    assert.equal(out.blocked, 'gate-open');
    assert.equal(out.gates[0].stage, 'gate-demo');
    assert.deepStrictEqual(out.gates[0].options, DEMO_OPTIONS);
    assert.deepStrictEqual(readBack(sb).currentStage, ['gate-demo:02']); // 未推进
  } finally {
    cleanup(sb);
  }
});

test('决议推进：--decision 同意 → 相位耗尽收尾 + decision/closedAt 留痕 + DAG 点亮', () => {
  const sb = sandbox();
  try {
    writeGateDemo(sb, DEMO_OPTIONS);
    writeState(sb, ['gate-demo:02'], withGate());
    const r = cli(['next', '--state', sb.statePath, '--decision', '同意', '--tasks-dir', sb.tasksDir], sb);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.deepStrictEqual(out.finished, ['gate-demo']);
    assert.deepStrictEqual(out.activated, ['downstream']);
    assert.deepStrictEqual(out.closedGates, [{ stage: 'gate-demo', decision: '同意' }]);
    const gate = readBack(sb).stages['gate-demo'].gate;
    assert.equal(gate.decision, '同意');
    assert.ok(gate.closedAt);
  } finally {
    cleanup(sb);
  }
});

test('定制决议名（带修改通过）合法放行——用户词汇即 --decision 取值', () => {
  const sb = sandbox();
  try {
    writeGateDemo(sb, DEMO_OPTIONS);
    writeState(sb, ['gate-demo:02'], withGate());
    const r = cli(['next', '--state', sb.statePath, '--decision', '带修改通过', '--tasks-dir', sb.tasksDir], sb);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(r.stdout).closedGates[0].decision, '带修改通过');
  } finally {
    cleanup(sb);
  }
});

test('in-phase 决议喂 next → exit 1；转移型 → exit 1 指向声明命令；未知 → exit 2；无门用 → exit 2', () => {
  const sb = sandbox();
  try {
    writeGateDemo(sb, DEMO_OPTIONS);
    writeState(sb, ['gate-demo:02'], withGate());
    const inPhase = cli(['next', '--state', sb.statePath, '--decision', '提问', '--tasks-dir', sb.tasksDir], sb);
    assert.equal(inPhase.status, 1);
    assert.match(inPhase.stderr, /相位内交互/);
    assert.match(inPhase.stderr, /不走 next/);

    writeState(sb, ['gate-demo:02'], withGate());
    const reject = cli(['next', '--state', sb.statePath, '--decision', '驳回', '--tasks-dir', sb.tasksDir], sb);
    assert.equal(reject.status, 1);
    assert.match(reject.stderr, /动作不是推进/);
    assert.match(reject.stderr, /rollback --stage gate-demo/);

    writeState(sb, ['gate-demo:02'], withGate());
    const unknown = cli(['next', '--state', sb.statePath, '--decision', '好', '--tasks-dir', sb.tasksDir], sb);
    assert.equal(unknown.status, 2);
    assert.match(unknown.stderr, /未知决议/);

    writeState(sb, ['gate-demo:01'], demoStages()); // action 相位无门
    const noGate = cli(['next', '--state', sb.statePath, '--decision', '同意', '--tasks-dir', sb.tasksDir], sb);
    assert.equal(noGate.status, 2);
  } finally {
    cleanup(sb);
  }
});

test('无门 human 位置（手工 state）→ 严格拦截，兜底标准二元（同意/驳回）', () => {
  const sb = sandbox();
  try {
    writeGateDemo(sb); // 未声明 options
    writeState(sb, ['gate-demo:02'], demoStages({
      'gate-demo': { status: 'waiting-human', dependOn: [], at: 't' }, // 无 gate 字段
    }));
    const r = cli(['next', '--state', sb.statePath, '--tasks-dir', sb.tasksDir], sb);
    assert.equal(r.status, 1);
    const out = JSON.parse(r.stdout);
    assert.equal(out.blocked, 'gate-open');
    assert.deepEqual(
      out.gates[0].options.map((t) => t.name),
      ['同意', '驳回']
    );
    assert.match(out.gates[0].options[0].desc, /点亮 downstream/); // 兜底 desc 现算后继
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- 注册与校验

test('进入 human 相位时注册门：任务级选项逐字进 state（含 in-phase）', () => {
  const sb = sandbox();
  try {
    writeGateDemo(sb, DEMO_OPTIONS);
    writeState(sb, ['gate-demo:01'], demoStages());
    const r = cli(['next', '--state', sb.statePath, '--tasks-dir', sb.tasksDir], sb);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.openedGates[0].stage, 'gate-demo');
    assert.deepStrictEqual(out.openedGates[0].options, DEMO_OPTIONS); // 逐字注册
    assert.deepStrictEqual(readBack(sb).stages['gate-demo'].gate.options, DEMO_OPTIONS);
  } finally {
    cleanup(sb);
  }
});

test('action 白名单 fail fast：非法 action 在开门（注册）时 exit 1，垃圾不进 state', () => {
  const sb = sandbox();
  try {
    writeGateDemo(sb, [{ name: '同意', desc: 'x', action: 'rm -rf /' }]);
    writeState(sb, ['gate-demo:01'], demoStages());
    const r = cli(['next', '--state', sb.statePath, '--tasks-dir', sb.tasksDir], sb);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /action 非法/);
    assert.equal(readBack(sb).stages['gate-demo'].gate, undefined); // 未写入门
    assert.deepEqual(readBack(sb).currentStage, ['gate-demo:01']); // 未推进
  } finally {
    cleanup(sb);
  }
});

test('run start：首相位 human 的任务 → 启动即开门', () => {
  const sb = sandbox();
  try {
    // 定制任务：01 即 human（现有任务无此形态，机制对称支持）
    const dir = path.join(sb.tasksDir, 'gate-first');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'prompt.md'), '# gate-first\n\n<!-- @phase:01 -->\n确认。\n<!-- /phase:01 -->\n');
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({
      name: 'gate-first', version: '2.0.0',
      phases: [{ id: '01', summary: '开门即审', type: 'human' }],
    }));
    fs.mkdirSync(sb.wfDir, { recursive: true });
    fs.writeFileSync(path.join(sb.wfDir, 'openstart.json'), JSON.stringify({
      name: 'openstart', version: '1.0.0',
      stages: [{ task: 'gate-first', dependOn: [] }],
    }));
    const r = cli([
      'run', 'start', '--title', '开门启动', '--project', sb.dir,
      '--workflow', 'openstart', '--workflows-dir', sb.wfDir, '--tasks-dir', sb.tasksDir,
    ], sb);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.openedGates.length, 1);
    assert.equal(out.openedGates[0].stage, 'gate-first');
    const state = JSON.parse(fs.readFileSync(out.statePath, 'utf8'));
    assert.equal(state.stages['gate-first'].status, 'waiting-human');
    assert.equal(state.stages['gate-first'].gate.phase, '01');
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- rollback 清门

test('rollback：阶段重置显式清门（clearedGates 输出），重做再入 human 相位开新门', () => {
  const sb = sandbox();
  try {
    writeGateDemo(sb, DEMO_OPTIONS);
    writeState(sb, ['gate-demo:02'], withGate());
    const r = cli(['rollback', '--state', sb.statePath, '--stage', 'gate-demo', '--tasks-dir', sb.tasksDir], sb);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout).clearedGates, ['gate-demo']);
    assert.equal(readBack(sb).stages['gate-demo'].gate, undefined); // 门被清

    // 重做：:01 → next 进入 :02 → 开新门
    const redo = cli(['next', '--state', sb.statePath, '--tasks-dir', sb.tasksDir], sb);
    assert.equal(redo.status, 0, redo.stderr);
    const gate = readBack(sb).stages['gate-demo'].gate;
    assert.equal(gate.phase, '02');
    assert.equal(gate.decision, undefined); // 新门开着
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- status 双清单

test('status：action 位派生 exec/validate/next + rollback + finish；gateOptions 为空', () => {
  const sb = sandbox();
  try {
    writeGateDemo(sb, DEMO_OPTIONS);
    writeState(sb, ['gate-demo:01'], demoStages());
    const out = JSON.parse(cli(['status', '--state', sb.statePath, '--tasks-dir', sb.tasksDir], sb).stdout);
    assert.equal(out.currentStage[0].phaseType, 'action');
    assert.deepEqual(out.gateOptions, []);
    assert.ok(out.availableCommands.some((o) => /exec --state .* --task gate-demo --phase 01/.test(o.cmd)));
    assert.ok(out.availableCommands.some((o) => o.cmd.startsWith('next ')));
    assert.ok(out.availableCommands.some((o) => o.cmd.startsWith('rollback ') && o.cmd.includes('gate-demo')));
    assert.ok(out.availableCommands.some((o) => o.cmd.includes('run finish') && o.cmd.includes('aborted')));
  } finally {
    cleanup(sb);
  }
});

test('status 开门位：gateOptions = 门全部选项（含 in-phase）；availableCommands 仅命令型（--state 补全）', () => {
  const sb = sandbox();
  try {
    writeGateDemo(sb, DEMO_OPTIONS);
    writeState(sb, ['gate-demo:02'], withGate());
    const out = JSON.parse(cli(['status', '--state', sb.statePath, '--tasks-dir', sb.tasksDir], sb).stdout);
    assert.equal(out.currentStage[0].phaseType, 'human');
    assert.deepEqual(out.gateOptions.map((o) => o.name), ['同意', '带修改通过', '驳回', '提问']); // 呈现集全量
    const named = out.availableCommands.filter((o) => o.name);
    assert.deepEqual(named.map((o) => o.name), ['同意', '带修改通过', '驳回']); // 提问（in-phase）不进可执行集
    const rejectCmd = named.find((o) => o.name === '驳回').cmd;
    assert.match(rejectCmd, new RegExp(`^rollback --state ${sb.statePath} --stage gate-demo$`));
    assert.ok(out.availableCommands.some((o) => o.cmd.includes('run finish') && o.cmd.includes('aborted')));
  } finally {
    cleanup(sb);
  }
});

test('status：currentStage 空 → 唯一操作是 run finish --status done', () => {
  const sb = sandbox();
  try {
    writeGateDemo(sb, DEMO_OPTIONS);
    writeState(sb, [], demoStages({ 'gate-demo': { status: 'done', dependOn: [], at: 't' } }));
    const out = JSON.parse(cli(['status', '--state', sb.statePath, '--tasks-dir', sb.tasksDir], sb).stdout);
    assert.deepEqual(out.currentStage, []);
    assert.deepEqual(out.gateOptions, []);
    assert.equal(out.availableCommands.length, 1);
    assert.match(out.availableCommands[0].cmd, /run finish --state .* --status done/);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- 位置协议（P4）

test('exec 位置协议：不在 currentStage → exit 1；显式相位不一致 → exit 1；缺省 = 当前相位', () => {
  const sb = sandbox();
  try {
    writeGateDemo(sb, DEMO_OPTIONS);
    writeState(sb, ['gate-demo:02'], withGate());
    const away = cli(['exec', '--state', sb.statePath, '--task', 'spec', '--tasks-dir', sb.tasksDir], sb);
    assert.equal(away.status, 1);
    assert.match(away.stderr, /执行位置不符/);

    const future = cli(['exec', '--state', sb.statePath, '--task', 'gate-demo', '--phase', '01', '--tasks-dir', sb.tasksDir], sb);
    assert.equal(future.status, 1); // 当前在 :02，不能重放 :01
    assert.match(future.stderr, /当前位置 gate-demo:02/);

    const cur = cli(['exec', '--state', sb.statePath, '--task', 'gate-demo', '--tasks-dir', sb.tasksDir], sb);
    assert.equal(cur.status, 0, cur.stderr); // 缺省 = 当前相位 02
    assert.match(cur.stdout, /等待用户确认/);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- 任务声明适配（v1.3/v1.4）

test('真实任务声明注册：spec:01 → next 开门，用户词汇选项来自 config 声明', () => {
  const sb = sandbox();
  try {
    writeState(sb, ['spec:01'], {
      requirement: { status: 'done', dependOn: [], at: 't' },
      spec: { status: 'running', dependOn: ['requirement'], at: 't' },
      plan: { status: 'pending', dependOn: ['spec'], at: 't' },
    });
    const r = cli(['next', '--state', sb.statePath], sb); // 读仓库 atom-tasks（含声明）
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.openedGates[0].stage, 'spec');
    assert.deepEqual(out.openedGates[0].options.map((o) => o.name), ['同意', '驳回', '修改', '提问']);
    assert.match(out.openedGates[0].options[0].desc, /仅当不存在未解决 BQ/);
    assert.equal(out.openedGates[0].options.find((o) => o.name === '修改').action, 'in-phase');
  } finally {
    cleanup(sb);
  }
});

test('兜底 desc 现算真实下一步：中段人审位（test-plan:02 无门手写 state）→「进入 test-plan:03」', () => {
  const sb = sandbox();
  try {
    writeState(sb, ['test-plan:02'], {
      'test-plan': { status: 'waiting-human', dependOn: [], at: 't' },
      coding: { status: 'pending', dependOn: ['test-plan'], at: 't' },
    });
    const r = cli(['next', '--state', sb.statePath], sb);
    assert.equal(r.status, 1);
    const out = JSON.parse(r.stdout);
    assert.match(out.gates[0].options[0].desc, /进入 test-plan:03（TDD/); // 同阶段下一相位，不再误说「收尾并点亮」
  } finally {
    cleanup(sb);
  }
});

test('兜底 desc 现算真实下一步：末段无后继（reflection:02 无门无后继阶段）→「run 将完成」', () => {
  const sb = sandbox();
  try {
    writeState(sb, ['reflection:02'], { reflection: { status: 'waiting-human', dependOn: [], at: 't' } });
    const r = cli(['next', '--state', sb.statePath], sb);
    assert.equal(r.status, 1);
    const out = JSON.parse(r.stdout);
    assert.match(out.gates[0].options[0].desc, /reflection 收尾（run 将完成）/);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- config 标准格式（v1.4）

test('config 标准格式：仓库全部任务 config 均符合 _schema/task-config.schema.json', () => {
  const { validateTaskConfig } = require(path.join(__dirname, '..', 'lib', 'workflow'));
  const tasksRoot = path.join(__dirname, '..', '..', 'atom-tasks');
  const names = fs.readdirSync(tasksRoot).filter((n) => fs.existsSync(path.join(tasksRoot, n, 'config.json')));
  assert.ok(names.length >= 17, `任务数异常: ${names.length}`);
  for (const n of names) {
    const cfg = JSON.parse(fs.readFileSync(path.join(tasksRoot, n, 'config.json'), 'utf8'));
    assert.doesNotThrow(() => validateTaskConfig(cfg, n), `${n} config 应合法`);
  }
});

test('config 标准格式：非法样例 fail fast（坏相位 id / 坏 type 枚举 / 门选项缺 desc / name 不一致）', () => {
  const { validateTaskConfig } = require(path.join(__dirname, '..', 'lib', 'workflow'));
  assert.throws(
    () => validateTaskConfig({ name: 'x', version: '1.0.0', phases: [{ id: '1', type: 'action' }] }, 'x'),
    /不符合标准格式/
  );
  assert.throws(
    () => validateTaskConfig({ name: 'x', version: '1.0.0', phases: [{ id: '01', type: 'maybe' }] }, 'x'),
    /不符合标准格式/
  );
  assert.throws(
    () => validateTaskConfig({
      name: 'x', version: '1.0.0',
      phases: [{ id: '01', type: 'human', gate: { options: [{ name: '同意', action: 'in-phase' }] } }],
    }, 'x'),
    /不符合标准格式/
  );
  assert.throws(
    () => validateTaskConfig({ name: 'x', version: '1.0.0' }, 'y'),
    /不一致/
  );
  // 增量兼容：新增未知字段放行
  assert.doesNotThrow(() => validateTaskConfig({ name: 'x', version: '1.0.0', futureField: { any: true } }, 'x'));
});

test('run start：config 不符合标准格式的任务 → 装配时 fail fast（不产生半截 run）', () => {
  const sb = sandbox();
  try {
    const dir = path.join(sb.tasksDir, 'bad-config');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'prompt.md'), '# bad-config\n');
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({
      name: 'bad-config', version: '1.0.0',
      phases: [{ id: '01', type: '有时' }], // 非法 type
    }));
    fs.mkdirSync(sb.wfDir, { recursive: true });
    fs.writeFileSync(path.join(sb.wfDir, 'bad.json'), JSON.stringify({
      name: 'bad', version: '1.0.0', stages: [{ task: 'bad-config', dependOn: [] }],
    }));
    const r = cli([
      'run', 'start', '--title', 't', '--project', sb.dir,
      '--workflow', 'bad', '--workflows-dir', sb.wfDir, '--tasks-dir', sb.tasksDir,
    ], sb);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /不符合标准格式/);
  } finally {
    cleanup(sb);
  }
});
