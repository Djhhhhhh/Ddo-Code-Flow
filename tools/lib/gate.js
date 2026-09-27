'use strict';
// 确认门交互呈现层（交互协议结构闭环）：单一来源派生 + 呈现留痕判定。
// openGates 是门选项的唯一派生入口（静态声明 ∪ per-task present 钩子动态选项），
// gate present / next 拦截 / status / resume 全部同源复用——呈现形态不分叉。

const fs = require('fs');
const path = require('path');
const { phaseType, buildGate, DECISION_RE } = require('./workflow');

/** per-task 钩子装载（容错策略同 assemble.js：仅吞「文件自身不存在」）。 */
function loadPresentHook(tasksDir, taskName) {
  const hookFile = path.join(tasksDir, taskName, `${taskName}.js`);
  let mod;
  try {
    mod = require(hookFile);
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND' && e.message.startsWith(`Cannot find module '${hookFile}'`)) {
      return undefined;
    }
    throw e; // 钩子内部依赖缺失/语法错误是硬失败
  }
  return typeof mod.present === 'function' ? mod.present : undefined;
}

/** present 钩子动态选项校验（INV-2：action 恒 in-phase、name 过 DECISION_RE、不与静态重名）。 */
function dynamicOptions(hook, ctx, staticOptions, stageId, phase) {
  const where = `任务 ${stageId} 相位 ${phase} 的 present 钩子`;
  const out = hook(ctx) || {};
  const opts = Array.isArray(out.options) ? out.options : [];
  const seen = new Set(staticOptions.map((t) => t.name));
  const result = [];
  for (const t of opts) {
    if (!t || typeof t.name !== 'string' || !DECISION_RE.test(t.name)) {
      throw new Error(`${where}产出动态选项 name 非法: ${JSON.stringify(t && t.name)}（须为无空格的用户词汇）`);
    }
    if (seen.has(t.name)) throw new Error(`${where}动态选项与既有选项重名: ${t.name}`);
    seen.add(t.name);
    if (t.action !== 'in-phase') {
      throw new Error(`${where}动态选项 ${t.name} 的 action 须为 in-phase（推进/转移型决议必须静态声明）: ${t.action}`);
    }
    if (typeof t.desc !== 'string' || !t.desc) throw new Error(`${where}动态选项 ${t.name} 缺少 desc`);
    result.push({ name: t.name, desc: t.desc, action: 'in-phase' });
  }
  return result;
}

/**
 * 开门集派生（不写回 state）：遍历 currentStage 的 human 相位，返回
 * [{ stage, phase, options: [静态∪动态], gate: 门实例或 null（隐式门） }]。
 * 隐式门（无 gate 对象）的静态选项按相位声明现算——物化写回由 gate present 负责。
 */
function openGates(state, statePath, tasksDir) {
  const stageIdOf = (e) => String(e).split(':')[0];
  const phaseOf = (e) => String(e).split(':')[1] || '01';
  const result = [];
  for (const entry of state.currentStage) {
    const stageId = stageIdOf(entry);
    const phase = phaseOf(entry);
    if (phaseType(tasksDir, stageId, phase) !== 'human') continue;
    const gate = state.stages[stageId] && state.stages[stageId].gate;
    if (gate && gate.decision) continue; // 已决议 = 门已关
    const anchor = (gate && gate.openedAt) || state.stages[stageId].at;
    const staticOptions = (gate && gate.options) || (buildGate(state.stages, stageId, phase, tasksDir, anchor) || { options: [] }).options;
    const hook = loadPresentHook(tasksDir, stageId);
    const cfg = JSON.parse(fs.readFileSync(path.join(tasksDir, stageId, 'config.json'), 'utf8'));
    const dyn = hook
      ? dynamicOptions(hook, { phase, state, statePath, config: cfg }, staticOptions, stageId, phase)
      : [];
    result.push({ stage: stageId, phase, options: [...staticOptions, ...dyn], gate: gate || null });
  }
  return result;
}

/** 门声明的 action 命令补全 --state（payload 的 dispatch 与 availableCommands 共用）。 */
function fillState(action, statePath) {
  return action
    .replace(/^next\b/, `next --state ${statePath}`)
    .replace(/^rollback\b/, `rollback --state ${statePath}`)
    .replace(/^run finish\b/, `run finish --state ${statePath}`);
}

/** 统一交互 payload（gate present 的 stdout 契约）。 */
function presentPayload(gates, statePath) {
  return {
    gates: gates.map((g) => ({
      stage: g.stage,
      phase: g.phase,
      question: `${g.stage}:${g.phase} 确认门等待用户决议`,
      options: g.options.map((t) => ({
        name: t.name,
        desc: t.desc,
        action: t.action,
        dispatch: t.action === 'in-phase'
          ? `gate interact --state ${statePath} --option ${t.name}（处理后重新 gate present 送审）`
          : fillState(t.action, statePath),
      })),
    })),
    hint: '把各门 options 原样呈现给用户（宿主提问工具）；用户选择后按 dispatch 执行；in-phase 交互处理完成后必须重新 gate present——未重新呈现前的决议会被结构拦截',
  };
}

/** 门选项（options 三元组）的人话渲染（拦截提示用——错误信息本身就是提示）。 */
function renderGateOptions(gates) {
  return gates
    .map((g) => `  ${g.stage}:${g.phase}\n${g.options.map((t) => `    - ${t.name}：${t.desc}（${t.action === 'in-phase' ? '相位内交互' : t.action}）`).join('\n')}`)
    .join('\n');
}

/** ISO 时刻数值化（Date.parse；不可解析返回 null——异格式注入按无效处理）。 */
const epochOf = (s) => {
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
};

/**
 * 呈现有效性判定（INV-1）：valid ⇔ presentedAt 存在且严格晚于 openedAt 与每条 interaction.at。
 * 时刻比较数值化（容忍异时区偏移的合法 ISO）；同刻按过期（保守拦截方向）。
 */
function isPresentationValid(gate) {
  if (!gate) return { valid: false, reason: 'never' };
  const presented = gate.presentedAt ? epochOf(gate.presentedAt) : null;
  if (presented === null) return { valid: false, reason: 'never' };
  if (epochOf(gate.openedAt) !== null && presented <= epochOf(gate.openedAt)) {
    return { valid: false, reason: 'stale-open' };
  }
  for (const i of gate.interactions || []) {
    const at = epochOf(i.at);
    if (at === null || presented <= at) return { valid: false, reason: 'interacted' };
  }
  return { valid: true };
}

module.exports = {
  openGates, presentPayload, renderGateOptions, fillState, isPresentationValid, loadPresentHook,
};
