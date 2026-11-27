'use strict';
// eval/bench 单测：profile 装配校验、policy 同源生成与应答查表、轨迹解析；
// issue #94 报告层重构——report 子命令、核心集渲染（对照表/平铺/无结论段）、文案单源。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { assembleProfile, ProfileError } = require('../src/profile');
const policyLib = require('../src/policy');
const traj = require('../src/collect/trajectory');
const sandboxLib = require('../src/sandbox');

test('qpack schema：四题真实 qpack.json 通过 readQpack；负向样例逐项拦截', () => {
  for (const q of ['q_export-command', 'q_regression-trap', 'q_threejs-orbit-scene', 'q_threejs-reactor-bay']) {
    const qpack = sandboxLib.readQpack(sandboxLib.resolvePack(q));
    assert.equal(typeof qpack.title, 'string');
    assert.ok(['code', 'page'].includes(qpack.form));
  }
  const threejs = sandboxLib.readQpack(sandboxLib.resolvePack('q_threejs-orbit-scene'));
  assert.equal(threejs.form, 'page');
  assert.equal(threejs.changeWhitelist, undefined); // page 题省略
  const reactor = sandboxLib.readQpack(sandboxLib.resolvePack('q_threejs-reactor-bay'));
  assert.equal(reactor.form, 'page');
  assert.equal(reactor.changeWhitelist, undefined);
  const regression = sandboxLib.readQpack(sandboxLib.resolvePack('q_regression-trap'));
  assert.equal(regression.form, 'code');
  assert.ok(Array.isArray(regression.changeWhitelist) && regression.changeWhitelist.length > 0);

  // 负向：临时目录构造非法 qpack（缺 title / form 非法 / track 非法 / code 缺白名单 / page 带白名单）
  const mk = (obj) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-qpack-'));
    fs.writeFileSync(path.join(dir, 'qpack.json'), JSON.stringify(obj));
    return dir;
  };
  const base = { title: 't', form: 'code', track: 'execute', changeWhitelist: ['lib/'] };
  assert.throws(() => sandboxLib.readQpack(mk({ ...base, title: '' })), /title/);
  assert.throws(() => sandboxLib.readQpack(mk({ ...base, form: 'widget' })), /form/);
  assert.throws(() => sandboxLib.readQpack(mk({ ...base, track: 'magic' })), /track/);
  assert.throws(() => sandboxLib.readQpack(mk({ title: 't', form: 'code', track: 'execute' })), /changeWhitelist/);
  assert.throws(() => sandboxLib.readQpack(mk({ title: 't', form: 'page', track: 'ui', changeWhitelist: ['lib/'] })), /changeWhitelist/);
});

test('profile（issue #94 收缩）：不装配 reports；旧 reports 键静默忽略；其余校验保留', () => {
  const p = assembleProfile({ cliTasks: ['q1', 'q2'] });
  assert.equal('reports' in p, false);
  assert.equal(p.dimensions.cost, true);
  const p2 = assembleProfile({ cliTasks: ['q1'], profileObj: { reports: ['nope'] } });
  assert.equal('reports' in p2, false); // 语义收缩：不再对该键报错
  assert.throws(() => assembleProfile({ cliTasks: ['q1'], profileObj: { dimensions: { bad: true } } }), ProfileError);
  assert.throws(() => assembleProfile({ cliTasks: ['q1'], profileObj: { tasks: ['qX'] } }), ProfileError);
  assert.throws(() => assembleProfile({}), ProfileError); // 题单为空
});

test('policy：gate auto 策略把 回答BQ-N 映射到冻结 fallback；两通道同源', () => {
  const clarify = {
    fallback: '按你的假设继续，并显式记录该假设。',
    items: [{ id: 'C1', keywords: ['球面'], answer: '条目应答A' }],
  };
  const policy = policyLib.materializePolicy(policyLib.buildGateAutoPolicy(clarify));
  const specRule = policy.rules.find((r) => r.match.stage === 'spec');
  assert.equal(specRule.inPhase['回答BQ-3'], clarify.fallback);
  assert.deepEqual(specRule.prefer, ['同意']);
  const table = policyLib.buildResponderTable(clarify);
  assert.equal(policyLib.lookupAnswer(table, '卫星球面均匀怎么定？').text, '条目应答A');
  assert.equal(policyLib.lookupAnswer(table, '无关问题').hitId, 'fallback');
  assert.equal(policyLib.lookupAnswer(table, '无关问题').text, clarify.fallback);
});

test('trajectory：stream 解析 → 读/写/测试/提问分类', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-traj-'));
  try {
    const stream = path.join(dir, 's.jsonl');
    const mk = (name, input) => JSON.stringify({ type: 'assistant', timestamp: '2026-11-25T23:00:00Z', message: { content: [{ type: 'tool_use', name, input }] } });
    fs.writeFileSync(stream, [
      mk('Read', { file_path: 'a.js' }),
      mk('Grep', { pattern: 'x' }),
      mk('Write', { file_path: 'out.md' }),
      mk('Bash', { command: 'node --test tests/' }),
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: '已运行全部测试，测试通过' }] } }),
      'not-json-line',
    ].join('\n') + '\n');
    const t = traj.parseArmStream(stream);
    const bc = traj.beforeCoding(t);
    assert.equal(bc.readsBeforeCoding, 2); // 首个 Write 之前的读类调用
    assert.equal(traj.testRuns(t).testRunCount, 1);
    assert.equal(traj.claims(t).claimCount, 1);
    assert.equal(traj.beforeCoding(t).researchTurns >= 1, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('核心集渲染（issue #94）：声明参数化；card 无结论段有预期行为对照；summary 平铺表', () => {
  const { renderCard, renderSummary, declarationsFor } = require('../src/report/render');
  const decl = declarationsFor(3);
  assert.ok(decl.includes('3 题小样本'));
  assert.ok(!decl.includes('2–3 题'));
  const process = {
    signals: [
      { signal: '先对齐再动手', rows: [{ arm: 'baseline', binary: false }, { arm: 'ddo', binary: true }] },
      { signal: '澄清对称性', rows: [{ arm: 'both', binary: true }] },
    ],
  };
  const card = renderCard({
    model: 'm', qName: 'q_x', qTitle: 'T', form: 'code',
    result: { baseline: { ok: true, acceptance: '3/3', regression: '7/7', changedFiles: 2, outOfScopeFiles: 0 }, ddo: { ok: true, acceptance: '3/3', regression: '7/7', changedFiles: 3, outOfScopeFiles: 0 } },
    process, token: { groups: [] },
    armReportDirs: { baseline: '/b', ddo: '/d' },
    expectedBehaviors: ['编码前产出对照 20 条要求的 checklist', '未匹配任何信号的条目'],
    taskCount: 3,
  });
  assert.ok(card.includes('## 预期行为对照'));
  assert.ok(card.includes('无对应信号')); // 未命中映射如实标注
  assert.ok(card.includes('3 题小样本')); // 声明注入（参数化题数）
  assert.ok(!card.includes('结论（模板初稿'));
  const cardNoBeh = renderCard({
    model: 'm', qName: 'q_y', qTitle: 'T', form: 'code',
    result: { baseline: { ok: true, acceptance: '1/1' }, ddo: { ok: true, acceptance: '1/1' } },
    process, token: { groups: [] }, armReportDirs: { baseline: '/b', ddo: '/d' },
    expectedBehaviors: [], taskCount: 1,
  });
  assert.ok(cardNoBeh.includes('qpack 未登记 expectedBehaviors'));
  const summary = renderSummary({
    model: 'm', dryRun: true, taskCount: 1,
    cards: [{ qName: 'q1', form: 'page', track: 'ui', result: { delta: { 结果层: '7/33 → 33/33' } }, tokenLineShort: '1.2k → 4.5k' }],
  });
  assert.ok(summary.includes('| 题 | 形态 form | 考察 track | Δ 结果层 | token |'));
  assert.ok(summary.includes('| q1 | page | ui | 7/33 → 33/33 | 1.2k → 4.5k |'));
  assert.ok(!summary.includes('三栏总览'));
});

test('文案单源（issue #94）：cli.js 无内嵌声明/小样本副本', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'cli.js'), 'utf8');
  assert.ok(!src.includes('2–3 题小样本'));
  assert.ok(!src.includes('体感参考，不代表全面测评'));
});

test('report 子命令：负向 exit 2/1；正向产出 report-wechat/ 且粘贴安全、声明注入', async () => {
  const cli = path.join(__dirname, '..', 'cli.js');
  const runCli = (args) => {
    try {
      return { code: 0, stdout: execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8', env: { ...process.env, BENCH_SKIP_PNG: '1' } }) };
    } catch (e) {
      return { code: e.status, stdout: e.stdout || '', stderr: e.stderr || '' };
    }
  };
  assert.equal(runCli(['report', '--round', 'x']).code, 2); // 缺 --form
  assert.equal(runCli(['report', '--form', 'nope', '--round', 'x']).code, 2); // 未注册形式
  assert.equal(runCli(['report', '--form', 'wechat', '--round', 'zzz-not-exist']).code, 1); // 轮次不存在

  // fixture 轮次（写入仓库 .ddo/eval/ 运行产物区，测试后清理）
  const repoRoot = path.join(__dirname, '..', '..', '..');
  const runsRoot = path.join(repoRoot, '.ddo', 'eval', 'runs');
  const publishRoot = path.join(repoRoot, '.ddo', 'eval', 'reports');
  const rid = `zztest-fixture-${Date.now()}`;
  const qDir = path.join(runsRoot, rid, 'q_threejs-orbit-scene');
  fs.mkdirSync(path.join(qDir, 'metrics'), { recursive: true });
  fs.writeFileSync(path.join(runsRoot, rid, 'round.json'), JSON.stringify({
    roundId: rid, model: 'test-model', tasks: ['q_threejs-orbit-scene'],
    questions: [{ qName: 'q_threejs-orbit-scene', form: 'page', track: 'ui' }], dryRun: true,
  }));
  fs.writeFileSync(path.join(qDir, 'metrics', 'result.json'), JSON.stringify({
    baseline: { ok: true, pass: 7, total: 33 }, ddo: { ok: true, pass: 33, total: 33 },
    delta: { 结果层: '7/33 → 33/33' },
  }));
  fs.writeFileSync(path.join(qDir, 'metrics', 'token.json'), JSON.stringify({
    groups: [{ key: 'baseline', total_tokens: 12000 }, { key: 'ddo', total_tokens: 45000 }],
  }));
  try {
    const okRun = runCli(['report', '--form', 'wechat', '--round', rid]);
    assert.equal(okRun.code, 0, okRun.stderr);
    const out = JSON.parse(okRun.stdout);
    assert.ok(out.outputs.some((o) => o.startsWith('report-wechat/')));
    assert.equal(out.form, 'wechat');
    assert.equal(out.round_id, rid);
    const article = fs.readFileSync(path.join(publishRoot, rid, 'report-wechat', 'article-q_threejs-orbit-scene.html'), 'utf8');
    assert.ok(article.includes('题小样本')); // 声明注入（参数化题数）
    // 粘贴安全（gzh-design-skill 平台限制清单的产物关校验）
    assert.ok(!article.includes('<div'));
    assert.ok(!article.includes('class='));
    assert.ok(!article.includes('<style'));
    assert.ok(!article.includes('@media'));
    assert.ok(article.includes('<span leaf='));

    const xhs = runCli(['report', '--form', 'xiaohongshu', '--round', rid]);
    assert.equal(xhs.code, 0, xhs.stderr);
    const note = fs.readFileSync(path.join(publishRoot, rid, 'report-xiaohongshu', 'note-q_threejs-orbit-scene.md'), 'utf8');
    const firstLine = note.split('\n')[0];
    assert.ok([...firstLine].length <= 21, `标题超 20 字硬限: ${firstLine}`); // ≤20 字 + 可能的截断省略号
  } finally {
    fs.rmSync(path.join(runsRoot, rid), { recursive: true, force: true });
    fs.rmSync(path.join(publishRoot, rid), { recursive: true, force: true });
  }
});
