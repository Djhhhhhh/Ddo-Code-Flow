'use strict';
// eval/bench 单测（VA-B 配套）：profile 装配校验、policy 同源生成与应答查表、轨迹解析。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { assembleProfile, ProfileError } = require('../src/profile');
const policyLib = require('../src/policy');
const traj = require('../src/collect/trajectory');

test('profile：缺省全量；非法 reports/dimensions/tasks 冲突均拦截', () => {
  const p = assembleProfile({ cliTasks: ['q1', 'q2'] });
  assert.deepEqual(p.reports, ['card', 'sheet', 'summary']);
  assert.equal(p.dimensions.cost, true);
  assert.throws(() => assembleProfile({ cliTasks: ['q1'], profileObj: { reports: ['nope'] } }), ProfileError);
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
