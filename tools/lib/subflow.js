'use strict';
// 子流程编排核心（plan DEC-1/2/3/4）：运行期创建嵌套子 state、阻塞判定、显式收口。
// 语义要点：
//   - 子流程=正常流水逻辑（BQ-1）：子 state 是普通 state，exec/validate/next/gate 零改动复用；
//   - 阻塞式（BQ-2/FR-5）：active 子流程存在时父 next / run finish 拦截（cli.js 调 activeSubflows）；
//   - 三层上限（FR-2/AC-2）：总深度（父=1），创建点校验，超出硬失败；
//   - 不入全局 index、不单独 run finish（DEC-5）：子流程随父 runDir 归档。

const fs = require('fs');
const path = require('path');
const { readState, writeState, assertState } = require('./state');
const { loadWorkflow, expandStages, pruneStages, activateStarts } = require('./workflow');
const { applyConfigOverrides } = require('./assemble');

const MAX_DEPTH = 3; // 总深度：父=1，子=2，孙=3（含顶层数法，spec 解释表）
const SUBFLOWS_DIR = 'subflows';

/** state 的流水深度：顶层 run 无 subflow 段视 depth=1。 */
function depthOf(state) {
  return state.subflow && Number.isInteger(state.subflow.depth) ? state.subflow.depth : 1;
}

/** active 子流程清单（阻塞判定，cli.js 的 next / run finish 拦截共用）。 */
function activeSubflows(state) {
  return Array.isArray(state.subflows) ? state.subflows.filter((s) => s.status === 'active') : [];
}

/** 沿 parentStatePath 上溯收集祖先链全部子流程 id（含本 state 自己的）——
 *  编号在整条 run 内唯一（plan 实体定义），孙流程不与叔伯重号。上溯读失败即止（容错，
 *  唯一性退化为本 state 域，不阻塞创建）。 */
function collectSubflowIds(state) {
  const ids = new Set((state.subflows || []).map((s) => s.id));
  let cur = state;
  for (let hop = 0; cur.subflow && cur.subflow.parentStatePath && hop < MAX_DEPTH; hop++) {
    let parent;
    try {
      parent = readState(cur.subflow.parentStatePath);
    } catch {
      break;
    }
    for (const s of parent.subflows || []) ids.add(s.id);
    cur = parent;
  }
  return ids;
}

/** 下一个可用子流程 id：sf-<n>，n 取全 run 未占用的最小正整数。 */
function nextSubflowId(state) {
  const used = collectSubflowIds(state);
  let n = 1;
  while (used.has(`sf-${n}`)) n++;
  return `sf-${n}`;
}

/** configurable 预填（与 run start 同语义）：链内任务带 default 的旋钮预填进 atomTasks。 */
function prefillAtomTasks(preset, tasksDir) {
  const atomTasks = {};
  for (const s of preset.stages) {
    try {
      const cfg = JSON.parse(fs.readFileSync(path.join(tasksDir, s.task, 'config.json'), 'utf8'));
      for (const c of Array.isArray(cfg.configurable) ? cfg.configurable : []) {
        if (c && c.key && c.default !== undefined) {
          atomTasks[s.task] = { ...(atomTasks[s.task] || {}), [c.key]: c.default };
        }
      }
    } catch {
      // 任务 config 已在 expandStages 校验过，此处容错不阻断（与 run start 一致）
    }
  }
  return atomTasks;
}

/**
 * 运行期创建子流程（subflow start）：
 * 校验（--at 在父 currentStage / depth 上限 / 目录不冲突）→ 物化子 state（runDir/subflows/sf-n/）
 * → 注册父 subflows[]。tasksDir / workflowsDir 由调用方解析为绝对路径（cli 的 tasksDirFor 语义）。
 */
function subflowStart({ parentStatePath, atStage, title, workflow = 'basic', config, at, tasksDir, workflowsDir }) {
  const parent = readState(parentStatePath);
  assertState(parent);
  if (!atStage) throw new Error('subflow start: 缺少 --at <stageId>（下沉挂靠的父 stage）');
  if (!title) throw new Error('subflow start: 缺少 --title（子流程标题）');
  if (!parent.currentStage.length) {
    throw new Error('父流程已无进行中位置（run 已结束或未启动），不能下沉子流程');
  }
  const currentStageIds = parent.currentStage.map((e) => String(e).split(':')[0]);
  if (!currentStageIds.includes(atStage)) {
    throw new Error(`--at 不在父 currentStage: ${atStage}（现有: ${currentStageIds.join(', ')}）`);
  }
  const parentDepth = depthOf(parent);
  const depth = parentDepth + 1;
  if (depth > MAX_DEPTH) {
    throw new Error(
      `三层上限：父 depth=${parentDepth}，再下沉为第 ${depth} 层——超出最多 ${MAX_DEPTH} 层（父=1、子=2、孙=3）`
    );
  }
  const parentRunDir = parent.dirs && parent.dirs.runDir;
  if (!parentRunDir || !path.isAbsolute(parentRunDir)) {
    throw new Error('父 state 缺 dirs.runDir（绝对路径），无法定位 subflows 目录');
  }

  const preset = loadWorkflow(workflowsDir, workflow); // fail fast，不产生半截子流程
  const id = nextSubflowId(parent);
  const childRunDir = path.join(parentRunDir, SUBFLOWS_DIR, id);
  const childStatePath = path.join(childRunDir, '.state.json');
  if (fs.existsSync(childStatePath)) throw new Error(`子流程运行目录已存在: ${childRunDir}`);

  const atomTasks = prefillAtomTasks(preset, tasksDir);
  if (config !== undefined) applyConfigOverrides(config, preset, tasksDir, atomTasks);

  let effectivePreset = preset;
  if (preset.stages.some((s) => s.when)) effectivePreset = pruneStages(preset, atomTasks);
  const stages = expandStages(effectivePreset, tasksDir, at);
  const { currentStage, openedGates } = activateStarts(stages, tasksDir, at);

  fs.mkdirSync(childRunDir, { recursive: true });
  const child = {
    runId: `${parent.runId}-${id}`,
    title,
    startedAt: at,
    git: parent.git, // 同一仓库/工作树上下文，随父
    dirs: {
      projectRoot: parent.dirs.projectRoot,
      runDir: childRunDir,
      tasksDir,
    },
    currentStage,
    stages,
    atomTasks,
    subflow: {
      depth,
      parentStatePath: path.resolve(parentStatePath),
      parentRunId: parent.runId,
      atStage,
      title,
    },
  };
  assertState(child);
  writeState(childStatePath, child);

  // 注册父侧（I-S1 防逃逸复核：childStatePath 由本函数构造，必在 <runDir>/subflows/ 下）
  const base = path.join(parentRunDir, SUBFLOWS_DIR);
  const rel = path.relative(base, childStatePath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`子 statePath 越界: ${childStatePath}（须位于 ${base} 之内）`);
  }
  const entry = { id, title, workflow: preset.name, atStage, statePath: childStatePath, status: 'active', startedAt: at };
  parent.subflows = [...(parent.subflows || []), entry];
  assertState(parent);
  writeState(parentStatePath, parent);
  return {
    subflowId: id,
    statePath: childStatePath,
    depth,
    workflow: preset.name,
    currentStage,
    openedGates,
    registered: entry,
  };
}

/**
 * 子流程收口（subflow close）：校验子 state 终态（currentStage 空）后置 closed + closedAt；
 * --abandon 放弃收口（跳过终态校验，标 abandoned——用户决议放弃的留痕，父流程可继续）。
 * 子流程清单走父 state 的 status 视图（cli.js statusView 渲染注册条目全字段，工具链精简 CS-1）。
 */
function subflowClose({ parentStatePath, id, abandon = false, at }) {
  const parent = readState(parentStatePath);
  assertState(parent);
  const existing = parent.subflows || [];
  const entry = existing.find((s) => s.id === id);
  if (!entry) {
    throw new Error(`子流程不存在: ${id}（现有: ${existing.map((s) => s.id).join(', ') || '无'}）`);
  }
  if (entry.status === 'closed') {
    throw new Error(`子流程 ${id} 已 closed（closedAt=${entry.closedAt}，不可重复收口）`);
  }
  if (!abandon) {
    let child;
    try {
      child = readState(entry.statePath);
    } catch (e) {
      throw new Error(`子 state 不可读: ${entry.statePath}（${e.message}）——确认材料后可用 --abandon 放弃收口`);
    }
    if (Array.isArray(child.currentStage) && child.currentStage.length > 0) {
      throw new Error(
        `子流程 ${id} 未到终态（currentStage: ${child.currentStage.join(', ')}）——先以 --state ${entry.statePath} 推进至完成，或 --abandon 放弃`
      );
    }
  }
  entry.status = 'closed';
  entry.closedAt = at;
  if (abandon) entry.abandoned = true;
  parent.subflows = [...existing];
  assertState(parent);
  writeState(parentStatePath, parent);
  return { closed: { id, abandoned: abandon === true, closedAt: at, statePath: entry.statePath }, subflows: parent.subflows };
}

module.exports = { MAX_DEPTH, SUBFLOWS_DIR, depthOf, activeSubflows, nextSubflowId, subflowStart, subflowClose };
