'use strict';
// workflow 预设：加载校验 + stages 物化 + 相位推进依据（06 plan §2/§4）。
// 预设只是预设（D11）——物化进 .state.json 后状态自包含，不再回指本文件。
// stageId = 任务名（06 §2.1）：currentStage / rollback / exec 三处命名对齐。

const fs = require('fs');
const path = require('path');
const { validate } = require('./jsonschema');

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * 任务 config 结构校验（07 v1.4）：`atom-tasks/_schema/task-config.schema.json` 驱动。
 * 增量兼容：additionalProperties 放行（新字段不炸旧内核），已知字段严格。
 * 语义级约束（action 与 name 一致性）由 buildGate 在门注册时校验。
 */
function validateTaskConfig(cfg, taskName) {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'atom-tasks', '_schema', 'task-config.schema.json'), 'utf8'));
  const { valid, errors } = validate(schema, cfg);
  if (!valid) throw new Error(`任务 ${taskName} 的 config.json 不符合标准格式: ${errors.join('；')}`);
  if (cfg.name !== taskName) throw new Error(`任务 ${taskName} 的 config.name 不一致: ${cfg.name}`);
  return true;
}

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
    validateTaskConfig(JSON.parse(fs.readFileSync(path.join(taskDir, 'config.json'), 'utf8')), s.task); // 标准格式 fail fast（07 v1.4）
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

/** 相位类型 → 阶段状态（06 P2：数据先行；07 起配合 gate 拦截）。 */
const statusForPhase = (type) => (type === 'human' ? 'waiting-human' : 'running');

// ---------------------------------------------------------------- 确认门（07 plan §3）

// 决议名 = 用户词汇（07 v1.4）：ASCII 词字符 + CJK 基本区，无空格——名字即用户嘴里的词
const DECISION_RE = /^[\w一-鿿][\w一-鿿-]*$/;
// action 四类（07 v1.4）：
//   推进型  next --decision <name>（name 须与本选项 name 一致）
//   转移型  rollback --stage <id> / run finish --status <s>
//   相位内  in-phase（无 CLI 命令，按该相位 prompt 的行为定义处理，不触推进命令）
const NEXT_ACTION_RE = /^next --decision (\S+)$/;
const ROLLBACK_ACTION_RE = /^rollback --stage ([A-Za-z0-9][A-Za-z0-9._-]*)$/;
const FINISH_ACTION_RE = /^run finish --status (done|aborted|failed)$/;
const isLegalAction = (a) =>
  a === 'in-phase' || NEXT_ACTION_RE.test(a) || ROLLBACK_ACTION_RE.test(a) || FINISH_ACTION_RE.test(a);
const isAdvancing = (a) => a.startsWith('next ');

/** 直接后继（兜底 options 的 desc 需要：确认通过后会点亮谁）。 */
function successors(stages, id) {
  return Object.keys(stages).filter((s) => (stages[s].dependOn || []).includes(id));
}

/**
 * 标准二元兜底（任务未声明 gate.options 时）：同意 + 驳回（回滚自身）。
 * 同意的 desc 按真实下一步现算（07 v1.3）：同阶段还有下一相位 →「进入 X（摘要）」；
 * 否则按 DAG →「收尾并点亮 后继」；无后继 →「收尾（run 将完成）」。
 */
function standardOptions(stages, stageId, phase, tasksDir) {
  const cfg = JSON.parse(fs.readFileSync(path.join(tasksDir, stageId, 'config.json'), 'utf8'));
  const phases = Array.isArray(cfg.phases) ? cfg.phases : [];
  const i = phases.findIndex((p) => String(p.id).padStart(2, '0') === phase);
  let approveDesc;
  if (i !== -1 && i + 1 < phases.length) {
    const np = String(phases[i + 1].id).padStart(2, '0');
    approveDesc = `确认通过：进入 ${stageId}:${np}（${phases[i + 1].summary || np}）`;
  } else {
    const succ = successors(stages, stageId);
    approveDesc = succ.length
      ? `确认通过：${stageId} 收尾并点亮 ${succ.join('、')}`
      : `确认通过：${stageId} 收尾（run 将完成）`;
  }
  return [
    { name: '同意', desc: approveDesc, action: 'next --decision 同意' },
    { name: '驳回', desc: `回滚 ${stageId} 阶段重做`, action: `rollback --stage ${stageId}` },
  ];
}

/**
 * 构建门实例（07 plan §3）：phase 为 human 相位时返回 { phase, openedAt, options }，否则 null。
 * options 来源：任务声明 gate.options 三元组逐字注册（action 白名单 fail fast）／未声明 → 标准二元兜底。
 */
function buildGate(stages, stageId, phase, tasksDir, at) {
  const cfg = JSON.parse(fs.readFileSync(path.join(tasksDir, stageId, 'config.json'), 'utf8'));
  const phases = Array.isArray(cfg.phases) ? cfg.phases : [];
  const entry = phases.find((p) => String(p.id).padStart(2, '0') === phase);
  if (!entry || entry.type !== 'human') return null;

  const declared = entry.gate && Array.isArray(entry.gate.options) ? entry.gate.options : null;
  let options;
  if (declared && declared.length) {
    const seen = new Set();
    for (const t of declared) {
      const where = `任务 ${stageId} 相位 ${phase} 的 gate.options`;
      if (!t || typeof t.name !== 'string' || !DECISION_RE.test(t.name)) {
        throw new Error(`${where}非法: name=${JSON.stringify(t && t.name)}（须为无空格的用户词汇：字母/数字/下划线/连字符/CJK）`);
      }
      if (seen.has(t.name)) throw new Error(`${where}决议重复: ${t.name}`);
      seen.add(t.name);
      if (typeof t.desc !== 'string' || !t.desc) throw new Error(`${where}决议 ${t.name} 缺少 desc`);
      if (typeof t.action !== 'string' || !isLegalAction(t.action)) {
        throw new Error(
          `${where}决议 ${t.name} 的 action 非法: ${t.action}（须为 next --decision <name> / rollback --stage <id> / run finish --status <s> / in-phase）`
        );
      }
      const m = t.action.match(NEXT_ACTION_RE);
      if (m && m[1] !== t.name) throw new Error(`${where}决议 ${t.name} 的 action 指向其他决议: ${m[1]}`);
    }
    options = declared.map(({ name, desc, action }) => ({ name, desc, action }));
  } else {
    options = standardOptions(stages, stageId, phase, tasksDir);
  }
  return { phase, openedAt: at, options };
}

module.exports = {
  loadWorkflow, expandStages, validateTaskConfig, phaseType, nextPhase, readyStages, statusForPhase,
  standardOptions, buildGate, isAdvancing,
};
