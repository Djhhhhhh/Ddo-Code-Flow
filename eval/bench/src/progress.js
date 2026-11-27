'use strict';
// 执行进度双通道（issue #93 G1/G2，plan Part 02 DEC-P1～P3）：
//   ① <roundDir>/progress.jsonl 结构化事件流（追加写，事件契约见 plan Part 02 §2）；
//   ② stderr 人话：轮次开始公告 / 心跳 / 超时预警 / 轮末清单。
// 心跳 = 60s 定时器 + 两臂 stream.jsonl 字节偏移增量扫描（driver 事件语义不动）；
// dry-run 桩流写盘后同步调用同一扫描器驱动（DEC-P3）；定时器异常降级题边界心跳点（DEC-P4 回退）。

const fs = require('node:fs');
const path = require('node:path');

const HEARTBEAT_INTERVAL_MS = 60_000;
const WARNING_BEFORE_MIN = 5;

function nowIso() { return new Date().toISOString(); }
function hhmm(iso) { return iso ? new Date(iso).toTimeString().slice(0, 5) : ''; }

/** progress.jsonl 追加器。emit(event, {q, arm, detail}) → 每行 {ts, event, q?, arm?, detail?}。 */
function createProgress({ roundDir }) {
  const file = path.join(roundDir, 'progress.jsonl');
  return {
    file,
    emit(event, fields = {}) {
      const rec = { ts: nowIso(), event };
      if (fields.q !== undefined) rec.q = fields.q;
      if (fields.arm !== undefined) rec.arm = fields.arm;
      if (fields.detail !== undefined) rec.detail = fields.detail;
      fs.appendFileSync(file, JSON.stringify(rec) + '\n');
      return rec;
    },
  };
}

/** 流增量扫描（纯函数）：自 offset 起只提交完整 \n 行。
 *  不变量：偏移只跨完整行推进（半行留待下次）；JSON 坏行跳过不回退；仅 type==='result' 计 turn。
 *  文件不存在时抛出（调用方捕获跳过本次扫描）。 */
function scanTurns({ file, offset = 0 }) {
  const size = fs.statSync(file).size;
  if (size <= offset) return { offset, turns: [] };
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(size - offset);
  try { fs.readSync(fd, buf, 0, buf.length, offset); } finally { fs.closeSync(fd); }
  const text = buf.toString('utf8');
  const lastNl = text.lastIndexOf('\n');
  if (lastNl < 0) return { offset, turns: [] };
  const committed = text.slice(0, lastNl + 1);
  const turns = [];
  let lastTs = null; // 2026-11-27 实测：result 事件不带 timestamp，assistant 事件带——回退取扫描窗内最后已知时戳
  for (const line of committed.split('\n')) {
    if (!line.trim()) continue;
    let evt;
    try { evt = JSON.parse(line); } catch { continue; }
    if (evt.timestamp) lastTs = evt.timestamp;
    if (evt.type === 'result') turns.push({ subtype: evt.subtype || 'unknown', endedAt: evt.timestamp || lastTs || null });
  }
  return { offset: offset + Buffer.byteLength(committed, 'utf8'), turns };
}

/** 轮次开始公告（G1：roundId / roundDir / 题单 / 臂超时）。 */
function renderRoundStart({ roundId, roundDir, tasks, armTimeoutMin }) {
  return `[轮次开始] roundId=${roundId} roundDir=${roundDir} 题单=${tasks.join(',')}（${tasks.length} 题）臂超时=${armTimeoutMin} 分钟`;
}

/** 轮末清单（G1：逐题 Δ 原样，含无差异/负增益）。 */
function renderRoundEnd({ questions, summaryPath }) {
  const parts = questions.map((q) => `${q.qName} ${q.resultDelta || q.resultDelta === '' ? String(q.resultDelta) : '（结果层关闭）'}`);
  return `[轮次结束] ${questions.length} 题完成：${parts.join('；')}；汇总 ${summaryPath}`;
}

/** 单题心跳：60s 定时器增量扫描 + stderr 心跳行 + 超时前 5 分钟预警（每题至多一次）。
 *  dry-run 由调用方直接 tick()（同步驱动）；真实模式 start()/stop() 包裹双臂执行。 */
function createHeartbeat({ progress, arms, qLabel, qIndex, qTotal, timeoutMin, startedAtMs }) {
  const offsets = { baseline: 0, ddo: 0 };
  const turns = { baseline: [], ddo: [] };
  const state = { warned: false, degraded: false };
  let timer = null;

  const elapsedMin = () => (Date.now() - startedAtMs) / 60000;
  const remainingMin = () => timeoutMin - elapsedMin();

  function scanAll() {
    const fresh = { baseline: [], ddo: [] };
    for (const arm of ['baseline', 'ddo']) {
      try {
        const r = scanTurns({ file: arms[arm], offset: offsets[arm] });
        offsets[arm] = r.offset;
        for (const t of r.turns) {
          const rec = { turn: turns[arm].length + 1, ...t };
          turns[arm].push(rec);
          fresh[arm].push(rec);
        }
      } catch { /* 流文件尚未创建——留待下次扫描 */ }
    }
    return fresh;
  }

  function heartbeatLine(fresh) {
    const done = ['baseline', 'ddo']
      .filter((a) => fresh[a].length)
      .map((a) => {
        const t = fresh[a][fresh[a].length - 1];
        return `${a} turn ${t.turn} 完成${t.endedAt ? `（${hhmm(t.endedAt)}）` : ''}`;
      });
    if (!done.length) return;
    const remaining = Math.max(0, Math.round(remainingMin()));
    process.stderr.write(
      `[心跳] 评测进行中：题 ${qIndex}/${qTotal}（${qLabel}）双臂已运行 ${Math.round(elapsedMin())} 分钟——${done.join('，')}；距 ${timeoutMin} 分钟超时还有 ${remaining} 分钟。\n`,
    );
  }

  function checkWarning() {
    if (state.warned || remainingMin() > WARNING_BEFORE_MIN) return;
    state.warned = true;
    process.stderr.write(
      `[预警] 题 ${qIndex}/${qTotal}（${qLabel}）距 ${timeoutMin} 分钟超时不足 ${WARNING_BEFORE_MIN} 分钟（双臂执行中）——超时臂将判「不可比」。\n`,
    );
    for (const arm of ['baseline', 'ddo']) {
      progress.emit('arm-turn', { q: qLabel, arm, detail: { warning: true, remainingMin: Math.max(0, Number(remainingMin().toFixed(2))) } });
    }
  }

  function tick() {
    const fresh = scanAll();
    for (const arm of ['baseline', 'ddo']) for (const t of fresh[arm]) progress.emit('arm-turn', { q: qLabel, arm, detail: { turn: t.turn, subtype: t.subtype } });
    if (fresh.baseline.length || fresh.ddo.length) heartbeatLine(fresh);
    checkWarning();
  }

  function degrade() { state.degraded = true; stop(); }
  function start() {
    try {
      timer = setInterval(() => { try { tick(); } catch { degrade(); } }, HEARTBEAT_INTERVAL_MS);
      if (timer.unref) timer.unref(); // 不阻进程退出
    } catch { degrade(); }
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  return { tick, start, stop, state, turns };
}

module.exports = {
  createProgress, scanTurns, createHeartbeat, renderRoundStart, renderRoundEnd,
  HEARTBEAT_INTERVAL_MS, WARNING_BEFORE_MIN,
};
