# Ddo-Code-Flow 架构：引导执行层与引擎层

> 本文档是两层结构定义与解耦契约的权威来源（spec FR-4 / plan DEC-6）。
> 现有目录结构即两层落位——本定义不新增物理拆分，只固化边界。

## 为什么分两层

一次流程执行中有两类性质完全不同的工作：

- **决定做什么、问什么、呈现什么**——与宿主（Claude Code 等代理会话）和用户意图强相关，随任务演进而频繁变化；
- **如何确定地执行与约束**——状态推进、位置校验、人工门拦截、产物校验、生命周期收口，必须稳定、可测试、不依赖对话上下文。

把前者收敛为**引导执行层**（物料与协议），后者收敛为**引擎层**（确定性内核），两层只经契约交互，即可各自演进而不互相侵蚀。

## 引导执行层（Guidance Layer）

**组成**：`SKILL.md`、`atom-tasks/*`、`workflows/*.json`。

**职责**：

- 宿主适配与调用契约：何时激活、启动分流（恢复/新建）、启动问询流程（`guide`）；
- 执行循环协议：exec → validate → next / gate present → 用户决议的节律，含子流程下沉协议（本文档 §子流程）；
- 原子任务物料（原子任务接入能力）：每个任务的 `prompt.md`（指令）、`config.json`（相位/旋钮/产出声明）、可选 `<task>.js`（present/assemble 钩子）与 `<task>.output.schema.json`（产出契约）；
- 编排预设：`workflows/<name>.json` 定义任务链（DAG）。

**边界（不得越出）**：不实现状态机、不读写 `.state.json` 语义（只经 CLI 观察与驱动）、不自带推进/拦截逻辑；对引擎的全部知识来自 CLI 命令面与本文档契约。

## 引擎层（Engine Layer）

**组成**：`tools/cli.js` + `tools/lib/*`。

**职责**：

- 状态机与唯一事实源：`.state.json` 读写、结构断言（`lib/state.js`）；
- 编排推进：预设加载与 DAG 校验（`lib/workflow.js`）、相位/跨阶段推进（`next`）、回滚（`rollback`）；
- 人工门与交互留痕：开门集派生、呈现留痕、决议拦截（`lib/gate.js`、`gate present/interact`）；
- 产物规范化校验（`validate` + `lib/output-schema.js`）；
- 生命周期：run start / run finish（归档与历史）、resume、status、index 注册（`lib/index-registry.js`、`lib/history.js`）;
- 子流程编排：运行期创建、阻塞判定、三层上限、显式收口（`lib/subflow.js`、`subflow` 域命令）。

**边界（不得越出）**：不读 `SKILL.md`、不含宿主对话逻辑、不猜测用户意图（一切用户决议必须经确认门留痕）；对物料的唯一知识是下述契约——引擎不解析任务 prompt 内容。

## 解耦契约（两层唯一接口）

| 契约 | 方向 | 内容 |
|---|---|---|
| 任务目录契约 | 引导层 → 引擎层 | `atom-tasks/<name>/` 含 `prompt.md` + `config.json`（`_schema/task-config.schema.json` 校验）；可选 `<task>.js` 钩子与 `<task>.output.schema.json`。引擎按 `--tasks-dir` > `state.dirs.tasksDir` > 内置缺省定位 |
| 预设契约 | 引导层 → 引擎层 | `workflows/<name>.json`：stages[]（task/dependOn/when）+ startup 声明；加载即校验（无环、引用存在） |
| CLI 四通道 | 引擎层 → 引导层 | stdout=JSON（唯一数据面）/ stderr=人话提示 / exit 0·1·2 / state 文件现读不缓存。命令注册表即文档源（`--help`） |

**判定规则**：新能力若改变「做什么/问什么/呈现什么」→ 引导层（任务物料或 SKILL.md 协议）；若改变「如何执行与约束」→ 引擎层（lib + 命令）。两侧同时需要时，先定契约再动两侧。

## 子流程编排的归属

- **引擎层提供机制**：`subflow start/list/close` 命令、嵌套子 state（`<runDir>/subflows/sf-n/`）、阻塞式拦截（active 子流程存在时父 `next`/`run finish` exit 1）、三层总深度上限（创建点校验）、`--abandon` 放弃留痕。子 state 是普通 state——exec/validate/next/gate 对其零差别复用。
- **引导层提供协议**：SKILL.md 执行循环定义何时下沉（任务执行中发现需要补充调研等子目标时）、如何驱动子流程循环、如何收口回到父流程。

## 版本与演进

- 本文档随架构变更同步修订（引擎行为或契约变化必须反映到 §解耦契约）；
- 两层各自的演进以契约为界：引擎新增命令/字段不破坏引导层（可选段、零迁移）；引导层新增任务/预设不需要引擎改动。
