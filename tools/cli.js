#!/usr/bin/env node
'use strict';
// ddo-tools — v2 确定性执行内核。
// 契约：命令注册表即文档源（--help 纯渲染）；四通道输出
// （stdout=JSON / stderr=人话 / exit 0·1·2 / 状态文件现读不缓存）。
// 命令在归属的设计轮次登记（03 plan §3.4 命名空间政策）；
// 当前登记：run finish、rollback（04 plan v1.0 契约）。

const { readState, writeState, assertState } = require('./lib/state');
const registry = require('./lib/index-registry');
const history = require('./lib/history');

class UsageError extends Error {}

const nowIso = () => new Date().toISOString();
const stageIdOf = (entry) => String(entry).split(':')[0];

// ---------------------------------------------------------------- DAG 工具

/** ancestors(x)：x 的全部传递依赖（不含 x 自身）。 */
function ancestors(stages, x) {
  const seen = new Set();
  const queue = [...(stages[x].dependOn || [])];
  while (queue.length) {
    const s = queue.shift();
    if (seen.has(s) || !(s in stages)) continue;
    seen.add(s);
    queue.push(...(stages[s].dependOn || []));
  }
  return seen;
}

/** descendants(x)：传递依赖于 x 的全部节点（不含 x 自身）。 */
function descendants(stages, x) {
  const seen = new Set();
  const queue = Object.keys(stages).filter((s) => (stages[s].dependOn || []).includes(x));
  while (queue.length) {
    const s = queue.shift();
    if (seen.has(s)) continue;
    seen.add(s);
    queue.push(...Object.keys(stages).filter((t) => (stages[t].dependOn || []).includes(s)));
  }
  return seen;
}

/**
 * rollback 重置集合（04 plan §2.2）：目标 ∪「目标 → currentStage 各项」的全部 DAG 路径节点。
 * 即：目标自身 + 目标的子孙中，位于通往当前执行位置路径上的那些（含当前执行位置自身——路径终点）。
 */
function rollbackResetSet(stages, target, currentStage) {
  const desc = descendants(stages, target);
  const reset = new Set([target]);
  for (const entry of currentStage) {
    const c = stageIdOf(entry);
    if (desc.has(c)) reset.add(c); // 当前执行位置是路径终点，必须重置
    for (const a of ancestors(stages, c)) {
      if (a === target || desc.has(a)) reset.add(a);
    }
  }
  return reset;
}

// ---------------------------------------------------------------- 命令实现

function runFinish(f) {
  const statePath = f.state;
  const finalStatus = f.status;
  if (!['done', 'aborted', 'failed'].includes(finalStatus)) {
    throw new UsageError('--status 必须是 done | aborted | failed');
  }
  const state = readState(statePath);
  assertState(state);
  // 迁移顺序（02 基线 §7）：① 清空 currentStage ② history 追加 ③ index 移除
  if (state.currentStage.length > 0) {
    state.currentStage = [];
    writeState(statePath, state);
  }
  history.append({
    runId: state.runId,
    title: state.title,
    git: state.git,
    startedAt: state.startedAt,
    endedAt: nowIso(),
    finalStatus,
    statePath,
  });
  registry.unregister(state.runId);
  return { finished: state.runId, finalStatus };
}

function runRollback(f) {
  const statePath = f.state;
  const target = f.stage;
  const state = readState(statePath);
  assertState(state);
  if (!(target in state.stages)) {
    throw new Error(`stage 不存在: ${target}（现有: ${Object.keys(state.stages).join(', ')}）`);
  }
  if (state.stages[target].status === 'pending') {
    throw new Error(`stage ${target} 为 pending，无可回滚内容`);
  }
  const reset = rollbackResetSet(state.stages, target, state.currentStage);
  const rolledBack = [];
  const pathReset = [];
  for (const s of reset) {
    const from = state.stages[s].status;
    state.stages[s] = { ...state.stages[s], status: 'pending', at: nowIso() };
    if (s === target) rolledBack.push({ stage: s, from, to: 'pending' });
    else pathReset.push(s);
  }
  state.currentStage = [`${target}:01`];
  writeState(statePath, state);
  if (f.reason) process.stderr.write(`[rollback] reason: ${f.reason}\n`);
  // 文档归档（_del/rollback-<n>/）随产物登记机制落地（04 plan §2.2），届时补充 archivedTo 字段
  return { rolledBack, pathReset, currentStage: state.currentStage };
}

// ---------------------------------------------------------------- 命令注册表

const REGISTRY = [
  {
    name: 'run finish',
    summary: '结束迁移：清 currentStage → history 追加 → index 移除',
    usage: 'run finish --state <path> --status <done|aborted|failed>',
    options: [
      { flag: '--state', desc: '.state.json 绝对路径', required: true },
      { flag: '--status', desc: '终态：done（完成）| aborted（用户中止）| failed（失败终止）', required: true },
    ],
    run: runFinish,
  },
  {
    name: 'rollback',
    summary: '回滚指定的一个阶段：DAG 路径重置 + currentStage 回退（文档归档待产物机制）',
    usage: 'rollback --state <path> --stage <stageId> [--reason <text>]',
    options: [
      { flag: '--state', desc: '.state.json 绝对路径', required: true },
      { flag: '--stage', desc: '回滚目标 stageId（每次一个阶段）', required: true },
      { flag: '--reason', desc: '回滚原因（记入 stderr 日志，不写 state）' },
    ],
    run: runRollback,
  },
];

const topVerbs = () => REGISTRY.filter((c) => !c.name.includes(' '));
const domains = () => [...new Set(REGISTRY.filter((c) => c.name.includes(' ')).map((c) => c.name.split(' ')[0]))];

// ---------------------------------------------------------------- 参数解析

function parseArgv(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok === '--help' || tok === '-h') return { positional, flags, help: true };
    if (tok.startsWith('--')) {
      const eq = tok.indexOf('=');
      if (eq > 0) {
        flags[tok.slice(2, eq)] = tok.slice(eq + 1);
      } else if (i + 1 < argv.length) {
        flags[tok.slice(2)] = argv[++i];
      } else {
        throw new UsageError(`flag 缺少取值: ${tok}`);
      }
    } else {
      positional.push(tok);
    }
  }
  return { positional, flags, help: false };
}

function need(flags, key, cmdName) {
  if (flags[key] === undefined) throw new UsageError(`${cmdName}: 缺少必填参数 --${key}（用 --help 查看用法）`);
  return flags[key];
}

// 必填参数校验：由注册表 options[].required 声明驱动（注册处即契约源）
for (const cmd of REGISTRY) {
  const raw = cmd.run;
  cmd.run = (f) => {
    for (const o of cmd.options || []) {
      if (o.required && f[o.flag.slice(2)] === undefined) need(f, o.flag.slice(2), cmd.name);
    }
    return raw(f);
  };
}

// ---------------------------------------------------------------- help 渲染

function renderGlobalHelp() {
  const lines = [
    'ddo-tools — v2 确定性执行内核',
    '',
    '用法: node cli.js <命令> [--flag value | --flag=value]',
    '      node cli.js --help              本总览',
    `      node cli.js <domain> --help     域内命令${domains().length ? `（域: ${domains().join(', ')}）` : ''}`,
    '      node cli.js <命令> --help',
    '',
    '命令:',
  ];
  const verbs = topVerbs();
  if (verbs.length) {
    lines.push('  顶层动词:');
    for (const c of verbs) lines.push(`    ${c.name.padEnd(12)}${c.summary}`);
  }
  for (const d of domains()) {
    lines.push(`  ${d} 域:`);
    for (const c of REGISTRY.filter((x) => x.name.startsWith(`${d} `))) {
      lines.push(`    ${c.name.padEnd(12)}${c.summary}`);
    }
  }
  if (!REGISTRY.length) lines.push('  （暂无已注册命令——命令随各设计轮次登记）');
  lines.push('', '退出码: 0 成功 · 1 硬失败 · 2 用法错误。stdout 仅输出 JSON。');
  return lines.join('\n');
}

function renderDomainHelp(domain) {
  const cmds = REGISTRY.filter((c) => c.name.startsWith(`${domain} `));
  if (!cmds.length) throw new UsageError(`未知域: ${domain}（用 --help 查看全部）`);
  const lines = [`域 ${domain} — 命令:`, ''];
  for (const c of cmds) lines.push(`  ${c.name}`, `    ${c.summary}`, `    用法: ${c.usage}`, '');
  return lines.join('\n');
}

function renderCommandHelp(cmd) {
  const lines = [`${cmd.name} — ${cmd.summary}`, '', `用法: ${cmd.usage}`];
  if (cmd.options && cmd.options.length) {
    lines.push('', '参数:');
    for (const o of cmd.options) lines.push(`  ${o.flag.padEnd(22)}${o.desc}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------- 主流程

function main() {
  const argv = process.argv.slice(2);
  const { positional, flags, help } = parseArgv(argv);

  if (!positional.length) {
    process.stdout.write(`${renderGlobalHelp()}\n`);
    return 0;
  }
  // 顶层动词与两段式统一：位置参数整体拼 key 查注册表（03 plan §3.4 框架扩展）
  const name = positional.join(' ');
  const cmd = REGISTRY.find((c) => c.name === name);
  if (cmd) {
    if (help) {
      process.stdout.write(`${renderCommandHelp(cmd)}\n`);
      return 0;
    }
    const result = cmd.run(flags);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  }
  if (positional.length === 1) {
    throw new UsageError(`未知命令: ${name}（用 --help 查看全部）`);
  }
  const domain = positional[0];
  if (REGISTRY.some((c) => c.name.startsWith(`${domain} `))) {
    const text = `${renderDomainHelp(domain)}\n`;
    if (help) process.stdout.write(text);
    else {
      process.stderr.write(text);
      return 2;
    }
    return 0;
  }
  throw new UsageError(`未知命令: ${name}（用 --help 查看全部）`);
}

try {
  process.exit(main());
} catch (e) {
  if (e instanceof UsageError) {
    process.stderr.write(`[用法错误] ${e.message}\n`);
    process.exit(2);
  }
  process.stderr.write(`[失败] ${e.message}\n`);
  process.exit(1);
}
