'use strict';
// progress 双通道断言（issue #93 G1/G2，plan Part 04 DEC-P7/P8）：
// 单元层——progress.jsonl 追加契约、scanTurns 行边界不变量、心跳容错；
// 集成层——cli.js dry-run 全链 progress 事件序列 + stderr 四类标记行（--arm-timeout 0.05 触达预警）。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { createProgress, scanTurns, createHeartbeat, renderRoundStart, renderRoundEnd } = require('../src/progress');

const execFileP = promisify(execFile);
const BENCH = path.join(__dirname, '..');

function tmpdir(prefix) { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }

test('progress：emit 追加写与字段契约（ts/event 必备，q/arm/detail 按需）', () => {
  const dir = tmpdir('bench-prog-');
  try {
    const progress = createProgress({ roundDir: dir });
    progress.emit('round-start', { detail: { roundId: 'r1' } });
    progress.emit('arm-turn', { q: 'q_x', arm: 'baseline', detail: { turn: 1, subtype: 'success' } });
    progress.emit('q-end', { q: 'q_x' });
    const lines = fs.readFileSync(progress.file, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.equal(lines.length, 3);
    assert.deepEqual(lines.map((l) => l.event), ['round-start', 'arm-turn', 'q-end']);
    for (const l of lines) { assert.ok(!Number.isNaN(Date.parse(l.ts)), 'ts 为 ISO 时间'); }
    assert.equal(lines[1].q, 'q_x');
    assert.equal(lines[1].arm, 'baseline');
    assert.equal(lines[1].detail.turn, 1);
    assert.equal(lines[2].detail, undefined); // 未提供 detail 不占位
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('scanTurns：行边界不变量——半行不提交偏移、坏行跳过、仅 result 计 turn', () => {
  const dir = tmpdir('bench-scan-');
  try {
    const f = path.join(dir, 's.jsonl');
    const result = (t) => JSON.stringify({ type: 'result', subtype: 'success', timestamp: t });
    // ① 半行：无完整 \n → 不提交
    fs.writeFileSync(f, JSON.stringify({ type: 'assistant' }).slice(0, 5));
    let r = scanTurns({ file: f, offset: 0 });
    assert.deepEqual(r, { offset: 0, turns: [] });
    // ② 补全该行（坏 JSON）+ 一个 result + 半个 result
    const badLine = JSON.stringify({ type: 'assistant' }) + '\n';
    fs.writeFileSync(f, badLine + result('2026-11-27T12:00:00Z') + '\n' + result('').slice(0, 8));
    r = scanTurns({ file: f, offset: 0 });
    assert.equal(r.turns.length, 1);
    assert.equal(r.turns[0].subtype, 'success');
    assert.equal(r.offset, Buffer.byteLength(badLine + result('2026-11-27T12:00:00Z') + '\n', 'utf8'));
    // ③ 追加补齐剩余半行 → 再计 1 turn；旧偏移续扫不重复计数
    fs.writeFileSync(f, badLine + result('2026-11-27T12:00:00Z') + '\n' + result('2026-11-27T12:01:00Z') + '\n');
    r = scanTurns({ file: f, offset: r.offset });
    assert.equal(r.turns.length, 1);
    assert.equal(r.turns[0].endedAt, '2026-11-27T12:01:00Z');
    // ④ 无新增 → 空结果、偏移不变
    const r2 = scanTurns({ file: f, offset: r.offset });
    assert.equal(r2.turns.length, 0);
    assert.equal(r2.offset, r.offset);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('heartbeat：流文件缺失不抛出（spawn 未就绪场景）；渲染函数含必备字段', () => {
  const dir = tmpdir('bench-hb-');
  try {
    const progress = createProgress({ roundDir: dir });
    const hb = createHeartbeat({
      progress, arms: { baseline: path.join(dir, 'nope-b.jsonl'), ddo: path.join(dir, 'nope-d.jsonl') },
      qLabel: 'q_x', qIndex: 1, qTotal: 2, timeoutMin: 30, startedAtMs: Date.now(),
    });
    assert.doesNotThrow(() => hb.tick()); // 缺文件 → 静默跳过，不产生事件
    assert.equal(fs.existsSync(progress.file), false); // 无事件 → 不创建文件
    assert.match(renderRoundStart({ roundId: 'rid', roundDir: '/d', tasks: ['q_a', 'q_b'], armTimeoutMin: 30 }), /roundId=rid/);
    assert.match(renderRoundStart({ roundId: 'rid', roundDir: '/d', tasks: ['q_a', 'q_b'], armTimeoutMin: 30 }), /臂超时=30 分钟/);
    assert.match(renderRoundEnd({ questions: [{ qName: 'q_a', resultDelta: '2/4 → 4/4' }], summaryPath: '/s/summary.md' }), /q_a 2\/4 → 4\/4/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('集成 dry-run：progress.jsonl 事件序列完整 + stderr 公告/心跳/预警/轮末清单（--arm-timeout 0.05 触达预警）', async () => {
  const cli = path.join(BENCH, 'cli.js');
  const args = ['run', '--model', 'progress-test', '--tasks', 'q_regression-trap', '--baseline-sid', 'pt-b', '--ddo-sid', 'pt-d', '--dry-run', '--arm-timeout', '0.05'];
  let out;
  try {
    const { stdout, stderr } = await execFileP(process.execPath, [cli, ...args], { cwd: BENCH, encoding: 'utf8' });
    out = JSON.parse(stdout);
    // ① 事件序列（AC-1）：round-start → q-start → arm-turn* → arm-done×2 → q-collect → q-end → round-end
    const events = fs.readFileSync(path.join(out.runsDir, 'progress.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    const names = events.map((e) => e.event);
    assert.equal(names[0], 'round-start');
    assert.equal(names[names.length - 1], 'round-end');
    const seq = ['q-start', 'arm-turn', 'arm-done', 'arm-done', 'q-collect', 'q-end'];
    let cursor = -1;
    for (const want of seq) {
      const at = names.indexOf(want, cursor + 1);
      assert.ok(at > cursor, `事件序缺 ${want}（实际：${names.join(',')}）`);
      cursor = at;
    }
    // ② 字段契约：题级/臂级事件携带 q / arm；round-start detail 含公告四要素
    for (const e of events.slice(1, -1)) assert.equal(e.q, 'q_regression-trap');
    for (const e of events.filter((x) => x.event === 'arm-turn' || x.event === 'arm-done')) assert.ok(['baseline', 'ddo'].includes(e.arm));
    const rs = events[0].detail;
    assert.equal(rs.roundId, out.roundId);
    assert.deepEqual(rs.tasks, ['q_regression-trap']);
    assert.equal(rs.armTimeoutMin, 0.05);
    // ③ 预警触达（剩余恒 ≤5 分钟 → 首个扫描点出 warning arm-turn 事件）
    const warnings = events.filter((e) => e.event === 'arm-turn' && e.detail && e.detail.warning);
    assert.equal(warnings.length, 2); // 双臂各一
    // ④ stderr 四类标记行（AC-1）
    assert.match(stderr, /\[轮次开始\] roundId=\S+ roundDir=\S+ 题单=q_regression-trap（1 题）臂超时=0\.05 分钟/);
    assert.match(stderr, /\[心跳\] 评测进行中：题 1\/1（q_regression-trap）双臂已运行/);
    assert.match(stderr, /\[预警\] 题 1\/1（q_regression-trap）距 0\.05 分钟超时不足 5 分钟/);
    assert.match(stderr, /\[轮次结束\] 1 题完成：q_regression-trap /);
  } finally {
    if (out && out.roundId) { // 清理测试轮次（DEC-P8）：失败也不留残轮
      await execFileP(process.execPath, [cli, 'clean', '--run', out.roundId], { cwd: BENCH, encoding: 'utf8' }).catch(() => {});
    }
  }
});
