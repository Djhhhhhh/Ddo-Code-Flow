#!/usr/bin/env node
'use strict';
// ddo-tools — v2 确定性执行内核。
// 契约：命令注册表即文档源（--help 纯渲染）；四通道输出
// （stdout=JSON / stderr=人话 / exit 0·1·2 / 状态文件现读不缓存）。
// 命令在归属的设计轮次登记（03 plan §3.4 命名空间政策）；
// 当前登记：run start（06）、run finish、rollback（04）、exec、validate（05）、next（06）、status（07）、resume（08）、list tasks / list workflows（10）、
// gate present / gate interact、guide（交互协议结构闭环）。

const path = require('path');
const fs = require('fs');
const { readState, writeState, assertState } = require('./lib/state');
const registry = require('./lib/index-registry');
const history = require('./lib/history');
const { assemble, mergeConfig } = require('./lib/assemble');
const { loadTaskSchema, validateArtifact } = require('./lib/output-schema');
const { loadWorkflow, expandStages, phaseType, nextPhase, readyStages, statusForPhase, standardOptions, buildGate, isAdvancing } = require('./lib/workflow');
const { openGates, presentPayload, renderGateOptions, fillState, isPresentationValid } = require('./lib/gate');
const { gitInfo } = require('./lib/git-info');

const ATOM_TASKS_DIR = path.join(__dirname, '..', 'atom-tasks');
const WORKFLOWS_DIR = path.join(__dirname, '..', 'workflows');
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

class UsageError extends Error {}

// 本地时间 ISO 8601 带时区偏移（02 §5.2.1：便于人工扫读，与 runId 的本地日期一致；
// eval dogfooding 内审修复——原 toISOString() 输出 UTC，导致 runId「0924」与 startedAt「09-23T17:xxZ」日期对不上）
const nowIso = () => {
  const d = new Date();
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const pad = (n, l = 2) => String(Math.abs(n)).padStart(l, '0');
  const [hh, mm] = [Math.floor(Math.abs(off) / 60), Math.abs(off) % 60];
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}` +
    `${sign}${pad(hh)}:${pad(mm)}`;
};
const stageIdOf = (entry) => String(entry).split(':')[0];
const phaseOf = (entry) => String(entry).split(':')[1] || '01';

/**
 * 执行位置（07 plan §4.1 节律结构锁）：task 在 currentStage 中的当前相位；不在 → null。
 * exec/validate 以此校验位置一致并取相位缺省。
 */
function currentPosition(state, taskName) {
  for (const entry of state.currentStage) {
    if (stageIdOf(entry) === taskName) return phaseOf(entry);
  }
  return null;
}

/** 产物路径防逃逸（11 §4）：file 须为 runDir 内相对路径，返回拼接后的绝对路径。 */
function artifactPath(runDir, file) {
  if (typeof file !== 'string' || !file || path.isAbsolute(file) || file.split('/').includes('..')) {
    throw new Error(`产物声明非法: ${JSON.stringify(file)}（须为 runDir 内相对路径，禁绝对路径与 ..）`);
  }
  const joined = path.join(runDir, file);
  const rel = path.relative(runDir, joined);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`产物声明越界: ${file}`);
  return joined;
}

/** _del 归档子目录（11 §3）：<runDir>/_del/rollback-<n>，n = 现有最大编号 + 1（扫描推导，不加 state 字段）。 */
function nextDelDir(runDir) {
  const del = path.join(runDir, '_del');
  let max = 0;
  if (fs.existsSync(del)) {
    for (const e of fs.readdirSync(del)) {
      const m = e.match(/^rollback-(\d+)$/);
      if (m) max = Math.max(max, Number(m[1]));
    }
  }
  return path.join(del, `rollback-${max + 1}`);
}

/** 任务目录三级取值（12 D1）：--tasks-dir flag > state.dirs.tasksDir（run 既定）> skillRoot 缺省。 */
function tasksDirFor(f, state) {
  if (f['tasks-dir']) return path.resolve(f['tasks-dir']);
  return (state.dirs && state.dirs.tasksDir) || ATOM_TASKS_DIR;
}

/** 阶段的 output 声明文件全集（去重）：相位级 + 顶层。 */
function stageOutputFiles(tasksDir, stageId) {
  const cfg = JSON.parse(fs.readFileSync(path.join(tasksDir, stageId, 'config.json'), 'utf8'));
  const decls = [];
  for (const ph of Array.isArray(cfg.phases) ? cfg.phases : []) {
    if (ph.output !== undefined) decls.push(ph.output);
  }
  if (cfg.output !== undefined) decls.push(cfg.output);
  return [...new Set(decls.flatMap((d) => (typeof d === 'string' ? [d] : (d && d.updates) || [])))];
}

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
  // statePath 统一绝对化（eval dogfooding 内审修复 D-4）：history 的 statePath 是跨 cwd 的
  // 追溯入口，命令行传相对路径时原样记录会导致归档指针不可解析、与 index 注册形态不一致
  const statePath = path.resolve(f.state);
  const finalStatus = f.status;
  if (!['done', 'aborted', 'failed'].includes(finalStatus)) {
    throw new UsageError('--status 必须是 done | aborted | failed');
  }
  const state = readState(statePath);
  assertState(state);
  // 免归档开关（--no-archive）：流程型 run（如交付链）不入用户级 history——跳过下方 ①②；
  // ③ index 移除与 ④ currentStage 清空照旧，state 原文件仍随项目版控走（追溯适用，不落 state）
  const noArchive = f['no-archive'] === true;
  // 临时模式分支（runId 目录创建可配，DEC-3/4）：蕴含免归档（zip 与 runs.jsonl 均不落）→ 删 runDir → index 移除。
  // 顺序不变量：删除成功前不动 index——失败时 state 与指针双完好，重跑 finish 即恢复收口；
  // rmSync force 幂等（目录已删的重跑直接走完剩余步）；不写回 state（材料即将/已经消亡，清空无意义）
  if (state.ephemeral === true) {
    const runDir = (state.dirs && state.dirs.runDir) || path.dirname(statePath);
    try {
      fs.rmSync(runDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch (e) {
      process.stderr.write(`[finish] 临时 run 材料删除失败: ${runDir}（可手动清理后重跑 run finish）\n${e.message}\n`);
      throw e;
    }
    registry.unregister(state.runId);
    return { finished: state.runId, finalStatus, ephemeral: true, deleted: true };
  }
  // 迁移顺序（11 §2，02 §7 修订；#51 起 ① 为整目录 zip）：① runDir zip 归档（含 .state.json，
  // 保留收束前最后位置，幂等覆盖）② history 追加 ③ index 移除 ④ currentStage 清空——
  // ①② 幂等，崩溃残留被惰性校验兜住
  if (!noArchive) {
    const runDir = (state.dirs && state.dirs.runDir) || path.dirname(statePath); // 历史 state 缺 dirs 回落
    history.archiveRunZip(state.runId, runDir);
    history.append({
      runId: state.runId,
      title: state.title,
      git: state.git,
      startedAt: state.startedAt,
      endedAt: nowIso(),
      finalStatus,
      statePath,
    });
  }
  registry.unregister(state.runId);
  if (state.currentStage.length > 0) {
    state.currentStage = [];
    writeState(statePath, state);
  }
  return { finished: state.runId, finalStatus, archived: !noArchive };
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
  const tasksDir = tasksDirFor(f, state);
  const reset = rollbackResetSet(state.stages, target, state.currentStage);

  // 呈现前置校验（交互协议结构闭环）：rollback 是门声明的转移型决议载体（如 驳回）——
  // 目标 stage 自身开门且呈现无效（从未呈现/交互后未重新呈现）时拦截；
  // 非门用途的回滚（上游重置、门关闭后的常规回滚）不受此约束
  const targetGate = openGates(state, statePath, tasksDir).find((g) => g.stage === target);
  if (targetGate && !isPresentationValid(state.stages[target].gate).valid) {
    process.stderr.write(
      `[呈现未更新] ${target}:${targetGate.phase} 的门选项未向用户呈现，或在上次相位内交互后未重新呈现\n` +
      `驳回类回滚同样需要用户先看到选项：跑 gate present --state ${statePath} 呈现后由用户选择\n${renderGateOptions([targetGate])}\n`
    );
    process.exitCode = 1;
    return { blocked: 'gate-unpresented', stage: target };
  }

  // 失效产物归档（11 §3，激活 04 §2.2 契约）：重置集合各阶段声明的 output 文件，
  // 存在则移动到 <runDir>/_del/rollback-<n>/（移动语义，重做产新文件；缺失跳过）
  const runDir = (state.dirs && state.dirs.runDir) || path.dirname(statePath);
  const delDir = nextDelDir(runDir);
  const archived = [];
  for (const s of reset) {
    for (const file of stageOutputFiles(tasksDir, s)) {
      const src = artifactPath(runDir, file); // 防逃逸双保险
      if (fs.existsSync(src)) {
        fs.mkdirSync(delDir, { recursive: true });
        fs.renameSync(src, path.join(delDir, path.basename(file)));
        archived.push(file);
      }
    }
  }

  const rolledBack = [];
  const pathReset = [];
  const clearedGates = [];
  for (const s of reset) {
    const from = state.stages[s].status;
    state.stages[s] = { ...state.stages[s], status: 'pending', at: nowIso() };
    if (state.stages[s].gate) {
      delete state.stages[s].gate; // 阶段重置 = 干净重做（07 §3.2：转移型决议/上游回滚清门）
      clearedGates.push(s);
    }
    if (s === target) rolledBack.push({ stage: s, from, to: 'pending' });
    else pathReset.push(s);
  }
  state.currentStage = [`${target}:01`];
  writeState(statePath, state);
  if (f.reason) process.stderr.write(`[rollback] reason: ${f.reason}\n`);
  return {
    rolledBack, pathReset,
    ...(clearedGates.length ? { clearedGates } : {}),
    ...(archived.length ? { archivedTo: `_del/${path.basename(delDir)}`, archived } : {}),
    currentStage: state.currentStage,
  };
}

function runExec(f) {
  const statePath = f.state;
  const taskName = f.task;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(taskName)) {
    throw new UsageError(`--task 非法: ${taskName}`);
  }
  const state = readState(statePath);
  assertState(state);

  // 位置校验（07 §4.1）：--task 须 ∈ currentStage；--phase 缺省 = 当前相位，显式须一致
  const cur = currentPosition(state, taskName);
  if (!cur) {
    throw new Error(
      `执行位置不符：${taskName} 不在 currentStage [${state.currentStage.join(', ')}]（run 已结束、未启动或位置未对齐；用 status 查看）`
    );
  }
  let phase;
  if (f.phase === undefined) phase = cur;
  else {
    phase = String(f.phase).padStart(2, '0');
    if (phase !== cur) throw new Error(`执行位置不符：当前位置 ${taskName}:${cur}，不能 exec ${taskName}:${phase}`);
  }

  const taskDir = require('path').join(f['tasks-dir'] ? require('path').resolve(f['tasks-dir']) : ATOM_TASKS_DIR, taskName);
  const promptFile = require('path').join(taskDir, 'prompt.md');
  if (!require('fs').existsSync(promptFile) || !require('fs').existsSync(require('path').join(taskDir, 'config.json'))) {
    throw new Error(`原子任务不存在或结构不完整: ${taskDir}（需含 prompt.md + config.json；可用任务见 list tasks）`);
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
  const state = readState(statePath);
  assertState(state);

  // 位置校验（07 §4.1）：与 exec 同一协议（缺省 = 当前相位，显式须一致）
  const cur = currentPosition(state, taskName);
  if (!cur) {
    throw new Error(
      `执行位置不符：${taskName} 不在 currentStage [${state.currentStage.join(', ')}]（run 已结束、未启动或位置未对齐；用 status 查看）`
    );
  }
  let phase;
  if (f.phase === undefined) phase = cur;
  else {
    phase = String(f.phase).padStart(2, '0');
    if (phase !== cur) throw new Error(`执行位置不符：当前位置 ${taskName}:${cur}，不能校验 ${taskName}:${phase}`);
  }

  const path = require('path');
  const fs = require('fs');
  const tasksDir = tasksDirFor(f, state);
  const taskDir = path.join(tasksDir, taskName);
  const cfgFile = path.join(taskDir, 'config.json');
  if (!fs.existsSync(path.join(taskDir, 'prompt.md')) || !fs.existsSync(cfgFile)) {
    throw new Error(`原子任务不存在或结构不完整: ${taskDir}（需含 prompt.md + config.json；可用任务见 list tasks）`);
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

  const runDir = (state.dirs && state.dirs.runDir) || path.dirname(statePath);
  const files = typeof decl === 'string' ? [decl] : (decl.updates || []);
  const resolved = files.map((file) => artifactPath(runDir, file)); // 防逃逸（11 §4）
  const missing = resolved.filter((abs) => !fs.existsSync(abs));

  const errors = [];
  if (typeof decl === 'string' && schema && !missing.length) {
    errors.push(...validateArtifact(schema, fs.readFileSync(resolved[0], 'utf8')));
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

function runStart(f) {
  const workflowName = f.workflow === undefined ? 'basic' : f.workflow;
  const type = f.type === undefined ? 'feat' : f.type;
  const project = f.project ? path.resolve(f.project) : process.cwd();
  const workflowsDir = f['workflows-dir'] ? path.resolve(f['workflows-dir']) : WORKFLOWS_DIR;
  const tasksDir = f['tasks-dir'] ? path.resolve(f['tasks-dir']) : ATOM_TASKS_DIR;
  if (!NAME_RE.test(type)) throw new UsageError(`--type 非法: ${type}`);
  if (f['dir-name'] !== undefined && !NAME_RE.test(f['dir-name'])) {
    throw new UsageError(`--dir-name 非法: ${f['dir-name']}（仅限单段安全字符）`);
  }
  // 临时模式（DEC-1）：运行材料整体移居 <home>/tmp/ddo（项目内零创建），finish 后直接删除。
  // --dir-name 互斥——语义目录名对即删材料无意义，fail fast 防歧义
  const ephemeral = f.ephemeral === true;
  if (ephemeral && f['dir-name'] !== undefined) {
    throw new UsageError('--dir-name 与 --ephemeral 互斥：临时模式运行材料即删，语义目录名无意义');
  }

  const preset = loadWorkflow(workflowsDir, workflowName); // fail fast（06 §2.2），不产生半截 run
  const startedAt = nowIso();
  const runId = registry.freshRunId();
  const stages = expandStages(preset, tasksDir, startedAt);

  // 起点：dependOn 为空的阶段全部点亮，status 按各自首相位类型（P2 数据先行）；
  // 首相位为 human → 开门（07 §4.3，机制对称支持）
  const openedGates = [];
  const currentStage = Object.keys(stages)
    .filter((id) => !(stages[id].dependOn || []).length)
    .map((id) => {
      stages[id] = { ...stages[id], status: statusForPhase(phaseType(tasksDir, id, '01')) };
      const gate = buildGate(stages, id, '01', tasksDir, startedAt);
      if (gate) {
        stages[id] = { ...stages[id], gate };
        openedGates.push({ stage: id, phase: '01', options: gate.options });
      }
      return `${id}:01`;
    });

  // 居所分叉（DEC-2）：ephemeral → <home>/tmp/ddo/<type>/<runId>（与项目内布局同构）；正常 → 现状不动。
  // 两分支共用下方「statePath 已存在则抛错」防重检查（runId 唯一性由 freshRunId 保证）
  const dirName = f['dir-name'] || runId;
  const runDir = ephemeral
    ? path.join(registry.tmpRunsHome(), type, runId)
    : path.join(project, '.ddo', 'runs', type, dirName);
  const statePath = path.join(runDir, '.state.json');
  if (fs.existsSync(statePath)) throw new Error(`运行目录已存在: ${runDir}`);
  fs.mkdirSync(runDir, { recursive: true });

  // configurable 预填（10 D3）：workflow 内任务声明的可配置项，带 default 的预填进
  // state.atomTasks——用户打开 state 即知本次 run 可改哪些旋钮（无 default 的仅在 list tasks 呈现）
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
      // 任务 config 已在 expandStages 校验过，此处容错不阻断
    }
  }

  const state = {
    runId,
    title: f.title,
    startedAt,
    ...(ephemeral ? { ephemeral: true } : {}), // 临时模式标记（DEC-5）：finish 据此走删除分支
    git: gitInfo(project), // D5 推断链：仓库推断或置空；worktree 场景归 git-worktree 任务
    dirs: { projectRoot: project, runDir, tasksDir }, // 目录定版（11 §1.2 + 12 D1）：产物居所 + 任务目录，run 自包含
    currentStage,
    stages,
    atomTasks,
  };
  assertState(state);
  writeState(statePath, state);
  registry.register(runId, { statePath, startedAt });
  return { runId, title: state.title, statePath, workflow: preset.name, currentStage, openedGates };
}

function runNext(f) {
  const state = readState(f.state);
  assertState(state);
  if (!state.currentStage.length) throw new Error('无待推进阶段（run 已结束或未启动）');
  const statePath = f.state;
  const tasksDir = tasksDirFor(f, state);
  const now = nowIso();

  // 门检查（07 §4.2 + 交互协议结构闭环）：human 相位必须经用户决议才能推进——
  // 开门集自 lib/gate 同源派生（静态声明 ∪ present 钩子动态选项）；
  // 无 gate 视同开门（严格语义：手工/legacy state 不放行，提示用标准兜底操作）
  const gates = openGates(state, statePath, tasksDir);
  const gateJson = () => gates.map(({ stage, phase, options }) => ({ stage, phase, options }));
  const decision = f.decision;
  if (gates.length) {
    if (decision === undefined) {
      // 错误信息本身就是提示：stderr 人话 + stdout JSON 含门全量（07 D3）
      process.stderr.write(
        `[确认门未关闭] ${gates.map((g) => `${g.stage}:${g.phase} 需用户决议`).join('；')}\n` +
        `先跑 gate present --state ${statePath} 取统一交互 payload 并呈现给用户，用户选择后按 dispatch 处理：\n${renderGateOptions(gates)}\n`
      );
      process.exitCode = 1;
      return { blocked: 'gate-open', gates: gateJson() };
    }
    for (const g of gates) {
      const hit = g.options.find((t) => t.name === decision);
      if (!hit) {
        throw new UsageError(`未知决议: ${decision}（${g.stage}:${g.phase} 声明: ${g.options.map((t) => t.name).join(', ')}）`);
      }
      if (hit.action === 'in-phase') {
        throw new Error(`决议 ${decision} 是相位内交互（${hit.desc}）——按该相位 prompt 的行为定义处理，不走 next`);
      }
      if (!isAdvancing(hit.action)) {
        throw new Error(`决议 ${decision} 的动作不是推进（${hit.action}）——请执行该声明的命令`);
      }
    }
    // 呈现前置校验（交互协议结构闭环）：决议合法后、推进前——
    // 必须存在晚于「门开启时间与最后一条交互记录较晚者」的呈现记录（gate present 留痕）
    const invalid = gates.filter((g) => !isPresentationValid(state.stages[g.stage].gate).valid);
    if (invalid.length) {
      process.stderr.write(
        `[呈现未更新] ${invalid.map((g) => `${g.stage}:${g.phase}`).join('；')} 的门选项未向用户呈现，或在上次相位内交互后未重新呈现\n` +
        `先跑 gate present --state ${statePath} 把选项呈现给用户，获得用户明确选择后再决议：\n${renderGateOptions(gates)}\n`
      );
      process.exitCode = 1;
      return { blocked: 'gate-unpresented', gates: gateJson() };
    }
  } else if (decision !== undefined) {
    throw new UsageError('--decision 仅在存在未关闭确认门时使用');
  }

  const advanced = [];
  const finished = [];
  const closedGates = [];
  const nextEntries = [];
  for (const entry of state.currentStage) {
    const stageId = stageIdOf(entry);
    if (!(stageId in state.stages)) throw new Error(`stage 不存在: ${stageId}（现有: ${Object.keys(state.stages).join(', ')}）`);
    const phase = phaseOf(entry);
    // 推进型决议留痕：本轮被决议的门落 decision/closedAt（gate 对象不存在则跳过——不伪造）
    if (decision !== undefined && state.stages[stageId].gate && !state.stages[stageId].gate.decision) {
      state.stages[stageId].gate = { ...state.stages[stageId].gate, decision, closedAt: now };
      closedGates.push({ stage: stageId, decision });
    }
    const np = nextPhase(tasksDir, stageId, phase);
    if (np) {
      // 相位内推进：status 按新相位类型（action→running / human→waiting-human + 开门）
      state.stages[stageId] = { ...state.stages[stageId], status: statusForPhase(phaseType(tasksDir, stageId, np)), at: now };
      nextEntries.push(`${stageId}:${np}`);
      advanced.push({ stage: stageId, from: entry, to: `${stageId}:${np}` });
    } else {
      // 相位耗尽：阶段收尾
      state.stages[stageId] = { ...state.stages[stageId], status: 'done', at: now };
      finished.push(stageId);
    }
  }

  // DAG 推进：收尾后新就绪的 pending 阶段全部激活（基础线性链恒为一个）；首相位 human → 开门
  const activated = [];
  const openedGates = [];
  for (const id of readyStages(state.stages)) {
    state.stages[id] = { ...state.stages[id], status: statusForPhase(phaseType(tasksDir, id, '01')), at: now };
    nextEntries.push(`${id}:01`);
    activated.push(id);
  }
  // 开门统一后置处理：进入 human 相位（相位内推进 + DAG 点亮）时写门
  const tryOpen = (stageId, phase) => {
    if (phaseType(tasksDir, stageId, phase) !== 'human') return;
    const gate = buildGate(state.stages, stageId, phase, tasksDir, now);
    if (gate) {
      state.stages[stageId] = { ...state.stages[stageId], gate };
      openedGates.push({ stage: stageId, phase, options: gate.options });
    }
  };
  for (const a of advanced) tryOpen(a.stage, a.to.split(':')[1]);
  for (const id of activated) tryOpen(id, '01');

  state.currentStage = nextEntries;
  writeState(f.state, state);
  // 终点不自动 run finish（04 D6：生命周期唯一入口保持 run finish）
  return { advanced, finished, activated, openedGates, closedGates, currentStage: state.currentStage, completed: nextEntries.length === 0 };
}

// ---------------------------------------------------------------- status（07 §4.4）

function runStatus(f) {
  const statePath = f.state;
  const state = readState(statePath);
  assertState(state);
  return statusView(state, statePath, tasksDirFor(f, state));
}

// ---------------------------------------------------------------- statusView / resume（07/08）

/** 状态细节视图（07 status 与 08 resume --run-id 共用）：位置 + gateOptions + availableCommands。 */
function statusView(state, statePath, tasksDir) {
  const positions = state.currentStage.map((entry) => {
    const stage = stageIdOf(entry);
    const phase = phaseOf(entry);
    const gate = state.stages[stage] && state.stages[stage].gate;
    return {
      stage, phase,
      phaseType: phaseType(tasksDir, stage, phase),
      status: state.stages[stage].status,
      ...(gate ? { gate } : {}),
    };
  });

  // gateOptions（呈现集）/ availableCommands（可执行集）派生（不存储，单一事实源）：
  // human 开门位 → gateOptions = openGates 同源派生（静态 ∪ present 钩子动态选项，
  //                含 in-phase 相位内交互，与 gate present payload 一致——交互形态不分叉），
  //                availableCommands 仅命令型选项（--state 补全）；
  // action 位 → exec/validate/next；全局 → rollback/finish
  const gateOptions = [];
  const availableCommands = [];
  if (!state.currentStage.length) {
    availableCommands.push({ cmd: `run finish --state ${statePath} --status done`, desc: '全部阶段完成，收束本次 run' });
  } else {
    const openList = openGates(state, statePath, tasksDir); // 同源派生（含动态选项）
    for (const p of positions) {
      const openGate = openList.find((g) => g.stage === p.stage && g.phase === p.phase);
      if (openGate) {
        for (const t of openGate.options) {
          gateOptions.push({ name: t.name, desc: t.desc, action: t.action });
          if (t.action !== 'in-phase') {
            availableCommands.push({ name: t.name, cmd: fillState(t.action, statePath), desc: t.desc });
          }
        }
      } else {
        availableCommands.push({ cmd: `exec --state ${statePath} --task ${p.stage} --phase ${p.phase}`, desc: `执行 ${p.stage}:${p.phase}（组装恰好必需的 prompt）` });
        availableCommands.push({ cmd: `validate --state ${statePath} --task ${p.stage} --phase ${p.phase}`, desc: `校验 ${p.stage}:${p.phase} 产物` });
        availableCommands.push({ cmd: `next --state ${statePath}`, desc: '推进（相位内 / 跨阶段 / DAG 就绪）' });
      }
    }
    for (const id of Object.keys(state.stages)) {
      if (state.stages[id].status !== 'pending') {
        availableCommands.push({ cmd: `rollback --state ${statePath} --stage ${id}`, desc: `回滚 ${id} 阶段（重置为 pending 重做）` });
      }
    }
    availableCommands.push({ cmd: `run finish --state ${statePath} --status aborted`, desc: '中止本次 run' });
  }
  return { runId: state.runId, title: state.title, currentStage: positions, gateOptions, availableCommands };
}


// ---------------------------------------------------------------- gate 域 / guide（交互协议结构闭环）

/**
 * gate present：统一交互呈现入口。物化隐式门 → 组装静态∪动态选项 → 盖 presentedAt（同一时刻）
 * → 输出 payload。payload 是 agent 向用户呈现的唯一数据源（dispatch 含执行指引）。
 */
function gatePresent(f) {
  const state = readState(f.state);
  assertState(state);
  if (!state.currentStage.length) throw new Error('无待呈现的确认门（run 已结束或未启动）');
  const statePath = f.state;
  const tasksDir = tasksDirFor(f, state);
  const gates = openGates(state, statePath, tasksDir);
  if (!gates.length) {
    process.stderr.write('[无开门] 当前位置没有等待决议的确认门（用 status 查看位置）\n');
    process.exitCode = 1;
    return { presented: 0 };
  }
  const now = nowIso();
  const presented = [];
  for (const g of gates) {
    // 隐式门物化（注册源仍是相位声明，present 是实例的补全时机——不伪造）
    const gate = state.stages[g.stage].gate || buildGate(state.stages, g.stage, g.phase, tasksDir, now);
    state.stages[g.stage] = { ...state.stages[g.stage], gate: { ...gate, presentedAt: now } };
    presented.push(g.stage);
  }
  writeState(statePath, state);
  return { ...presentPayload(gates, statePath), presentedAt: now, presented };
}

/** gate interact：in-phase 交互留痕（使既有呈现过期）。选项合法性按同源开门集校验（静态∪动态）。 */
function gateInteract(f) {
  const state = readState(f.state);
  assertState(state);
  if (!f.option) throw new UsageError('gate interact: 缺少必填参数 --option（in-phase 选项名，用 --help 查看用法）');
  const statePath = f.state;
  const tasksDir = tasksDirFor(f, state);
  const gates = openGates(state, statePath, tasksDir);
  if (!gates.length) throw new Error('无开着的确认门可记录交互（用 status 查看位置）');
  const targets = f.stage ? gates.filter((g) => g.stage === f.stage) : gates;
  if (f.stage && !targets.length) {
    throw new UsageError(`--stage ${f.stage} 没有开着的确认门（开门: ${gates.map((g) => g.stage).join(', ')}）`);
  }
  if (targets.length > 1) {
    throw new UsageError(`存在多个开着的门（${targets.map((g) => g.stage).join(', ')}）——须 --stage 指定`);
  }
  const g = targets[0];
  const hit = g.options.find((t) => t.name === f.option);
  if (!hit) {
    const inPhase = g.options.filter((t) => t.action === 'in-phase').map((t) => t.name);
    throw new Error(`未知交互选项: ${f.option}（${g.stage}:${g.phase} 的 in-phase 选项: ${inPhase.join(', ') || '无'}；命令型决议走其声明命令，不记录交互）`);
  }
  if (hit.action !== 'in-phase') {
    throw new Error(`选项 ${f.option} 是命令型决议（${hit.action}）——agent 代跑该命令，不走 gate interact`);
  }
  const now = nowIso();
  const gate = state.stages[g.stage].gate || buildGate(state.stages, g.stage, g.phase, tasksDir, now);
  const interactions = [...((gate.interactions) || []), { option: f.option, ...(f.note ? { note: f.note } : {}), at: now }];
  state.stages[g.stage] = { ...state.stages[g.stage], gate: { ...gate, interactions } };
  writeState(statePath, state);
  return { recorded: { stage: g.stage, phase: g.phase, option: f.option, at: now } };
}

/** guide：冷启动引导唯一数据源（无 state、无副作用）——问目标/问模式/问类型，选项数据同 payload 形态。 */
function runGuide(f) {
  const wf = listWorkflows(f);
  return {
    questions: [
      { id: 'goal', question: '本次要做什么？一句话即为 --title', freeText: true },
      {
        id: 'mode',
        question: '用哪个工作流模式？',
        options: [
          ...wf.workflows.map((w) => ({ name: w.name, desc: `${w.description}（阶段链: ${w.stages.join(' → ')}）` })),
          { name: '自定义', desc: '与用户商定阶段链：先跑 list tasks 看任务清单，写临时预设 JSON 后 run start --workflows-dir <临时目录> --workflow <名>' },
        ],
      },
      {
        id: 'type',
        question: 'run 类型？（runDir 第一段）',
        options: [
          { name: 'feat', desc: '新能力（缺省）' },
          { name: 'fix', desc: '缺陷修复' },
          { name: 'docs', desc: '文档' },
          { name: 'chore', desc: '杂务' },
        ],
        freeText: '其他单段安全字符亦可（字母/数字/._-，如 refactor）',
      },
      {
        id: 'home',
        question: '运行材料居所？',
        options: [
          { name: '正常', desc: '缺省：项目内 .ddo/runs/<type>/<runId>/ 创建 runId 目录，产物与 state 同址随项目版控' },
          { name: '临时', desc: '项目内不创建 runId 目录，运行材料落 <home>/tmp/ddo/<type>/<runId>/，run finish 后直接删除（--ephemeral；适合过程信息无需保留的流程型 run，如 PR 交付链；与 worktree 组合时产物不入分支）' },
        ],
      },
    ],
    hint: '逐问呈现给用户（宿主提问工具），答案依次对应 run start 的 --title / --workflow（或自定义流程）/ --type；居所选「临时」时附加 --ephemeral',
  };
}


// ---------------------------------------------------------------- resume（08：断点重续发现层）

/** run 元数据（列清单用）：优先 state.dirs（11 显式化——临时模式 runDir 在项目外，statePath 结构推导失效；
 *  type 取 runDir 倒数第二段，项目内/临时两种布局同构）。statePath 结构推导仅作 dirs 缺失的历史回落。 */
function runMeta(state, statePath) {
  if (state.dirs && state.dirs.projectRoot && state.dirs.runDir) {
    return { projectRoot: state.dirs.projectRoot, type: path.basename(path.dirname(state.dirs.runDir)) };
  }
  const parts = statePath.split(path.sep);
  if (parts.length < 5 || parts[parts.length - 5] !== '.ddo' || parts[parts.length - 4] !== 'runs') return {};
  return { projectRoot: parts.slice(0, parts.length - 5).join(path.sep), type: parts[parts.length - 3] };
}

/** 惰性加载（02 §7）：statePath 缺失/结构非法 → null（stale）；合法 → state。 */
function tryLoadState(statePath) {
  try {
    if (!fs.existsSync(statePath)) return null;
    const state = readState(statePath);
    assertState(state);
    return state;
  } catch {
    return null;
  }
}

/** 概要位置（列清单用）：相位类型读取失败（任务目录变动）时省略，不阻断发现。 */
function summaryPosition(state, tasksDir, entry) {
  const stage = stageIdOf(entry);
  const phase = phaseOf(entry);
  const gate = state.stages[stage] && state.stages[stage].gate;
  let type;
  try {
    type = phaseType(tasksDir, stage, phase);
  } catch {
    type = null;
  }
  return { stage, phase, ...(type ? { phaseType: type } : {}), ...(gate && !gate.decision ? { gateOpen: true } : {}) };
}

function runResume(f) {
  const index = registry.readAll();
  const proj = f.project ? path.resolve(f.project) : null;

  // 选定加载（D3 第二步）：--run-id → 完整状态视图（与 status 同构）+ run 元数据
  if (f['run-id'] !== undefined) {
    const entry = index[f['run-id']];
    if (!entry) {
      throw new Error(`未知 runId: ${f['run-id']}（运行中: ${Object.keys(index).join(', ') || '无'}）`);
    }
    const state = tryLoadState(entry.statePath);
    if (!state) throw new Error(`run ${f['run-id']} 的 statePath 已失效: ${entry.statePath}`);
    const meta = runMeta(state, entry.statePath);
    return {
      ...statusView(state, entry.statePath, tasksDirFor(f, state)),
      ...(meta.projectRoot ? { projectRoot: meta.projectRoot, type: meta.type } : {}),
      startedAt: state.startedAt,
      statePath: entry.statePath,
    };
  }

  // 发现（D2 全局清单，D3 一律先列）：惰性校验 → 概要清单；currentStage 空 = 待收束仍展示（D4）
  // --project 过滤：statePath 前缀之外，临时模式 run（statePath 在 <home>/tmp 下）经 state.dirs.projectRoot
  // 判定归属——失效条目（state 不可读）无法归属，静默跳过不计 stale
  const runs = [];
  let staleCount = 0;
  for (const [runId, entry] of Object.entries(index)) {
    if (proj && !entry.statePath.startsWith(proj + path.sep)) {
      const st = tryLoadState(entry.statePath);
      if (!st) continue;
      const root = st.dirs && st.dirs.projectRoot;
      if (!root || path.resolve(root) !== proj) continue;
      runs.push(resumeRow(f, runId, entry, st));
      continue;
    }
    const state = tryLoadState(entry.statePath);
    if (!state) {
      staleCount++;
      continue;
    }
    runs.push(resumeRow(f, runId, entry, state));
  }
  return {
    runs,
    staleCount,
    hint: runs.length
      ? '用 resume --run-id <runId> 加载选定 run 的完整状态（含门选项与可执行命令）'
      : '无运行中的 run：新起用 run start；历史见 ~/.ddo/history/runs.jsonl',
  };
}

/** 概要行（列清单用）：元数据 + 标题 + 位置概要 + 待收束提示，全局清单与 --project 过滤共用。 */
function resumeRow(f, runId, entry, state) {
  const meta = runMeta(state, entry.statePath);
  return {
    runId,
    title: state.title,
    ...(meta.projectRoot ? { projectRoot: meta.projectRoot, type: meta.type } : {}),
    startedAt: state.startedAt,
    currentStage: state.currentStage.map((e) => summaryPosition(state, tasksDirFor(f, state), e)),
    ...(state.currentStage.length ? {} : { completable: true, note: '全部相位完成，待收束（run finish --status done）' }),
  };
}

// ---------------------------------------------------------------- list 域（09：发现层数据面）

function listTasks(f) {
  const tasksDir = f['tasks-dir'] ? path.resolve(f['tasks-dir']) : ATOM_TASKS_DIR;
  const tasks = [];
  for (const name of fs.readdirSync(tasksDir).sort()) {
    const cfgFile = path.join(tasksDir, name, 'config.json');
    if (!fs.existsSync(cfgFile)) continue; // _schema 等非任务目录
    const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
    tasks.push({
      name: cfg.name,
      version: cfg.version,
      ...(cfg.desc ? { desc: cfg.desc } : {}),
      phases: (Array.isArray(cfg.phases) ? cfg.phases : [{ id: '01', type: 'action' }]).map((ph) => ({
        id: String(ph.id).padStart(2, '0'),
        ...(ph.summary ? { summary: ph.summary } : {}),
        type: ph.type === 'human' ? 'human' : 'action',
      })),
      ...(Array.isArray(cfg.configurable) && cfg.configurable.length ? { configurable: cfg.configurable } : {}),
    });
  }
  return { tasks };
}

function listWorkflows(f) {
  const workflowsDir = f['workflows-dir'] ? path.resolve(f['workflows-dir']) : WORKFLOWS_DIR;
  const workflows = [];
  if (fs.existsSync(workflowsDir)) {
    for (const file of fs.readdirSync(workflowsDir).sort()) {
      if (!file.endsWith('.json')) continue;
      try {
        const wf = JSON.parse(fs.readFileSync(path.join(workflowsDir, file), 'utf8'));
        workflows.push({
          name: wf.name,
          version: wf.version,
          ...(wf.description ? { description: wf.description } : {}),
          stages: (Array.isArray(wf.stages) ? wf.stages : []).map((s) => s.task),
        });
      } catch {
        // 解析失败的预设不在发现层报错——run start 加载时 fail fast
      }
    }
  }
  return { workflows };
}

// ---------------------------------------------------------------- 命令注册表

const REGISTRY = [
  {
    name: 'list tasks',
    summary: '原子任务注册表：全部任务的 desc/相位概要/可配置项（10 冷启动引导数据面）',
    usage: 'list tasks [--tasks-dir <path>]',
    options: [
      { flag: '--tasks-dir', desc: '原子任务根目录（缺省仓库 atom-tasks/；测试用）' },
    ],
    run: listTasks,
  },
  {
    name: 'list workflows',
    summary: '预设工作流清单：name/version/description/阶段链（10 冷启动引导数据面）',
    usage: 'list workflows [--workflows-dir <path>]',
    options: [
      { flag: '--workflows-dir', desc: '预设根目录（缺省仓库 workflows/；测试用）' },
    ],
    run: listWorkflows,
  },
  {
    name: 'run start',
    summary: '按预设装配启动 run：物化 .state.json + 注册 index（06）；--ephemeral 临时模式材料落 <home>/tmp/ddo',
    usage: 'run start --title <text> [--workflow basic] [--type feat] [--dir-name <name>] [--ephemeral] [--project <path>] [--workflows-dir <path>] [--tasks-dir <path>]',
    options: [
      { flag: '--title', desc: 'run 标题（一句话描述，进 state 与 history）', required: true },
      { flag: '--workflow', desc: 'workflow 预设名（workflows/<name>.json，缺省 basic）' },
      { flag: '--type', desc: 'run 类型（目录第一段，缺省 feat）' },
      { flag: '--dir-name', desc: '运行目录名（目录第二段，缺省 runId；与 --ephemeral 互斥）' },
      { flag: '--ephemeral', desc: '布尔旗标：临时模式——项目内不创建 runId 目录，运行材料（含 .state.json）落 <home>/tmp/ddo/<type>/<runId>/，run finish 后直接删除（蕴含免归档；适合过程信息无需保留的流程型 run）' },
      { flag: '--project', desc: '项目根（缺省 cwd）' },
      { flag: '--workflows-dir', desc: '预设根目录（缺省仓库 workflows/；测试用）' },
      { flag: '--tasks-dir', desc: '原子任务根目录（缺省仓库 atom-tasks/；测试用）' },
    ],
    run: runStart,
  },
  {
    name: 'run finish',
    summary: '结束迁移：runDir 整目录 zip 归档 → history 追加 → index 移除（--no-archive 免归档；临时模式 run 改走删除分支）',
    usage: 'run finish --state <path> --status <done|aborted|failed> [--no-archive]',
    options: [
      { flag: '--state', desc: '.state.json 绝对路径', required: true },
      { flag: '--status', desc: '终态：done（完成）| aborted（用户中止）| failed（失败终止）', required: true },
      { flag: '--no-archive', desc: '布尔旗标：跳过用户级 history 归档（runId 目录 zip 与 runs.jsonl 追加）；index 移除与 currentStage 清空照旧；临时模式（state.ephemeral）蕴含本语义且额外删除 runDir' },
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
      { flag: '--tasks-dir', desc: '原子任务根目录（缺省仓库 atom-tasks/；归档清单与门声明读取用）' },
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
  {
    name: 'next',
    summary: '推进 currentStage：按任务 phases 声明纯状态推进（相位内 / 跨阶段 / DAG 就绪，06）',
    usage: 'next --state <path> [--decision <name>] [--tasks-dir <path>]',
    options: [
      { flag: '--state', desc: '.state.json 绝对路径', required: true },
      { flag: '--decision', desc: '确认门决议（推进型决议名；门开着时必填，非推进型决议走其声明的命令）' },
      { flag: '--tasks-dir', desc: '原子任务根目录（缺省仓库 atom-tasks/；测试用）' },
    ],
    run: runNext,
  },
  {
    name: 'resume',
    summary: '断点重续入口：发现运行中的 run（全局 index，惰性校验）→ 概要清单 → --run-id 加载完整状态（08）',
    usage: 'resume [--run-id <id>] [--project <path>] [--tasks-dir <path>]',
    options: [
      { flag: '--run-id', desc: '选定 runId，输出其完整状态视图（与 status 同构，另含 projectRoot/type/startedAt）' },
      { flag: '--project', desc: '项目根过滤（statePath 前缀匹配 + state.dirs.projectRoot 归属——临时模式 run 的 statePath 在项目外；缺省不过滤，全局清单）' },
      { flag: '--tasks-dir', desc: '原子任务根目录（缺省仓库 atom-tasks/；测试用）' },
    ],
    run: runResume,
  },
  {
    name: 'status',
    summary: '中断恢复定位：当前位置 + 开着的确认门选项 + 派生的可执行命令清单（07）',
    usage: 'status --state <path> [--tasks-dir <path>]',
    options: [
      { flag: '--state', desc: '.state.json 绝对路径', required: true },
      { flag: '--tasks-dir', desc: '原子任务根目录（缺省仓库 atom-tasks/；测试用）' },
    ],
    run: runStatus,
  },
  {
    name: 'gate present',
    summary: '统一交互呈现入口：开门集 payload（静态∪动态选项 + dispatch）+ 盖 presentedAt 留痕（交互协议结构闭环）',
    usage: 'gate present --state <path> [--tasks-dir <path>]',
    options: [
      { flag: '--state', desc: '.state.json 绝对路径', required: true },
      { flag: '--tasks-dir', desc: '原子任务根目录（缺省仓库 atom-tasks/；测试用）' },
    ],
    run: gatePresent,
  },
  {
    name: 'gate interact',
    summary: '相位内交互留痕：记录 in-phase 选项交互（提问/修改/回答BQ），使既有呈现过期——决议前须重新呈现',
    usage: 'gate interact --state <path> --option <name> [--note <text>] [--stage <stageId>] [--tasks-dir <path>]',
    options: [
      { flag: '--state', desc: '.state.json 绝对路径', required: true },
      { flag: '--option', desc: 'in-phase 选项名（payload 中的 name；命令型决议不走本命令）', required: true },
      { flag: '--note', desc: '交互摘要（可选，如提问内容——进 state 供审计）' },
      { flag: '--stage', desc: '目标 stageId（多门并发时必填，缺省要求唯一开门）' },
      { flag: '--tasks-dir', desc: '原子任务根目录（缺省仓库 atom-tasks/；测试用）' },
    ],
    run: gateInteract,
  },
  {
    name: 'guide',
    summary: '冷启动引导唯一数据源：问目标/问模式/问类型/问居所的统一 payload（无 state、无副作用）',
    usage: 'guide [--workflows-dir <path>] [--tasks-dir <path>]',
    options: [
      { flag: '--workflows-dir', desc: '预设根目录（缺省仓库 workflows/；测试用）' },
      { flag: '--tasks-dir', desc: '原子任务根目录（缺省仓库 atom-tasks/；自定义模式时配套 list tasks）' },
    ],
    run: runGuide,
  },
];

const topVerbs = () => REGISTRY.filter((c) => !c.name.includes(' '));
const domains = () => [...new Set(REGISTRY.filter((c) => c.name.includes(' ')).map((c) => c.name.split(' ')[0]))];

// ---------------------------------------------------------------- 参数解析

// 布尔旗标集：bare 形式合法（置 true、不吞下一个 token）；= 形式仅接受 true|false
const BOOLEAN_FLAGS = new Set(['no-archive', 'ephemeral']);

function parseArgv(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok === '--help' || tok === '-h') return { positional, flags, help: true };
    if (tok.startsWith('--')) {
      const eq = tok.indexOf('=');
      if (eq > 0) {
        const key = tok.slice(2, eq);
        const val = tok.slice(eq + 1);
        if (BOOLEAN_FLAGS.has(key)) {
          if (val !== 'true' && val !== 'false') throw new UsageError(`布尔旗标 ${tok} 取值须为 true|false`);
          flags[key] = val === 'true';
        } else {
          flags[key] = val;
        }
      } else if (BOOLEAN_FLAGS.has(tok.slice(2))) {
        flags[tok.slice(2)] = true;
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
