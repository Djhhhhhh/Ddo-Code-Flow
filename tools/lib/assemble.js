'use strict';
// exec 通用组装器（05 plan v1.0 §4）。全程 md 文本操作（D7）：
// 切片相位段 → L2 交互强化 → 三层配置合并 → 钩子动态 ctx → 默认模板拼装。

const fs = require('fs');
const path = require('path');
const { loadTaskSchema, renderContract } = require('./output-schema');

const PHASE_RE = /<!-- @phase:(\d{2}) -->\r?\n([\s\S]*?)<!-- \/phase:\1 -->/g;
const INTERACT_RE = /<!-- @interact:required/;
const L2_BLOCK = '> ⚠ 交互硬约束：本次执行包含必须完成的交互，未完成前禁止调用任何推进命令（next/rollback/run finish 等）。与用户交互必须使用宿主提问工具（如 AskUserQuestion）执行，不得以自由文本代替。';

/**
 * 三层配置合并（P3）：任务默认 < 用户级（$DDO_HOME/atom-tasks.json）< run 级（state.atomTasks）。
 * 标量覆盖；rules 数组逐层拼接。
 * 返回 { cfg, effective: { extra_ctx, rules[] } }。config.json 缺失/非法直接抛错（exit 1）。
 */
function mergeConfig(taskDir, state, ddoHome) {
  const cfg = JSON.parse(fs.readFileSync(path.join(taskDir, 'config.json'), 'utf8'));
  const effective = {
    extra_ctx: (cfg.defaults && cfg.defaults.extra_ctx) || '',
    rules: [...((cfg.defaults && cfg.defaults.rules) || [])],
  };
  let userLevel = {};
  try {
    const all = JSON.parse(fs.readFileSync(path.join(ddoHome, 'atom-tasks.json'), 'utf8'));
    userLevel = all[cfg.name] || {};
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  if (typeof userLevel.extra_ctx === 'string') effective.extra_ctx = userLevel.extra_ctx;
  if (Array.isArray(userLevel.rules)) effective.rules.push(...userLevel.rules);
  const runLevel = (state.atomTasks && state.atomTasks[cfg.name]) || {};
  if (typeof runLevel.extra_ctx === 'string') effective.extra_ctx = runLevel.extra_ctx;
  if (Array.isArray(runLevel.rules)) effective.rules.push(...runLevel.rules);
  return { cfg, effective };
}

/**
 * prompt.md 切片（D8）：共享前言 + 指定相位段。
 * 无任何相位标记 → 整文件即相位 01（此时请求非 01 相位报错）。
 */
function slicePrompt(promptFile, phase) {
  const md = fs.readFileSync(promptFile, 'utf8');
  const blocks = new Map();
  let m;
  PHASE_RE.lastIndex = 0;
  while ((m = PHASE_RE.exec(md)) !== null) {
    if (blocks.has(m[1])) throw new Error(`prompt.md 相位 id 重复: ${m[1]}`);
    blocks.set(m[1], m[2].trim());
  }
  if (!blocks.size) {
    if (phase !== '01') throw new Error(`相位未声明: ${phase}（该任务为单相位）`);
    return { preamble: '', instruction: md.trim() };
  }
  if (!blocks.has(phase)) {
    throw new Error(`相位未声明: ${phase}（已声明: ${[...blocks.keys()].join(', ')}）`);
  }
  const preamble = md.replace(PHASE_RE, '').trim();
  return { preamble, instruction: blocks.get(phase) };
}

/** L2 交互强化：指令段含 @interact:required → 置顶硬约束块（05 plan §2.1 分级）。 */
function hardenInteraction(instruction) {
  return INTERACT_RE.test(instruction) ? `${L2_BLOCK}\n\n${instruction}` : instruction;
}

/** 默认模板（P2 顺序：前言 → 指令 → extra_ctx → rules；ctx 段由钩子插入）。 */
function defaultTemplate(sections) {
  const parts = [];
  if (sections.preamble) parts.push(sections.preamble);
  if (sections.instruction) parts.push(sections.instruction);
  if (sections.extraCtx) parts.push(`## Extra Context\n\n${sections.extraCtx}`);
  if (sections.rules.length) parts.push(`## Rules\n\n${sections.rules.map((r) => `- ${r}`).join('\n')}`);
  return parts.join('\n\n---\n\n');
}

/**
 * 完整组装。taskDir 含 prompt.md/config.json（可选 <name>.js 钩子）。
 * 返回最终 prompt（md 文本）。钩子返回 undefined → 默认模板。
 */
function assemble({ taskDir, taskName, phase, state, statePath, ddoHome }) {
  const { cfg, effective } = mergeConfig(taskDir, state, ddoHome);
  const sliced = slicePrompt(path.join(taskDir, 'prompt.md'), phase);

  // 产出契约注入（生成侧软约束）：产出型相位（output 为文件名字符串）且任务带
  // .output.schema.json → 渲染契约块追加到指令段，agent 全程只读 md（D7）
  const decl = Array.isArray(cfg.phases)
    ? ((cfg.phases.find((p) => String(p.id).padStart(2, '0') === phase) || {}).output)
    : cfg.output;
  let contractMd = '';
  if (typeof decl === 'string') {
    const schema = loadTaskSchema(taskDir, taskName);
    if (schema) contractMd = renderContract(schema, decl);
  }

  const instruction = hardenInteraction(sliced.instruction) + (contractMd ? `\n\n---\n\n${contractMd}` : '');

  const sections = {
    preamble: sliced.preamble,
    instruction,
    extraCtx: effective.extra_ctx,
    rules: effective.rules,
  };

  let hook;
  const hookFile = path.join(taskDir, `${taskName}.js`);
  try {
    hook = require(hookFile);
  } catch (e) {
    // 仅吞「钩子文件自身不存在」；钩子内部依赖缺失/语法错误是硬失败
    if (e.code === 'MODULE_NOT_FOUND' && e.message.startsWith(`Cannot find module '${hookFile}'`)) {
      hook = undefined;
    } else {
      throw e;
    }
  }
  let out;
  if (hook && typeof hook.assemble === 'function') {
    out = hook.assemble({
      phase,
      state,
      statePath,
      config: { name: cfg.name, version: cfg.version, phases: cfg.phases, extra_ctx: effective.extra_ctx, rules: effective.rules },
      sections,
    });
  }
  return typeof out === 'string' ? out : defaultTemplate(sections);
}

module.exports = { mergeConfig, slicePrompt, hardenInteraction, defaultTemplate, assemble, L2_BLOCK };
