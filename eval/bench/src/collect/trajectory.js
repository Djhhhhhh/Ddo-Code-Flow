'use strict';
// 轨迹提取（plan Part 03 §5.1）：会话 stream.jsonl（Claude Code stream-json 事件流）
// → 时间轴事件（读/写/测试运行/提问），过程层信号的统一数据源。
// 事件形态：assistant 消息 content[] 中 {type:'tool_use', name, input} 与 {type:'text', text}。

const fs = require('node:fs');

const READ_TOOLS = ['Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch'];
const WRITE_TOOLS = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'];
const TEST_CMD_RE = /(node\s+--test|npm\s+(run\s+)?test|npx\s+(playwright\s+test|jest|vitest|mocha)|pytest|go\s+test|cargo\s+test|\.\/run_tests|prove\b)/;
// 声明类话语词典（可配置：process.js 的 claimDict 覆盖点）——用于「声称 vs 实际」比对
const CLAIM_RE = /(已(运行|通过|执行|跑过).{0,12}(测试|回归|自检)|测试(全部|全部)?(通过|绿)|回归(测试)?(通过|不受影响)|已(截图|自检)|全部用例(通过|绿))/;

/** 解析一个臂的 stream.jsonl → { events[], toolCalls[], texts[] }（时间序）。 */
function parseArmStream(streamPath) {
  const events = [];
  if (!fs.existsSync(streamPath)) return { events, toolCalls: [], texts: [] };
  const lines = fs.readFileSync(streamPath, 'utf8').split('\n').filter(Boolean);
  for (const line of lines) {
    let evt;
    try { evt = JSON.parse(line); } catch { continue; }
    if (evt.type !== 'assistant' || !evt.message || !Array.isArray(evt.message.content)) continue;
    const ts = evt.timestamp || null;
    for (const c of evt.message.content) {
      if (c.type === 'tool_use') {
        events.push({ kind: 'tool', name: c.name, input: c.input || {}, at: ts });
      } else if (c.type === 'text' && c.text) {
        events.push({ kind: 'text', text: c.text, at: ts });
      }
    }
  }
  return {
    events,
    toolCalls: events.filter((e) => e.kind === 'tool'),
    texts: events.filter((e) => e.kind === 'text'),
  };
}

const isRead = (e) => e.kind === 'tool' && READ_TOOLS.includes(e.name);
const isWrite = (e) => e.kind === 'tool' && WRITE_TOOLS.includes(e.name);
const isTestRun = (e) => e.kind === 'tool' && e.name === 'Bash' && TEST_CMD_RE.test(String((e.input || {}).command || ''));

/** 编码前调研指标：首个写文件调用之前的读类调用统计。 */
function beforeCoding(traj) {
  const firstWriteIdx = traj.events.findIndex(isWrite);
  const scope = firstWriteIdx >= 0 ? traj.events.slice(0, firstWriteIdx) : traj.events;
  const reads = scope.filter(isRead);
  return {
    firstWriteAt: firstWriteIdx >= 0 ? traj.events[firstWriteIdx].at : null,
    readsBeforeCoding: reads.length,
    readFiles: [...new Set(reads.map((r) => r.input.file_path || r.input.path).filter(Boolean))],
    researchTurns: new Set(reads.map((r) => r.at)).size,
  };
}

/** 测试运行统计（「实际」侧）。 */
function testRuns(traj) {
  const runs = traj.events.filter(isTestRun);
  return { testRunCount: runs.length, commands: runs.map((r) => String((r.input || {}).command || '').slice(0, 160)) };
}

/** 声称类话语（「声称」侧）。 */
function claims(traj, claimDict) {
  const re = claimDict || CLAIM_RE;
  const hits = traj.texts.filter((t) => re.test(t.text));
  return { claimCount: hits.length, samples: hits.map((h) => h.text.slice(0, 160)) };
}

/** 澄清请求探测（baseline 臂提问 / 任意臂显式假设）。 */
function clarifications(traj, questionRe) {
  const qre = questionRe;
  const asked = traj.texts.filter((t) => qre && qre.test(t.text));
  const assumed = traj.texts.filter((t) => /(假设|假定|按.{0,6}理解|我?.{0,4}采用.{0,12}方案)/.test(t.text));
  return { askedCount: asked.length, askedSamples: asked.map((a) => a.text.slice(0, 160)), assumptionCount: assumed.length };
}

module.exports = { parseArmStream, beforeCoding, testRuns, claims, clarifications, isRead, isWrite, isTestRun, CLAIM_RE, TEST_CMD_RE };
