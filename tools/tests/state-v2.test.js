'use strict';
// tools/tests/state-v2.test.js — schema v2 契约测试（STATE-SPEC / issue #86 P-5 用例清单）。
//
// 覆盖：①WRITER_ALLOWLIST 快照断言 + strictViolations 行为矩阵（§4.4 同源驱动）；
// ②dogfood SOP 走查（§6：run-started→登记→presented→interacted→decision→finished，
//   含 V-1 state 有界 / V-3 gate 无 interactions / V-8 --note 只进日志 / zip 含日志）；
// ③E 区登记与回滚清除对账（V-4 使用史保留、_del/ 归档、clearedArtifacts）；
// ④dirs 声明逐文件登记+整目录归档+validate 目录检查（V-6）与 V-7 负向（updates 弱校验不变）；
// ⑤v1 容错（无 schemaVersion + interactions[] 折算拦截/放行）；
// ⑥interacted 双写崩溃窗口（日志失败→保守拦截）；⑦DDO_STATE_STRICT=1 全流程零误报。
// 隔离约定同前：mkdtemp 沙箱 + finally 递归删除；自定义任务/预设写在沙箱经 flag 传入。

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { WRITER_ALLOWLIST, strictViolations } = require('../lib/state');

const CLI = path.join(__dirname, '..', 'cli.js');

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddo-state-v2-test-'));
  return {
    dir,
    ddoHome: path.join(dir, 'ddo-home'),
    statePath: path.join(dir, 'proj', '.ddo', 'runs', 'feat', 'r1', '.state.json'),
    runDir: path.join(dir, 'proj', '.ddo', 'runs', 'feat', 'r1'),
    tasksDir: path.join(dir, 'tasks'),
    wfDir: path.join(dir, 'wf'),
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
const readJournal = (sb) => fs.readFileSync(path.join(sb.runDir, '.usage.jsonl'), 'utf8')
  .trim().split('\n').map((l) => JSON.parse(l));
const shaOf = (buf) => createHash('sha256').update(buf).digest('hex');

/** 双相位任务：01 action 产 {files,dirs}，02 human {updates}（含标准四选项门）。 */
function writeDemoTask(sb, name = 'demo-a', output01 = { files: ['a.md'], dirs: ['plans'] }) {
  const dir = path.join(sb.tasksDir, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'prompt.md'), `# ${name}\n\n做事。\n`);
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({
    name,
    version: '2.0.0',
    desc: `${name} 测试任务`,
    phases: [
      { id: '01', summary: '产出', type: 'action', output: output01 },
      { id: '02', summary: '确认', type: 'human', output: { updates: ['a.md'] }, gate: { options: [
        { name: '同意', desc: '通过', action: 'next --decision 同意' },
        { name: '驳回', desc: '回滚', action: `rollback --stage ${name}` },
        { name: '修改', desc: '改', action: 'in-phase' },
        { name: '提问', desc: '问', action: 'in-phase' },
      ] } },
    ],
  }, null, 2));
}

/** 单相位 action 任务（string / updates 声明可配）。 */
function writeSimpleTask(sb, name, output) {
  const dir = path.join(sb.tasksDir, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'prompt.md'), `# ${name}\n\n做事。\n`);
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ name, version: '2.0.0', desc: `${name}`, output }, null, 2));
}

function writeWorkflow(sb, stages, name = 'demo') {
  fs.mkdirSync(sb.wfDir, { recursive: true });
  fs.writeFileSync(path.join(sb.wfDir, `${name}.json`), JSON.stringify({ name, version: '1.0.0', stages }, null, 2));
}

function startRun(sb, wf = 'demo') {
  const r = cli(['run', 'start', '--title', 'v2 测试', '--workflow', wf, '--type', 'feat',
    '--project', path.join(sb.dir, 'proj'), '--dir-name', 'r1',
    '--tasks-dir', sb.tasksDir, '--workflows-dir', sb.wfDir], sb);
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

const GATE_OPT = (name) => [
  { name: '同意', desc: '通过', action: 'next --decision 同意' },
  { name: '驳回', desc: '回滚', action: 'rollback --stage demo-a' },
  { name: '修改', desc: '改', action: 'in-phase' },
  { name: '提问', desc: '问', action: 'in-phase' },
];

// ---------------------------------------------------------------- ① 白名单快照 + 行为矩阵

test('WRITER_ALLOWLIST 快照断言（§4.4 表同源）+ strictViolations 行为矩阵', () => {
  // 快照：规范表逐字对齐（规范与测试同源）
  assert.deepEqual(WRITER_ALLOWLIST, {
    'run start':      ['*create*'],
    'next':           ['currentStage', 'stages', 'artifacts'],
    'gate present':   ['stages.*.gate.presentedAt', 'stages.*.gate'],
    'gate interact':  ['stages.*.gate.lastInteractedAt'],
    'rollback':       ['currentStage', 'stages', 'artifacts'],
    'subflow start':  ['*create*child*', 'subflows'],
    'subflow close':  ['subflows'],
    'run finish':     ['currentStage'],
  });
  assert.equal(WRITER_ALLOWLIST.exec, undefined); // 纯读命令不在表内 = 空集
  // 行为：创建命令全量放行
  const base = { runId: 'x', title: 't', currentStage: [], stages: {} };
  assert.deepEqual(strictViolations(null, { ...base, schemaVersion: 2 }, 'run start'), []);
  assert.deepEqual(strictViolations(null, base, 'subflow start'), []);
  // 行为：白名单内字段变更放行
  assert.deepEqual(strictViolations(base, { ...base, currentStage: ['a:01'] }, 'run finish'), []);
  assert.deepEqual(strictViolations(base, { ...base, stages: { a: { status: 'running' } }, artifacts: { a: [] } }, 'next'), []);
  assert.deepEqual(strictViolations(base, { ...base, stages: { a: { gate: { presentedAt: 't' } } } }, 'gate present'), []);
  assert.deepEqual(strictViolations(base, { ...base, subflows: [] }, 'subflow close'), []);
  // 行为：越白名单拦截（A/B 区冻结）
  assert.deepEqual(strictViolations(base, { ...base, title: '改' }, 'next'), ['title']);
  assert.deepEqual(strictViolations(base, { ...base, schemaVersion: 3 }, 'gate interact'), ['schemaVersion']);
  // 行为：纯读命令任意变更拦截（空集）
  assert.deepEqual(strictViolations(base, { ...base, stages: { a: {} } }, 'status'), ['stages']);
  assert.deepEqual(strictViolations(base, { ...base, currentStage: ['a:01'] }, 'validate'), ['currentStage']);
});

// ---------------------------------------------------------------- ② dogfood SOP 走查（§6 基准）

test('dogfood SOP：v2 字段→登记→呈现→交互→决议→收尾，V-1/V-3/V-8 + zip 含日志', () => {
  const sb = sandbox();
  try {
    writeDemoTask(sb);
    writeSimpleTask(sb, 'demo-b', 'b.md');
    writeWorkflow(sb, [{ task: 'demo-a', dependOn: [] }, { task: 'demo-b', dependOn: ['demo-a'] }]);
    const started = startRun(sb);
    // Step 0：run start 创建 v2 骨架 + 首事件
    assert.equal(started.currentStage[0], 'demo-a:01');
    assert.equal(readBack(sb).schemaVersion, 2);
    assert.equal(readBack(sb).workflow, 'demo');
    assert.deepEqual(readJournal(sb).map((e) => e.event), ['run-started']);
    assert.equal(readJournal(sb)[0].seq, 1);

    // Step 1–3：产物 + validate（纯读：state 与日志零变化）
    fs.mkdirSync(path.join(sb.runDir, 'plans'), { recursive: true });
    fs.writeFileSync(path.join(sb.runDir, 'a.md'), '# a\n');
    fs.writeFileSync(path.join(sb.runDir, 'plans', '01-x.md'), '# x\n');
    fs.writeFileSync(path.join(sb.runDir, 'plans', '02-y.md'), '# y\n');
    const stateBefore = fs.readFileSync(sb.statePath, 'utf8');
    const v = cli(['validate', '--state', sb.statePath, '--task', 'demo-a', '--phase', '01'], sb);
    assert.equal(v.status, 0, v.stderr);
    assert.equal(fs.readFileSync(sb.statePath, 'utf8'), stateBefore); // R-4 纯读
    assert.equal(readJournal(sb).length, 1);

    // Step 4：next——门开 + E 区登记（3 文件逐一对账）
    const n1 = cli(['next', '--state', sb.statePath], sb);
    assert.equal(n1.status, 0, n1.stderr);
    const st1 = readBack(sb);
    assert.ok(st1.stages['demo-a'].gate);
    const reg = st1.artifacts['demo-a'].find((e) => e.phase === '01');
    assert.equal(reg.trigger, 'next');
    assert.deepEqual(reg.files.map((f) => f.path), ['a.md', 'plans/01-x.md', 'plans/02-y.md']);
    assert.equal(reg.files[0].bytes, 4);
    assert.equal(reg.files[0].sha256, shaOf(Buffer.from('# a\n')));
    assert.deepEqual(readJournal(sb).map((e) => e.event), ['run-started', 'advanced', 'artifacts-recorded']);

    // Step 5：present --note（V-8：摘要进日志、不进 state）
    const p = cli(['gate', 'present', '--state', sb.statePath, '--note', '做了什么：完成 a.md 与分册；结论：待审'], sb);
    assert.equal(p.status, 0, p.stderr);
    const payload = JSON.parse(p.stdout);
    assert.match(payload.hint, /--note/);
    const presented = readJournal(sb).filter((e) => e.event === 'presented').pop();
    assert.equal(presented.note, '做了什么：完成 a.md 与分册；结论：待审');
    assert.equal(readBack(sb).stages['demo-a'].gate.note, undefined); // note 不进 state

    // Step 6：V-1/V-3——首次交互建立标量后，后续交互 state 字节数不变（覆盖式，无界增长消除）
    const i0 = cli(['gate', 'interact', '--state', sb.statePath, '--option', '修改', '--note', '反馈零'], sb);
    assert.equal(i0.status, 0, i0.stderr);
    const bytesAfterFirst = fs.statSync(sb.statePath).size;
    for (const note of ['反馈一', '反馈二', '反馈三']) {
      const i = cli(['gate', 'interact', '--state', sb.statePath, '--option', '修改', '--note', note], sb);
      assert.equal(i.status, 0, i.stderr);
    }
    const gate = readBack(sb).stages['demo-a'].gate;
    assert.equal(gate.interactions, undefined);          // V-3：数组停写
    assert.ok(gate.lastInteractedAt);                    // V-3：标量在
    assert.equal(fs.statSync(sb.statePath).size, bytesAfterFirst); // V-1：标量覆盖、字节数不变
    const interacted = readJournal(sb).filter((e) => e.event === 'interacted');
    assert.equal(interacted.length, 4);
    assert.equal(interacted[3].note, '反馈三');           // V-2：note 全文在日志

    // Step 7–8：决议被拦 → 重新 present → 同意（updates 相位登记 + 后继点亮）
    const blocked = cli(['next', '--state', sb.statePath, '--decision', '同意'], sb);
    assert.equal(blocked.status, 1);
    assert.equal(JSON.parse(blocked.stdout).blocked, 'gate-unpresented');
    assert.equal(cli(['gate', 'present', '--state', sb.statePath], sb).status, 0);
    const ok = cli(['next', '--state', sb.statePath, '--decision', '同意'], sb);
    assert.equal(ok.status, 0, ok.stderr);
    const st2 = readBack(sb);
    assert.equal(st2.stages['demo-a'].gate.decision, '同意');
    assert.equal(st2.stages['demo-a'].status, 'done');
    assert.equal(st2.stages['demo-b'].status, 'running');
    const reg02 = st2.artifacts['demo-a'].find((e) => e.phase === '02'); // updates 相位关门登记
    assert.deepEqual(reg02.files.map((f) => f.path), ['a.md']);
    const ev2 = readJournal(sb).map((e) => e.event).slice(-3);
    assert.deepEqual(ev2, ['decision', 'activated', 'artifacts-recorded']); // SOP 顺序（demo-a:02 为末相位，无 advanced）

    // 收尾阶段：demo-b 产出 + 推进至完成
    fs.writeFileSync(path.join(sb.runDir, 'b.md'), '# b\n');
    assert.equal(cli(['validate', '--state', sb.statePath, '--task', 'demo-b', '--phase', '01'], sb).status, 0);
    const n2 = cli(['next', '--state', sb.statePath], sb);
    assert.equal(JSON.parse(n2.stdout).completed, true);

    // Step 9：finish——finished 先于 zip；zip 含 .usage.jsonl；currentStage 清空（I-7）
    const fin = cli(['run', 'finish', '--state', sb.statePath, '--status', 'done'], sb);
    assert.equal(fin.status, 0, fin.stderr);
    const journalEnd = readJournal(sb);
    assert.equal(journalEnd[journalEnd.length - 1].event, 'finished');
    assert.equal(journalEnd[journalEnd.length - 1].detail, 'done');
    assert.deepEqual(readBack(sb).currentStage, []);
    const zipPath = path.join(sb.ddoHome, 'history', `${started.runId}.zip`);
    assert.ok(fs.existsSync(zipPath));
    const listing = spawnSync('unzip', ['-l', zipPath], { encoding: 'utf8' });
    assert.match(listing.stdout, /\.usage\.jsonl/); // 日志随 runDir 进归档
    const runs = fs.readFileSync(path.join(sb.ddoHome, 'history', 'runs.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.equal(runs[runs.length - 1].runId, started.runId);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- ③ E 区登记与回滚清除对账（V-4）

test('回滚：artifacts 条目清除 + _del/ 归档对账 + 使用史保留（V-4）', () => {
  const sb = sandbox();
  try {
    writeDemoTask(sb);
    writeWorkflow(sb, [{ task: 'demo-a', dependOn: [] }]);
    startRun(sb);
    fs.mkdirSync(path.join(sb.runDir, 'plans'), { recursive: true });
    fs.writeFileSync(path.join(sb.runDir, 'a.md'), '# a\n');
    fs.writeFileSync(path.join(sb.runDir, 'plans', '01-x.md'), '# x\n');
    assert.equal(cli(['next', '--state', sb.statePath], sb).status, 0); // 门开+登记
    assert.ok(readBack(sb).artifacts['demo-a'].length);
    const interactCount = 2;
    for (let k = 0; k < interactCount; k++) {
      assert.equal(cli(['gate', 'interact', '--state', sb.statePath, '--option', '提问', '--note', `问${k}`], sb).status, 0);
    }
    assert.equal(cli(['gate', 'present', '--state', sb.statePath], sb).status, 0); // 呈现后 rollback 放行

    const rb = cli(['rollback', '--state', sb.statePath, '--stage', 'demo-a', '--reason', '方向不符'], sb);
    assert.equal(rb.status, 0, rb.stderr);
    const out = JSON.parse(rb.stdout);
    assert.deepEqual(out.clearedArtifacts, ['demo-a']);
    assert.equal(readBack(sb).artifacts, undefined); // 当前有效集清除、空段不残留
    assert.ok(fs.existsSync(path.join(sb.runDir, '_del', 'rollback-1', 'a.md')));
    assert.ok(fs.existsSync(path.join(sb.runDir, '_del', 'rollback-1', 'plans', '01-x.md'))); // 整目录归档
    const after = readJournal(sb);
    assert.equal(after.filter((e) => e.event === 'interacted').length, interactCount); // V-4：使用史保留
    assert.equal(after[after.length - 1].event, 'rollback');
    assert.equal(after[after.length - 1].note, '方向不符');
    assert.equal(readBack(sb).stages['demo-a'].gate, undefined); // 协议对象已删
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- ④ dirs 声明（V-6）+ V-7 负向

test('validate 目录检查：缺失/空目录拦截；V-7 负向：updates 弱校验不变', () => {
  const sb = sandbox();
  try {
    writeDemoTask(sb);
    writeWorkflow(sb, [{ task: 'demo-a', dependOn: [] }]);
    startRun(sb);
    fs.writeFileSync(path.join(sb.runDir, 'a.md'), '# a\n');
    // plans 缺失 → 校验失败（目录存在且非空）
    const miss = cli(['validate', '--state', sb.statePath, '--task', 'demo-a', '--phase', '01'], sb);
    assert.equal(miss.status, 1);
    fs.mkdirSync(path.join(sb.runDir, 'plans'));
    const empty = cli(['validate', '--state', sb.statePath, '--task', 'demo-a', '--phase', '01'], sb);
    assert.equal(empty.status, 1); // 空目录同样拦截
    fs.writeFileSync(path.join(sb.runDir, 'plans', '01-x.md'), 'x');
    assert.equal(cli(['validate', '--state', sb.statePath, '--task', 'demo-a', '--phase', '01'], sb).status, 0);
  } finally {
    cleanup(sb);
  }
  // V-7 负向：{updates} 相位只查存在性——垃圾内容照样通过（不得顺手加强）
  const sb2 = sandbox();
  try {
    writeSimpleTask(sb2, 'demo-u', { updates: ['u.md'] });
    writeWorkflow(sb2, [{ task: 'demo-u', dependOn: [] }], 'upd');
    startRun(sb2, 'upd');
    fs.writeFileSync(path.join(sb2.runDir, 'u.md'), '这不是 markdown，也不是 JSON {{{');
    const vu = cli(['validate', '--state', sb2.statePath, '--task', 'demo-u', '--phase', '01'], sb2);
    assert.equal(vu.status, 0, vu.stderr);
    assert.equal(JSON.parse(vu.stdout).validated, true);
  } finally {
    cleanup(sb2);
  }
});

// ---------------------------------------------------------------- ⑤ v1 容错（零迁移）

test('v1 存量 state：无 schemaVersion + interactions[] 折算（拦截/放行两分支）', () => {
  const sb = sandbox();
  try {
    writeDemoTask(sb);
    writeWorkflow(sb, [{ task: 'demo-a', dependOn: [] }]);
    const mk = (lastAt, presentedAt) => {
      fs.mkdirSync(sb.runDir, { recursive: true });
      fs.writeFileSync(sb.statePath, JSON.stringify({
        runId: '20261110-115700-df51',
        title: 'v1 存量',
        startedAt: '2026-11-10T11:57:00.000+08:00',
        git: { mainBranch: 'main' },
        dirs: { projectRoot: path.join(sb.dir, 'proj'), runDir: sb.runDir, tasksDir: sb.tasksDir },
        currentStage: ['demo-a:02'],
        stages: { 'demo-a': { status: 'waiting-human', dependOn: [], at: 't', gate: {
          phase: '02', openedAt: '2026-11-10T10:00:00.000+08:00',
          options: GATE_OPT(), presentedAt,
          interactions: [{ option: '修改', at: lastAt, note: '旧反馈' }],
        } } },
        atomTasks: {},
      }, null, 2));
    };
    // 放行分支：presented(10:05) > 末元素 at(10:03) → 决议可推进（v1 run 混态，无 schemaVersion 不补写）
    mk('2026-11-10T10:03:00.000+08:00', '2026-11-10T10:05:00.000+08:00');
    const st = cli(['status', '--state', sb.statePath], sb);
    assert.equal(st.status, 0, st.stderr); // v1 通过新 assertState（零迁移）
    fs.writeFileSync(path.join(sb.runDir, 'a.md'), '# a\n');
    const ok = cli(['next', '--state', sb.statePath, '--decision', '同意'], sb);
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(readBack(sb).schemaVersion, undefined); // 不补写版本号
    // 拦截分支：末元素 at(10:06) > presented(10:05) → 保守拦截
    mk('2026-11-10T10:06:00.000+08:00', '2026-11-10T10:05:00.000+08:00');
    const blocked = cli(['next', '--state', sb.statePath, '--decision', '同意'], sb);
    assert.equal(blocked.status, 1);
    assert.equal(JSON.parse(blocked.stdout).blocked, 'gate-unpresented');
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- ⑥ interacted 双写崩溃窗口

test('崩溃窗口：日志追加失败 → state 标量已写 + stderr 警告 + 呈现判定保守拦截', () => {
  const sb = sandbox();
  try {
    writeDemoTask(sb);
    writeWorkflow(sb, [{ task: 'demo-a', dependOn: [] }]);
    startRun(sb);
    fs.writeFileSync(path.join(sb.runDir, 'a.md'), '# a\n');
    assert.equal(cli(['next', '--state', sb.statePath], sb).status, 0);
    assert.equal(cli(['gate', 'present', '--state', sb.statePath], sb).status, 0);
    // 制造日志失败：.usage.jsonl 替换为目录（atomicWrite rename 到目录路径必败）
    fs.rmSync(path.join(sb.runDir, '.usage.jsonl'));
    fs.mkdirSync(path.join(sb.runDir, '.usage.jsonl'));
    const i = cli(['gate', 'interact', '--state', sb.statePath, '--option', '修改', '--note', '反馈'], sb);
    assert.equal(i.status, 0, i.stderr); // appendAudit 不回滚 state、不阻断命令
    assert.match(i.stderr, /审计事件追加失败/);
    const gate = readBack(sb).stages['demo-a'].gate;
    assert.ok(gate.lastInteractedAt); // 镜像已新（先 state 后日志）
    assert.ok(gate.lastInteractedAt > gate.presentedAt);
    // 保守拦截：呈现判定只看 state 标量——决议被拦，要求重新呈现
    const blocked = cli(['next', '--state', sb.statePath, '--decision', '同意'], sb);
    assert.equal(blocked.status, 1);
    assert.equal(JSON.parse(blocked.stdout).blocked, 'gate-unpresented');
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- ⑦ STRICT 全流程零误报

test('DDO_STATE_STRICT=1：全生命周期零误报（start→next→present→interact→decide→finish）', () => {
  const sb = sandbox();
  try {
    writeDemoTask(sb);
    writeWorkflow(sb, [{ task: 'demo-a', dependOn: [] }]);
    const strict = { DDO_STATE_STRICT: '1' };
    const r = cli(['run', 'start', '--title', 'strict', '--workflow', 'demo', '--type', 'feat',
      '--project', path.join(sb.dir, 'proj'), '--dir-name', 'r1',
      '--tasks-dir', sb.tasksDir, '--workflows-dir', sb.wfDir], sb, strict);
    assert.equal(r.status, 0, r.stderr);
    fs.writeFileSync(path.join(sb.runDir, 'a.md'), '# a\n');
    fs.mkdirSync(path.join(sb.runDir, 'plans'), { recursive: true });
    fs.writeFileSync(path.join(sb.runDir, 'plans', '01-x.md'), 'x');
    for (const args of [
      ['status', '--state', sb.statePath],
      ['validate', '--state', sb.statePath, '--task', 'demo-a', '--phase', '01'],
      ['next', '--state', sb.statePath],
      ['gate', 'present', '--state', sb.statePath, '--note', '摘要'],
      ['gate', 'interact', '--state', sb.statePath, '--option', '提问'],
      ['gate', 'present', '--state', sb.statePath],
      ['next', '--state', sb.statePath, '--decision', '同意'],
      ['run', 'finish', '--state', sb.statePath, '--status', 'done'],
    ]) {
      const out = cli(args, sb, strict);
      assert.equal(out.status, 0, `${args.join(' ')} → ${out.stderr}`);
      assert.doesNotMatch(out.stderr, /\[STRICT\]/);
    }
  } finally {
    cleanup(sb);
  }
});
