#!/usr/bin/env node
'use strict';
// ddo-tools — v2 确定性执行内核入口。
// 契约：命令注册表即文档源（--help 纯渲染）；四通道输出
// （stdout=JSON / stderr=人话 / exit 0·1·2 / 状态文件现读不缓存）。

const path = require('path');
const { genUniqueRunId } = require('./lib/runid');
const { readState, writeState, assertState, STATUS_ENUM } = require('./lib/state');
const registry = require('./lib/index-registry');
const history = require('./lib/history');

class UsageError extends Error {}

// ---------------------------------------------------------------- 注册表

// options: flag 均为「--flag value」形态；required 未提供时报 exit 2。
const REGISTRY = [
  {
    name: 'run start',
    summary: '创建 run：计算 runId → 物化 stages → 写 .state.json → 注册全局索引',
    usage: 'run start --state <path> --title <text> --main-branch <name> --stages <json> [--release-branch <name>] [--development-branch <name>] [--worktree-path <path>] [--current <a:01,b:01>]',
    options: [
      { flag: '--state', desc: '目标 .state.json 绝对路径（不得已存在）' },
      { flag: '--title', desc: 'run 标题（人类可读）' },
      { flag: '--main-branch', desc: '主干分支名称' },
      { flag: '--stages', desc: 'stages 逻辑结构 JSON：{"<stageId>":{"dependOn":[...]}}，运行时字段由本命令物化' },
      { flag: '--release-branch', desc: '发布分支（可选）' },
      { flag: '--development-branch', desc: '开发分支（可选）' },
      { flag: '--worktree-path', desc: 'worktree 绝对路径（可选）' },
      { flag: '--current', desc: '初始 currentStage，逗号分隔（缺省取 stages 首键 + :01）' },
    ],
  },
  {
    name: 'run update',
    summary: '状态推进：stage 状态/相位刷新 + currentStage 更新（幂等覆盖）',
    usage: 'run update --state <path> [--stage <stageId> --status <enum>] [--current <a:01,b:01>]',
    options: [
      { flag: '--state', desc: '.state.json 绝对路径' },
      { flag: '--stage', desc: '目标 stageId（与 --status 成对出现）' },
      { flag: '--status', desc: `新状态，枚举：${[...STATUS_ENUM].join(' | ')}` },
      { flag: '--current', desc: '新的 currentStage，逗号分隔（元素为 stageId:相位号）' },
    ],
  },
  {
    name: 'run finish',
    summary: '结束迁移：state.currentStage 清空 → history 追加 → index 移除',
    usage: 'run finish --state <path> --status <done|aborted|failed>',
    options: [
      { flag: '--state', desc: '.state.json 绝对路径' },
      { flag: '--status', desc: '终态：done（完成）| aborted（用户中止）| failed（失败终止）' },
    ],
  },
  {
    name: 'run show',
    summary: '读取单个 run 的 .state.json',
    usage: 'run show --state <path>',
    options: [{ flag: '--state', desc: '.state.json 绝对路径' }],
  },
  {
    name: 'list active',
    summary: '运行中 run 列表（读全局索引 + 惰性校验失效条目）',
    usage: 'list active',
    options: [],
  },
  {
    name: 'list history',
    summary: '历史 run 查询（读 history JSONL）',
    usage: 'list history [--last <N>]',
    options: [{ flag: '--last', desc: '仅取最近 N 条（可选）' }],
  },
];

const DOMAINS = [...new Set(REGISTRY.map((c) => c.name.split(' ')[0]))];

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

function parseJson(text, what) {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new UsageError(`--${what} 不是合法 JSON: ${e.message}`);
  }
}

// ---------------------------------------------------------------- help 渲染

function renderGlobalHelp() {
  const lines = [
    'ddo-tools — v2 确定性执行内核',
    '',
    '用法: node cli.js <domain> <verb> [--flag value | --flag=value]',
    '      node cli.js --help              本总览',
    `      node cli.js <domain> --help     域内命令（域: ${DOMAINS.join(', ')}）`,
    '      node cli.js <domain> <verb> --help',
    '',
    '命令:',
  ];
  for (const c of REGISTRY) lines.push(`  ${c.name.padEnd(14)}${c.summary}`);
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
  if (cmd.options.length) {
    lines.push('', '参数:');
    for (const o of cmd.options) lines.push(`  ${o.flag.padEnd(22)}${o.desc}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------- 命令实现

const nowIso = () => new Date().toISOString();

const COMMANDS = {
  'run start'(f) {
    const statePath = need(f, 'state', 'run start');
    const title = need(f, 'title', 'run start');
    const mainBranch = need(f, 'main-branch', 'run start');
    const stagesInput = parseJson(need(f, 'stages', 'run start'), 'stages');
    if (!stagesInput || typeof stagesInput !== 'object' || Array.isArray(stagesInput)) {
      throw new UsageError('--stages 必须是 {"<stageId>": {"dependOn": [...]}} 形态的对象');
    }
    const fs = require('fs');
    if (fs.existsSync(statePath)) throw new Error(`state 文件已存在，拒绝覆盖: ${statePath}`);

    const startedAt = nowIso();
    const stages = {};
    for (const [id, def] of Object.entries(stagesInput)) {
      const dependOn = def && def.dependOn !== undefined ? def.dependOn : [];
      if (!Array.isArray(dependOn)) throw new UsageError(`stages[${id}].dependOn 必须是数组`);
      stages[id] = { status: 'pending', dependOn, at: startedAt };
    }
    const firstStage = Object.keys(stages)[0];
    if (!firstStage) throw new UsageError('--stages 至少包含一个 stage');
    const currentStage = f.current
      ? String(f.current).split(',').map((s) => s.trim()).filter(Boolean)
      : [`${firstStage}:01`];

    const runId = genUniqueRunId((id) => Object.prototype.hasOwnProperty.call(registry.readAll(), id));
    const git = { mainBranch };
    if (f['release-branch']) git.releaseBranch = f['release-branch'];
    if (f['development-branch']) git.developmentBranch = f['development-branch'];
    if (f['worktree-path']) git.worktreePath = f['worktree-path'];

    const state = { runId, title, startedAt, git, currentStage, stages, atomTasks: {} };
    assertState(state);
    writeState(statePath, state);
    registry.register(runId, { statePath, startedAt });
    return { runId, statePath, currentStage };
  },

  'run update'(f) {
    const statePath = need(f, 'state', 'run update');
    const state = readState(statePath);
    const hasStagePair = f.stage !== undefined || f.status !== undefined;
    if (!hasStagePair && f.current === undefined) {
      throw new UsageError('run update: 需要 --stage+--status 或 --current 至少其一');
    }
    if (hasStagePair) {
      if (f.stage === undefined || f.status === undefined) {
        throw new UsageError('run update: --stage 与 --status 必须成对出现');
      }
      if (!Object.prototype.hasOwnProperty.call(state.stages, f.stage)) {
        throw new Error(`stage 不存在: ${f.stage}（现有: ${Object.keys(state.stages).join(', ')}）`);
      }
      if (!STATUS_ENUM.has(f.status)) {
        throw new UsageError(`--status 非法: ${f.status}（枚举: ${[...STATUS_ENUM].join(' | ')}）`);
      }
      state.stages[f.stage] = { ...state.stages[f.stage], status: f.status, at: nowIso() };
    }
    if (f.current !== undefined) {
      state.currentStage = String(f.current).split(',').map((s) => s.trim()).filter(Boolean);
    }
    assertState(state);
    writeState(statePath, state);
    return state;
  },

  'run finish'(f) {
    const statePath = need(f, 'state', 'run finish');
    const finalStatus = need(f, 'status', 'run finish');
    if (!['done', 'aborted', 'failed'].includes(finalStatus)) {
      throw new UsageError('--status 必须是 done | aborted | failed');
    }
    const state = readState(statePath);
    assertState(state);
    // 迁移顺序（基线 §7）：① 清空 currentStage ② history 追加 ③ index 移除
    state.currentStage = [];
    writeState(statePath, state);
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
  },

  'run show'(f) {
    const statePath = need(f, 'state', 'run show');
    const state = readState(statePath);
    assertState(state);
    return state;
  },

  'list active'() {
    const map = registry.readAll();
    const rows = [];
    for (const [runId, entry] of Object.entries(map)) {
      let valid = false;
      let title = null;
      let currentStage = null;
      try {
        const state = readState(entry.statePath);
        title = state.title;
        currentStage = state.currentStage;
        valid = Array.isArray(currentStage) && currentStage.length > 0;
      } catch (_) {
        valid = false; // statePath 不存在或不可读 → 惰性判定失效
      }
      rows.push({ runId, statePath: entry.statePath, startedAt: entry.startedAt, title, currentStage, valid });
    }
    rows.sort((a, b) => (a.runId < b.runId ? -1 : 1)); // runId 字典序 = 时间序
    return rows;
  },

  'list history'(f) {
    let lastN;
    if (f.last !== undefined) {
      lastN = Number(f.last);
      if (!Number.isInteger(lastN) || lastN < 0) throw new UsageError('--last 必须是非负整数');
    }
    return history.query(lastN);
  },
};

// ---------------------------------------------------------------- 主流程

function main() {
  const argv = process.argv.slice(2);
  const { positional, flags, help } = parseArgv(argv);

  if (!positional.length) {
    process.stdout.write(`${renderGlobalHelp()}\n`);
    return 0;
  }
  const [domain, verb] = positional;
  if (verb === undefined) {
    if (help) {
      process.stdout.write(`${renderDomainHelp(domain)}\n`);
      return 0;
    }
    process.stderr.write(`${renderDomainHelp(domain)}\n`);
    return 2;
  }
  const name = `${domain} ${verb}`;
  const cmd = REGISTRY.find((c) => c.name === name);
  if (!cmd) throw new UsageError(`未知命令: ${name}（用 --help 查看全部）`);
  if (help) {
    process.stdout.write(`${renderCommandHelp(cmd)}\n`);
    return 0;
  }
  const fn = COMMANDS[name];
  if (!fn) throw new Error(`命令已注册但未实现: ${name}`);
  const result = fn(flags);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return 0;
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
