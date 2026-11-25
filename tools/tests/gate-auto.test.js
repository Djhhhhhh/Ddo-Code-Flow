'use strict';
// tools/tests/gate-auto.test.js — gate auto（策略驱动自动门决议，STATE-SPEC §4.3.6）契约测试。
//
// 覆盖：推进分支（present 语义 + decision/closedAt + journal 溯源 command=gate auto）、
// in-phase 分支（既定应答回放 + lastInteractedAt + 行为契约返回 + 重调闭环）、
// 策略未命中硬错（列出选项名）、缺策略 exit 2 / 非法策略 exit 1、env 回退取策略、
// 多门一致决议 / 多门不一致硬错、manual 路径不受影响（present+decide 仍可用）。
// 隔离约定同 present.test.js：mkdtemp 沙箱 + finally 递归删除。

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI = path.join(__dirname, '..', 'cli.js');
const REPO_ATOM_TASKS = path.join(__dirname, '..', '..', 'atom-tasks');

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddo-gate-auto-test-'));
  return {
    dir,
    ddoHome: path.join(dir, 'ddo-home'),
    statePath: path.join(dir, 'run', '.state.json'),
    runDir: path.join(dir, 'run'),
    tasksDir: path.join(dir, 'tasks'),
  };
}

function cleanup(sb) {
  fs.rmSync(sb.dir, { recursive: true, force: true });
}

function cli(args, sb, extraEnv = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: sb.dir,
    env: { ...process.env, DDO_HOME: sb.ddoHome, ...extraEnv },
    encoding: 'utf8',
  });
}

const readBack = (sb) => JSON.parse(fs.readFileSync(sb.statePath, 'utf8'));
const journal = (sb) => fs.readFileSync(path.join(sb.runDir, '.usage.jsonl'), 'utf8')
  .trim().split('\n').map((l) => JSON.parse(l));

function writeState(sb, currentStage, stages) {
  fs.mkdirSync(sb.runDir, { recursive: true });
  fs.writeFileSync(
    sb.statePath,
    JSON.stringify({
      runId: '20261125-230000-ga01',
      title: 'gate auto 测试',
      startedAt: '2026-11-25T23:00:00+08:00',
      git: { mainBranch: 'main' },
      currentStage,
      stages,
      atomTasks: {},
    })
  );
}

const DEMO_OPTIONS = [
  { name: '同意', desc: '确认通过并推进', action: 'next --decision 同意' },
  { name: '驳回', desc: '回滚本阶段重做', action: 'rollback --stage gate-demo' },
  { name: '修改', desc: '按反馈更新后重审', action: 'in-phase' },
  { name: '提问', desc: '只答疑', action: 'in-phase' },
];

function writeTask(sb, name, options = DEMO_OPTIONS, dependOn = []) {
  const dir = path.join(sb.tasksDir, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'prompt.md'), [
    `# ${name}`, '',
    '<!-- @phase:01 -->', '做事。', '<!-- /phase:01 -->', '',
    '<!-- @phase:02 -->', '等待用户确认。', '<!-- /phase:02 -->', '',
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({
    name, version: '2.0.0',
    phases: [
      { id: '01', summary: '做事', type: 'action' },
      { id: '02', summary: '确认门', type: 'human', ...(options ? { gate: { options } } : {}) },
    ],
  }));
}

function writeScenario(sb) {
  writeTask(sb, 'gate-demo');
  writeTask(sb, 'downstream', null, ['gate-demo']);
  writeState(sb, ['gate-demo:02'], {
    'gate-demo': {
      status: 'waiting-human', dependOn: [], at: '2026-11-25T23:00:01+08:00',
      gate: { phase: '02', openedAt: '2026-11-25T23:00:01+08:00', options: DEMO_OPTIONS },
    },
    downstream: { status: 'pending', dependOn: ['gate-demo'], at: '2026-11-25T23:00:01+08:00' },
  });
}

const writePolicy = (sb, obj, name = 'policy.json') => {
  const p = path.join(sb.dir, name);
  fs.writeFileSync(p, JSON.stringify(obj));
  return p;
};

const gateAuto = (sb, policyPath) => cli(['gate', 'auto', '--state', sb.statePath, '--policy', policyPath, '--tasks-dir', sb.tasksDir], sb);

// ---------------------------------------------------------------- 推进分支

test('推进分支：present 语义 + 决议留痕 + 推进 + journal 溯源 gate auto', () => {
  const sb = sandbox();
  try {
    writeScenario(sb);
    const p = writePolicy(sb, { rules: [{ id: 'R1', match: { stage: 'gate-demo', phase: '02' }, prefer: ['同意'] }] });
    const r = gateAuto(sb, p);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.mode, 'advance');
    assert.equal(out.decision, '同意');
    assert.deepEqual(out.presented, ['gate-demo']);
    assert.equal(out.next.closedGates[0].decision, '同意');
    // state：presentedAt + decision/closedAt 留痕；位置已推进（02 → 阶段收尾 + downstream 激活）
    const st = readBack(sb);
    const gate = st.stages['gate-demo'].gate;
    assert.equal(gate.decision, '同意');
    assert.ok(gate.presentedAt && gate.closedAt);
    assert.deepEqual(st.currentStage, ['downstream:01']);
    // journal：presented/decision 事件 command=gate auto，note 含命中规则 id；advanced/activated 同标
    const jl = journal(sb);
    const presented = jl.find((e) => e.event === 'presented');
    assert.equal(presented.command, 'gate auto');
    assert.match(presented.note, /auto:命中R1/);
    const decision = jl.find((e) => e.event === 'decision');
    assert.equal(decision.command, 'gate auto');
    assert.equal(decision.option, '同意');
    assert.match(decision.note, /auto:命中R1/);
    assert.ok(jl.some((e) => e.event === 'activated' && e.stage === 'downstream' && e.command === 'gate auto'));
  } finally {
    cleanup(sb);
  }
});

test('defaults 兜底与 prefer 序内首个存在者生效', () => {
  const sb = sandbox();
  try {
    writeScenario(sb);
    const p = writePolicy(sb, { defaults: { prefer: ['不存在', '同意'] } });
    const r = gateAuto(sb, p);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(r.stdout).decision, '同意');
    assert.deepEqual(JSON.parse(r.stdout).ruleIds, ['defaults']);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- in-phase 分支与重调闭环

test('in-phase 分支：既定应答回放 + lastInteractedAt + 行为契约 + 不推进', () => {
  const sb = sandbox();
  try {
    writeScenario(sb);
    const p = writePolicy(sb, {
      rules: [{ id: 'R2', match: { stage: 'gate-demo' }, inPhase: { 提问: '这是既定的中性应答。' } }],
    });
    const r = gateAuto(sb, p);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.mode, 'in-phase');
    assert.equal(out.inPhase[0].option, '提问');
    assert.equal(out.inPhase[0].应答文本, '这是既定的中性应答。');
    assert.match(out.inPhase[0].行为契约, /重新执行 gate auto/);
    // 不推进；呈现已因交互过期（presentedAt <= lastInteractedAt）
    const gate = readBack(sb).stages['gate-demo'].gate;
    assert.equal(gate.decision, undefined);
    assert.ok(gate.lastInteractedAt);
    assert.ok(!(gate.presentedAt > gate.lastInteractedAt));
    assert.deepEqual(readBack(sb).currentStage, ['gate-demo:02']);
    // journal：interacted 事件含 auto 命中与应答文本
    const it = journal(sb).find((e) => e.event === 'interacted');
    assert.equal(it.option, '提问');
    assert.equal(it.command, 'gate auto');
    assert.match(it.note, /auto:命中R2｜应答：这是既定的中性应答。/);
  } finally {
    cleanup(sb);
  }
});

test('重调闭环：in-phase 应答后换策略再 gate auto → 决议推进（呈现重新盖）', () => {
  const sb = sandbox();
  try {
    writeScenario(sb);
    const p1 = writePolicy(sb, { rules: [{ id: 'R2', match: { stage: 'gate-demo' }, inPhase: { 提问: '按你的假设继续。' } }] }, 'p1.json');
    const p2 = writePolicy(sb, { defaults: { prefer: ['同意'] } }, 'p2.json');
    assert.equal(gateAuto(sb, p1).status, 0);
    const r2 = gateAuto(sb, p2); // 重新呈现（I-G1）+ 决议
    assert.equal(r2.status, 0, r2.stderr);
    const out = JSON.parse(r2.stdout);
    assert.equal(out.mode, 'advance');
    const gate = readBack(sb).stages['gate-demo'].gate;
    assert.equal(gate.decision, '同意');
    assert.ok(gate.presentedAt > gate.lastInteractedAt); // 新呈现晚于交互
  } finally {
    cleanup(sb);
  }
});

test('动态选项（真实 spec 钩子）：inPhase 命中 回答BQ-N 既定答案', () => {
  const sb = sandbox();
  try {
    // 真实 spec 任务 + spec.md 含未解决 BQ → present 钩子现算动态选项
    writeState(sb, ['spec:02'], {
      requirement: { status: 'done', dependOn: [], at: '2026-11-25T23:00:01+08:00' },
      spec: {
        status: 'waiting-human', dependOn: ['requirement'], at: '2026-11-25T23:00:01+08:00',
        gate: {
          phase: '02', openedAt: '2026-11-25T23:00:01+08:00',
          options: [
            { name: '同意', desc: '批准当前 spec', action: 'next --decision 同意' },
            { name: '驳回', desc: '回滚 spec 阶段', action: 'rollback --stage spec' },
            { name: '修改', desc: '按反馈更新后重审', action: 'in-phase' },
            { name: '提问', desc: '只答疑', action: 'in-phase' },
          ],
        },
      },
    });
    fs.writeFileSync(path.join(sb.runDir, 'spec.md'),
      '# Spec\n\n## 需要用户确认\n\n- **BQ-1**：覆盖时刻只做门还是全部统一？\n');
    const p = writePolicy(sb, {
      rules: [{ id: 'BQ', match: { stage: 'spec', phase: '02' }, prefer: ['同意'], inPhase: { '回答BQ-1': '只做门。' } }],
    });
    const r = cli(['gate', 'auto', '--state', sb.statePath, '--policy', p, '--tasks-dir', REPO_ATOM_TASKS], sb);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.mode, 'in-phase');
    assert.equal(out.inPhase[0].option, '回答BQ-1');
    assert.equal(out.inPhase[0].应答文本, '只做门。');
    const it = JSON.parse(fs.readFileSync(path.join(sb.runDir, '.usage.jsonl'), 'utf8').trim().split('\n').pop());
    assert.equal(it.event, 'interacted');
    assert.equal(it.option, '回答BQ-1');
    assert.match(it.note, /应答：只做门。/);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- 硬错与用法错误

test('策略未命中 → exit 1 硬错并列出选项名（不回退、不自由生成）', () => {
  const sb = sandbox();
  try {
    writeScenario(sb);
    const p = writePolicy(sb, { defaults: { prefer: ['不存在的选项'] } });
    const r = gateAuto(sb, p);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /策略未命中/);
    assert.match(r.stderr, /同意/); // 选项名重发
    assert.equal(readBack(sb).stages['gate-demo'].gate.decision, undefined); // 未动 state 决议
  } finally {
    cleanup(sb);
  }
});

test('缺 --policy 且无环境变量 → exit 2；非法 JSON → exit 1', () => {
  const sb = sandbox();
  try {
    writeScenario(sb);
    const r = cli(['gate', 'auto', '--state', sb.statePath, '--tasks-dir', sb.tasksDir], sb);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /--policy/);
    const bad = path.join(sb.dir, 'bad.json');
    fs.writeFileSync(bad, '{not json');
    const r2 = gateAuto(sb, bad);
    assert.equal(r2.status, 1);
    assert.match(r2.stderr, /非法 JSON/);
  } finally {
    cleanup(sb);
  }
});

test('环境变量 DDO_GATE_AUTO_POLICY 回退生效', () => {
  const sb = sandbox();
  try {
    writeScenario(sb);
    const p = writePolicy(sb, { defaults: { prefer: ['同意'] } }, 'env-policy.json');
    const r = cli(['gate', 'auto', '--state', sb.statePath, '--tasks-dir', sb.tasksDir], sb, { DDO_GATE_AUTO_POLICY: p });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(r.stdout).decision, '同意');
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- 多门并发

function writeDualScenario(sb) {
  writeTask(sb, 'alpha');
  writeTask(sb, 'beta');
  writeState(sb, ['alpha:02', 'beta:02'], {
    alpha: {
      status: 'waiting-human', dependOn: [], at: '2026-11-25T23:00:01+08:00',
      gate: { phase: '02', openedAt: '2026-11-25T23:00:01+08:00', options: DEMO_OPTIONS },
    },
    beta: {
      status: 'waiting-human', dependOn: [], at: '2026-11-25T23:00:01+08:00',
      gate: { phase: '02', openedAt: '2026-11-25T23:00:01+08:00', options: DEMO_OPTIONS },
    },
  });
}

test('多门一致决议：一次 gate auto 关闭两门并双双推进', () => {
  const sb = sandbox();
  try {
    writeDualScenario(sb);
    const p = writePolicy(sb, { defaults: { prefer: ['同意'] } });
    const r = gateAuto(sb, p);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.next.closedGates.length, 2);
    const st = readBack(sb);
    assert.equal(st.stages.alpha.gate.decision, '同意');
    assert.equal(st.stages.beta.gate.decision, '同意');
    assert.ok(st.stages.alpha.status === 'done' && st.stages.beta.status === 'done');
  } finally {
    cleanup(sb);
  }
});

test('多门不一致决议 → exit 1 说明（不支持单次混合自动）', () => {
  const sb = sandbox();
  try {
    writeDualScenario(sb);
    const p = writePolicy(sb, {
      rules: [
        { id: 'RA', match: { stage: 'alpha' }, prefer: ['同意'] },
        { id: 'RB', match: { stage: 'beta' }, prefer: ['驳回'] },
      ],
    });
    const r = gateAuto(sb, p);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /不一致/);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- manual 路径不受影响

test('manual 不受影响：gate auto 之后人工 present/decide 仍照常工作', () => {
  const sb = sandbox();
  try {
    writeScenario(sb);
    const p = writePolicy(sb, { defaults: { prefer: ['不存在'] } }); // 未命中不落任何决议
    assert.equal(gateAuto(sb, p).status, 1);
    const present = cli(['gate', 'present', '--state', sb.statePath, '--tasks-dir', sb.tasksDir], sb);
    assert.equal(present.status, 0, present.stderr);
    const decide = cli(['next', '--state', sb.statePath, '--decision', '同意', '--tasks-dir', sb.tasksDir], sb);
    assert.equal(decide.status, 0, decide.stderr);
    assert.equal(readBack(sb).stages['gate-demo'].gate.decision, '同意');
  } finally {
    cleanup(sb);
  }
});
