'use strict';
// workflow 预设：加载校验 + stages 物化 + 相位推进依据（06 plan §2/§4）。
// 预设只是预设（D11）——物化进 .state.json 后状态自包含，不再回指本文件。
// stageId = 任务名（06 §2.1）：currentStage / rollback / exec 三处命名对齐。

const fs = require('fs');
const path = require('path');

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * 加载并校验预设（fail fast，02 §7——启动报错不产生半截 run）：
 * 结构完整 / name 与文件名一致 / 无重复任务 / dependOn 引用存在 / DAG 无环（Kahn）。
 */
function loadWorkflow(workflowsDir, name) {
  if (!NAME_RE.test(name)) throw new Error(`预设名非法: ${name}`);
  const file = path.join(workflowsDir, `${name}.json`);
  let preset;
  try {
    preset = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') throw new Error(`workflow 预设不存在: ${file}`);
    throw new Error(`workflow 预设解析失败: ${file}: ${e.message}`);
  }
  if (preset.name !== name) throw new Error(`预设 name 与文件名不一致: ${preset.name} vs ${name}`);
  if (typeof preset.version !== 'string' || !preset.version) throw new Error(`预设 ${name} 缺少 version`);
  if (!Array.isArray(preset.stages) || !preset.stages.length) throw new Error(`预设 ${name} 的 stages 必须为非空数组`);

  const seen = new Set();
  for (const s of preset.stages) {
    if (!s || typeof s.task !== 'string' || !NAME_RE.test(s.task)) {
      throw new Error(`stages[].task 非法: ${JSON.stringify(s && s.task)}`);
    }
    if (!Array.isArray(s.dependOn)) throw new Error(`stages[${s.task}].dependOn 必须为数组`);
    if (seen.has(s.task)) throw new Error(`任务重复出现: ${s.task}（同一任务多 stage 属后续扩展）`);
    seen.add(s.task);
  }
  for (const s of preset.stages) {
    for (const d of s.dependOn) {
      if (!seen.has(d)) throw new Error(`stages[${s.task}].dependOn 引用不存在的 stage: ${d}`);
    }
  }

  const indeg = new Map(preset.stages.map((s) => [s.task, 0]));
  for (const s of preset.stages) indeg.set(s.task, s.dependOn.length);
  const queue = [...indeg.entries()].filter(([, n]) => n === 0).map(([t]) => t);
  let popped = 0;
  while (queue.length) {
    const t = queue.shift();
    popped++;
    for (const s of preset.stages) {
      if (!s.dependOn.includes(t)) continue;
      indeg.set(s.task, indeg.get(s.task) - 1);
      if (indeg.get(s.task) === 0) queue.push(s.task);
    }
  }
  if (popped !== preset.stages.length) throw new Error(`预设 ${name} 的 DAG 存在环`);

  return preset;
}

/**
 * 物化 stages（02 §5.4）：预设逐项展开为 pending 条目；任务存在性在此核验。
 * 返回后由调用方按相位类型点亮起点（run start）。
 */
function expandStages(preset, tasksDir, at) {
  const stages = {};
  for (const s of preset.stages) {
    const taskDir = path.join(tasksDir, s.task);
    if (!fs.existsSync(path.join(taskDir, 'prompt.md')) || !fs.existsSync(path.join(taskDir, 'config.json'))) {
      throw new Error(`原子任务不存在或结构不完整: ${taskDir}（需含 prompt.md + config.json）`);
    }
    stages[s.task] = { status: 'pending', dependOn: [...s.dependOn], at };
  }
  return stages;
}

/** 相位类型（D4：推进依据全在任务 config；未声明 phases = 单相位 01 且视为 action）。 */
function phaseType(tasksDir, taskName, phase) {
  const cfg = JSON.parse(fs.readFileSync(path.join(tasksDir, taskName, 'config.json'), 'utf8'));
  const phases = Array.isArray(cfg.phases) ? cfg.phases : [];
  const entry = phases.find((p) => String(p.id).padStart(2, '0') === phase);
  return entry && entry.type === 'human' ? 'human' : 'action';
}

/** 下一相位：无声明 = ['01']；返回 null 表示相位耗尽（阶段收尾）。 */
function nextPhase(tasksDir, taskName, phase) {
  const cfg = JSON.parse(fs.readFileSync(path.join(tasksDir, taskName, 'config.json'), 'utf8'));
  const ids = (Array.isArray(cfg.phases) ? cfg.phases : [{ id: '01' }]).map((p) => String(p.id).padStart(2, '0'));
  const i = ids.indexOf(phase);
  if (i === -1) throw new Error(`相位 ${phase} 未在任务 ${taskName} 声明（已声明: ${ids.join(', ')}）`);
  return i + 1 < ids.length ? ids[i + 1] : null;
}

/** DAG 就绪集：pending 且 dependOn 全 done。 */
function readyStages(stages) {
  return Object.keys(stages).filter(
    (id) => stages[id].status === 'pending' && (stages[id].dependOn || []).every((d) => stages[d] && stages[d].status === 'done')
  );
}

/** 相位类型 → 阶段状态（06 P2：数据先行，L3 强制归执行循环轮）。 */
const statusForPhase = (type) => (type === 'human' ? 'waiting-human' : 'running');

module.exports = { loadWorkflow, expandStages, phaseType, nextPhase, readyStages, statusForPhase };
