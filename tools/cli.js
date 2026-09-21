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
const { assemble, mergeConfig } = require('./lib/assemble');
const { loadTaskSchema, validateArtifact } = require('./lib/output-schema');

const ATOM_TASKS_DIR = require('path').join(__dirname, '..', 'atom-tasks');

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

function runExec(f) {
  const statePath = f.state;
  const taskName = f.task;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskName)) {
    throw new UsageError(`--task 非法: ${taskName}`);
  }
  const phase = f.phase === undefined ? '01' : String(f.phase).padStart(2, '0');
  const state = readState(statePath);
  assertState(state);

  const taskDir = require('path').join(f['tasks-dir'] ? require('path').resolve(f['tasks-dir']) : ATOM_TASKS_DIR, taskName);
  const promptFile = require('path').join(taskDir, 'prompt.md');
  if (!require('fs').existsSync(promptFile) || !require('fs').existsSync(require('path').join(taskDir, 'config.json'))) {
    throw new Error(`原子任务不存在或结构不完整: ${taskDir}（需含 prompt.md + config.json）`);
  }
  const { cfg } = mergeConfig(taskDir, state, registry.ddoHome());
  if (cfg.phases) {
    const ids = cfg.phases.map((p) => String(p.id).padStart(2, '0'));
    if (!ids.includes(phase)) {
      throw new Error(`相位未声明: ${phase}（已声明: ${ids.join(', ')}）`);
    }
  } else if (phase !== '01') {
    throw new Error(`相位未声明: ${phase}（该任务为单相位）`);
  }

  return assemble({ taskDir, taskName, phase, state, statePath, ddoHome: registry.ddoHome() });
}

function runValidate(f) {
  const statePath = f.state;
  const taskName = f.task;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskName)) {
    throw new UsageError(`--task 非法: ${taskName}`);
  }
  const phase = f.phase === undefined ? '01' : String(f.phase).padStart(2, '0');
  const state = readState(statePath);
  assertState(state);

  const path = require('path');
  const fs = require('fs');
  const tasksDir = f['tasks-dir'] ? path.resolve(f['tasks-dir']) : ATOM_TASKS_DIR;
  const taskDir = path.join(tasksDir, taskName);
  const cfgFile = path.join(taskDir, 'config.json');
  if (!fs.existsSync(path.join(taskDir, 'prompt.md')) || !fs.existsSync(cfgFile)) {
    throw new Error(`原子任务不存在或结构不完整: ${taskDir}（需含 prompt.md + config.json）`);
  }
  const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));

  // 定位 output 声明：多相位挂 phases[]，单相位挂顶层；字符串 = 产出文件，{updates} = 只写回
  let decl = null;
  if (Array.isArray(cfg.phases)) {
    const entry = cfg.phases.find((p) => String(p.id).padStart(2, '0') === phase);
    if (!entry) throw new Error(`相位未声明: ${phase}（已声明: ${cfg.phases.map((p) => p.id).join(', ')}）`);
    decl = entry.output || null;
  } else {
    if (phase !== '01') throw new Error(`相位未声明: ${phase}（该任务为单相位）`);
    decl = cfg.output || null;
  }
  if (!decl) return { validated: null, reason: '任务未声明产出' };

  // schema 加载 + meta 校验先于产物检查——schema 写坏是设计时错误，不依赖产物存在
  const schema = loadTaskSchema(taskDir, taskName);

  const runDir = path.dirname(statePath);
  const files = typeof decl === 'string' ? [decl] : (decl.updates || []);
  const missing = files.filter((file) => !fs.existsSync(path.join(runDir, file)));

  const errors = [];
  if (typeof decl === 'string' && schema && !missing.length) {
    errors.push(...validateArtifact(schema, fs.readFileSync(path.join(runDir, decl), 'utf8')));
  }

  if (missing.length || errors.length) {
    const detail = [];
    if (missing.length) detail.push(`缺失: ${missing.join('；')}`);
    if (errors.length) detail.push(`结构: ${errors.join('；')}`);
    process.stderr.write(`[校验不通过] ${detail.join('，')}\n`);
    process.exitCode = 1;
    return { validated: false, missing, errors };
  }
  return { validated: true };
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
  {
    name: 'exec',
    summary: '执行原子任务：组装「恰好必需」的 prompt（裸文本输出，渐进式加载）',
    usage: 'exec --state <path> --task <name> [--phase <id>]',
    options: [
      { flag: '--state', desc: '.state.json 绝对路径', required: true },
      { flag: '--task', desc: '原子任务名（atom-tasks/<name>/）', required: true },
      { flag: '--phase', desc: '相位 id（两位，缺省 01；须在 config.json phases 声明内）' },
      { flag: '--tasks-dir', desc: '原子任务根目录（缺省仓库 atom-tasks/；测试/扩展用）' },
    ],
    run: runExec,
    rawOutput: true, // 04 P2 定稿：exec 输出裸 prompt 文本，四通道唯一例外
  },
  {
    name: 'validate',
    summary: '产出规范化校验：按任务 output 声明硬校验产物（存在/必填 section/无占位）',
    usage: 'validate --state <path> --task <name> [--phase <id>]',
    options: [
      { flag: '--state', desc: '.state.json 绝对路径', required: true },
      { flag: '--task', desc: '原子任务名（atom-tasks/<name>/）', required: true },
      { flag: '--phase', desc: '相位 id（两位，缺省 01）' },
      { flag: '--tasks-dir', desc: '原子任务根目录（缺省仓库 atom-tasks/；测试/扩展用）' },
    ],
    run: runValidate,
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
    if (cmd.rawOutput) process.stdout.write(`${result}\n`);
    else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return process.exitCode || 0; // 命令可自设 exitCode（如 validate 校验失败仍输出 JSON）
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

// 不用 process.exit()：管道下它会截断未冲刷的 stdout。设 exitCode 让 Node
// 在流冲刷完毕后自然退出（validate 的自设 exitCode 经 main 的返回值回传）。
try {
  process.exitCode = main();
} catch (e) {
  if (e instanceof UsageError) {
    process.stderr.write(`[用法错误] ${e.message}\n`);
    process.exitCode = 2;
  } else {
    process.stderr.write(`[失败] ${e.message}\n`);
    process.exitCode = 1;
  }
}
