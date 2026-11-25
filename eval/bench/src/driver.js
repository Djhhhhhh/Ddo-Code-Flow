'use strict';
// 双臂 headless 会话驱动（plan Part 02 §3–§5，DEC-4）。
// 真实模式：spawn `claude -p --session-id <sid> --model <m> --permission-mode acceptEdits
//   --input-format stream-json --output-format stream-json`，stdin 送初始用户消息；
//   baseline 臂在每轮 result 后按启发式检测提问 → 查表回放既定应答（对等澄清通道），
//   最多 maxTurns 轮；ddo 臂单轮（门由会话内 gate auto 处理）。
// dry-run 模式：不启动真实会话，注入桩事件与桩产物（链路自验，指标标 simulated）。
// 全部事件原样落 <arm>/stream.jsonl（轨迹提取数据源）；超时 kill 并记 failed。

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { lookupAnswer } = require('./policy');
const { SANDBOX_SETTINGS } = require('./sandbox');

const QUESTION_RE = /(澄清|确认一下|请问|需要明确|是否应该|要不要|哪种|还是|？|\?)/;
const MAX_TURNS = 3;

function nowIso() { return new Date().toISOString(); }

function userMessage(text) {
  return JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text }] } }) + '\n';
}

/** 运行一个 headless 会话臂。返回 { status, exitCode, startedAt, endedAt, turns, streamPath }。
 * streamPath：轨迹流写出位置——沙箱之外（roundDir 下），避免污染臂的 git 改动范围。 */
function runArm({ arm, sandboxDir, streamOutDir, promptText, model, sessionId, timeoutMin = 30, responderTable = null, maxTurns = MAX_TURNS, env = {} }) {
  const streamPath = path.join(streamOutDir, `${arm}-stream.jsonl`);
  const startedAt = nowIso();
  const turns = [];
  const answers = []; // 对称性记录：{turn, hitId, text, detected}
  let endedAt = null;
  let exitCode = null;
  let resolvedModel = null; // 未显式传 model 时，从 result 事件回执解析真实模型
  const baseArgs = [
    '-p',
    '--session-id', sessionId,
    '--permission-mode', 'acceptEdits',
    '--settings', JSON.stringify(SANDBOX_SETTINGS), // headless 未信任工作区会忽略沙箱 settings.json，改由 CLI 参数注入（两臂同配置）
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--verbose',
  ];
  if (model) baseArgs.splice(1, 0, '--model', model); // 缺省 = 本地 claude 已配置模型（索引 1：成对插在 -p 后，不挤占 --session-id 的取值槽位）
  let status = 'completed';

  return new Promise((resolve) => {
    const child = spawn('claude', baseArgs, { cwd: sandboxDir, env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });

    const out = fs.createWriteStream(streamPath);
    let buffer = '';
    let lastResultText = '';

    const timer = setTimeout(() => {
      status = 'timeout';
      child.kill('SIGTERM');
    }, timeoutMin * 60 * 1000);

    const finish = (code) => {
      endedAt = nowIso();
      exitCode = code;
      clearTimeout(timer);
      out.end();
      resolve({ arm, status, exitCode, startedAt, endedAt, turns, answers, streamPath, resolvedModel });
    };

    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      out.write(chunk);
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (!line.trim()) continue;
        let evt;
        try { evt = JSON.parse(line); } catch { continue; }
        if (evt.type === 'result') {
          if (evt.model) resolvedModel = String(evt.model);
          lastResultText = String(evt.result || '');
          turns.push({ endedAt: nowIso(), subtype: evt.subtype || 'unknown' });
          // baseline 对等应答通道：检测提问 → 查表回放（不生成新文本）
          if (responderTable && turns.length < maxTurns && QUESTION_RE.test(lastResultText)) {
            const ans = lookupAnswer(responderTable, lastResultText);
            answers.push({ turn: turns.length, detected: lastResultText.slice(0, 200), hitId: ans.hitId, text: ans.text });
            child.stdin.write(userMessage(ans.text));
            return;
          }
          child.stdin.end();
        }
      }
    });
    child.stderr.on('data', (c) => process.stderr.write(`[${arm}] ${c}`));
    child.on('close', (code) => finish(code));
    child.on('error', (e) => { status = 'spawn-error'; finish(1); process.stderr.write(`[${arm}] spawn 失败: ${e.message}\n`); });

    child.stdin.write(userMessage(promptText));
  });
}

/** ddo 臂系统提示（auto 模式接合点——只含流程动作，不含解题信息）。 */
function ddoArmPrompt({ taskPrompt, policyPath }) {
  return [
    taskPrompt,
    '',
    '---',
    '执行方式要求（评测配置，与任务内容无关）：',
    '1. 使用 /ddo-code-flow 工作流完成上述任务（以本目录为项目目录启动）。',
    '2. 评测 auto 模式已开启：凡流程要求向用户呈现确认门（gate present）或等待用户决议时，不向用户问询，改为执行同一引擎 CLI 的：',
    `   gate auto --state <statePath> --policy "${policyPath}"`,
    '   （引擎 CLI 调用方式与 /ddo-code-flow 指令中一致；<statePath> 以引擎实际返回为准）',
    '   若 gate auto 返回 in-phase 行为契约（如 回答BQ-N 写回），按契约完成写回后再次执行 gate auto，直至门关闭。',
    '3. 任务相关疑问不要向用户提出：按你的假设继续并在产物中显式记录该假设。',
  ].join('\n');
}

/** baseline 臂系统提示（对等澄清通道：可主动提问，由外置应答器从同一冻结清单应答）。 */
function baselineArmPrompt({ taskPrompt }) {
  return [
    taskPrompt,
    '',
    '---',
    '执行方式要求（评测配置，与任务内容无关）：完成任务并交付到当前目录。',
    '若任务存在无法自行合理决策的歧义，你可以提出具体、简明的澄清问题（一次列出）。',
  ].join('\n');
}

// ---------------------------------------------------------------- dry-run 桩

/** 桩事件流 + 桩产物（VA-B 链路自验；指标全部标 simulated）。 */
function stubArmEvents({ arm, startedAt, endedAt }) {
  const t0 = startedAt;
  const mk = (dt, type, extra) => JSON.stringify({ type, timestamp: new Date(new Date(t0).getTime() + dt).toISOString(), ...extra });
  const toolUse = (dt, name, input) => mk(dt, 'assistant', { message: { role: 'assistant', content: [{ type: 'tool_use', name, input }] } });
  const text = (dt, t) => mk(dt, 'assistant', { message: { role: 'assistant', content: [{ type: 'text', text: t }] } });
  if (arm === 'ddo') {
    return [
      toolUse(100, 'Read', { file_path: 'README.workspace.md' }),
      toolUse(400, 'Write', { file_path: 'checklist.md' }),
      text(600, '已对照题面 12 条要求产出 checklist；显式假设：球面均匀采用斐波那契球面分布，缓慢自转 0.1 rad/s。'),
      toolUse(900, 'Write', { file_path: 'index.html' }),
      toolUse(1200, 'Bash', { command: 'node selfcheck.js --shots', description: '交付前自检（截图/探针）' }),
      mk(1500, 'result', { subtype: 'success', result: '交付完成：index.html；已按 checklist 自检并记录假设。' }),
    ];
  }
  return [
    toolUse(50, 'Write', { file_path: 'index.html' }),
    text(300, '已完成页面。'),
    mk(500, 'result', { subtype: 'success', result: '完成。' }),
  ];
}

module.exports = { runArm, ddoArmPrompt, baselineArmPrompt, stubArmEvents, QUESTION_RE, MAX_TURNS };
