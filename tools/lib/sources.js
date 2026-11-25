'use strict';
// 用户本地注册源合并解析（run 20261125-221045-c6ec plan FC-1 / DEC-1~DEC-7）。
//
// 语义（对齐 spec FR-1~FR-6）：
// - 加性合并：内置源 + ddoHome() 下用户注册源（workflows / atom-tasks，尊重 DDO_HOME）；
// - 同名冲突 fail-fast：预设与任务均按名拦截（builtin vs user），不静默遮蔽任何一方；
// - 等价性：用户源目录不存在/为空时，解析结果与现状逐字段一致（AC-5）；
// - 合并激活条件（DEC-2）：预设——未显式传 --workflows-dir（explicit 即密闭单源通道）；
//   任务——解析主目录为内置缺省目录（--tasks-dir 定制通道不合并）。
// - profiles 目录完全不感知（spec BQ-1 决议，DEC-7）。
//
// 依赖方向：本模块不静态依赖 workflow.js（loadWorkflow 在函数内惰性 require），
// workflow.js / assemble.js / subflow.js / cli.js 静态依赖本模块——避免 require 环。

const fs = require('fs');
const path = require('path');
const { ddoHome } = require('./index-registry');

const BUILTIN_WORKFLOWS_DIR = path.join(__dirname, '..', '..', 'workflows');
const BUILTIN_TASKS_DIR = path.join(__dirname, '..', '..', 'atom-tasks');

/** 用户本地注册目录（每次现算，尊重 DDO_HOME 变更；不缓存）。 */
function userWorkflowsDir() {
  return path.join(ddoHome(), 'workflows');
}

function userTasksDir() {
  return path.join(ddoHome(), 'atom-tasks');
}

/** 任务在某目录下可解析的最小条件：存在 config.json。 */
function hasTask(dir, task) {
  try {
    return fs.statSync(path.join(dir, task, 'config.json')).isFile();
  } catch {
    return false;
  }
}

/**
 * 任务名称级解析（DEC-1/DEC-2/DEC-3）：primary 命中即返；primary 为内置缺省目录时
 * 追加查用户源（fallback）；双源同名 → 抛错（任何调用时点都不静默遮蔽）。
 * 返回任务物理目录绝对路径；两处均无 → null（调用方按既有「任务不存在」语义报错）。
 */
function findTaskDir(primary, task) {
  const primaryDir = path.resolve(primary);
  const inPrimary = hasTask(primaryDir, task);
  if (primaryDir !== BUILTIN_TASKS_DIR) return inPrimary ? path.join(primaryDir, task) : null; // DEC-2：定制通道不合并
  const userDir = userTasksDir();
  const inUser = hasTask(userDir, task);
  if (inPrimary && inUser) {
    throw new Error(
      `原子任务同名冲突: ${task}（builtin: ${path.join(primaryDir, task)}；user: ${path.join(userDir, task)}）——重命名或删除其一，内置任务不被遮蔽`
    );
  }
  if (inPrimary) return path.join(primaryDir, task);
  if (inUser) return path.join(userDir, task);
  return null;
}

/** 读取任务 config.json（经 findTaskDir 解析）。任务不可解析 → 抛「原子任务不存在」。 */
function readTaskConfig(primary, task) {
  const dir = findTaskDir(primary, task);
  if (!dir) {
    const extra = path.resolve(primary) === BUILTIN_TASKS_DIR ? ` 与 ${userTasksDir()}` : '';
    throw new Error(`原子任务不存在: ${task}（查找: ${path.resolve(primary)}${extra}）`);
  }
  return JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
}

/**
 * 预设合并加载（DEC-1/DEC-2）：explicitDir → 现状单源语义直接委托 loadWorkflow；
 * 缺省 → 候选 [内置, 用户源]；唯一命中 → 复用 loadWorkflow 校验；
 * 双源同名 → 冲突 fail-fast；零命中 → 报错并列两源现有预设并集。
 */
function loadWorkflowMerged(explicitDir, name) {
  const { loadWorkflow } = require('./workflow'); // 惰性 require：避免与 workflow.js 的静态依赖成环
  if (explicitDir) return loadWorkflow(explicitDir, name); // DEC-2：显式通道 = 密闭单源
  const builtinFile = path.join(BUILTIN_WORKFLOWS_DIR, `${name}.json`);
  const userFile = path.join(userWorkflowsDir(), `${name}.json`);
  const inBuiltin = fs.existsSync(builtinFile);
  const inUser = fs.existsSync(userFile);
  if (inBuiltin && inUser) {
    throw new Error(
      `workflow 预设同名冲突: ${name}（builtin: ${builtinFile}；user: ${userFile}）——重命名或删除其一，内置预设不被遮蔽`
    );
  }
  if (inBuiltin) return loadWorkflow(BUILTIN_WORKFLOWS_DIR, name);
  if (inUser) return loadWorkflow(userWorkflowsDir(), name);
  const existing = [...new Set(
    [BUILTIN_WORKFLOWS_DIR, userWorkflowsDir()].flatMap((dir) => {
      try {
        return fs.readdirSync(dir).filter((x) => x.endsWith('.json')).map((x) => x.slice(0, -5));
      } catch {
        return [];
      }
    }),
  )].join(', ');
  throw new Error(
    `workflow 预设不存在: ${name}（查找: ${BUILTIN_WORKFLOWS_DIR} 与 ${userWorkflowsDir()}` +
    `${existing ? `（现有: ${existing}——完整清单用 list workflows）` : '（预设目录为空）'}）`
  );
}

/** 源清单（listWorkflows 合并扫描用）：explicit 单源；缺省 builtin + user。 */
function workflowSources(explicitDir) {
  if (explicitDir) return [{ kind: 'explicit', dir: explicitDir }];
  return [
    { kind: 'builtin', dir: BUILTIN_WORKFLOWS_DIR },
    { kind: 'user', dir: userWorkflowsDir() },
  ];
}

module.exports = {
  BUILTIN_WORKFLOWS_DIR,
  BUILTIN_TASKS_DIR,
  userWorkflowsDir,
  userTasksDir,
  findTaskDir,
  readTaskConfig,
  loadWorkflowMerged,
  workflowSources,
};
