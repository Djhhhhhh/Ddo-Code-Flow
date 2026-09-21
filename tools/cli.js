#!/usr/bin/env node
'use strict';
// ddo-tools — v2 工具注册框架。
// 契约：命令注册表即文档源（--help 纯渲染，注册处即唯一事实源）；
// 四通道输出：stdout=结构化 JSON / stderr=人类可读 / exit 0·1·2。
// 命令实现随各设计轮次逐步登记，本文件只承载框架，不含业务逻辑。

class UsageError extends Error {}

// ---------------------------------------------------------------- 命令注册表
// 每个命令声明：
//   { name: "<domain> <verb>",            位置式两段（D5）
//     summary: "一句话职责",
//     usage:   "调用形态（含全部 flag）",
//     options: [{ flag: "--xxx", desc: "参数说明" }],
//     run(flags) }                         返回值打到 stdout；UsageError→exit 2；其他异常→exit 1
// 命令在归属的设计轮次登记；不预留占位接口。
const REGISTRY = [];

const domains = () => [...new Set(REGISTRY.map((c) => c.name.split(' ')[0]))];

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

// ---------------------------------------------------------------- help 渲染

function renderGlobalHelp() {
  const lines = [
    'ddo-tools — v2 工具集',
    '',
    '用法: node cli.js <domain> <verb> [--flag value | --flag=value]',
    '      node cli.js --help              本总览',
    `      node cli.js <domain> --help     域内命令${REGISTRY.length ? `（域: ${domains().join(', ')}）` : ''}`,
    '      node cli.js <domain> <verb> --help',
    '',
    '命令:',
  ];
  if (!REGISTRY.length) {
    lines.push('  （暂无已注册命令——命令随各设计轮次登记）');
  } else {
    for (const c of REGISTRY) lines.push(`  ${c.name.padEnd(14)}${c.summary}`);
  }
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
  const [domain, verb] = positional;
  if (verb === undefined) {
    const text = `${renderDomainHelp(domain)}\n`;
    if (help) process.stdout.write(text);
    else {
      process.stderr.write(text);
      return 2;
    }
    return 0;
  }
  const name = `${domain} ${verb}`;
  const cmd = REGISTRY.find((c) => c.name === name);
  if (!cmd) throw new UsageError(`未知命令: ${name}（用 --help 查看全部）`);
  if (help) {
    process.stdout.write(`${renderCommandHelp(cmd)}\n`);
    return 0;
  }
  const result = cmd.run(flags);
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
