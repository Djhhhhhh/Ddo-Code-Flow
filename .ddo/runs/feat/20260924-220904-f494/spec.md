# Worktree 创建时机机制补充 Spec

> 本文档用于确认 agent 是否正确理解用户关于「补充 ddo-code-flow worktree 创建时机机制」的需求。

---

## 对齐摘要

- 用户目标：为 ddo-code-flow 补充 worktree 创建时机的机制定义，覆盖「不使用 worktree / 单分支 / 发布分支+开发分支」三种使用情况，并解决创建时机与时序矛盾。
- 期望交付：机制文档补充 + 配套实现调整（预设装配、run start 接入、worktreePath 注册路径等，具体清单由 Planning 决定）。
- 关键边界：不重构已定版的 workdir 判定语义与产物生命周期规则；不修改 .gitignore。
- 当前状态：BQ-1、BQ-2 已按用户答复写回，无未解决 BQ，待用户批准。

---

## 用户目标

- 补全「worktree 创建时机」机制空白：现机制只定义了 `git.worktreePath` 非空时的工作目录判定，未定义 worktree 何时创建、三种使用情况如何走、状态如何落位。
- 解决时序矛盾：worktree 分支名需有实际含义（如 `feature/xxx`，源自需求），而 runDir / `.state.json` 又需落在 worktree 分支内——何时创建 worktree 成为问题（本次 skill 调用即暴露了该问题）。
- worktree 分支创建要求应有 skill 级默认配置，用户定制需求通过现有配置方式接入。
- 模式选择与创建流程需保证用户友好的交互。

---

## 范围与非目标

### In Scope

- 三种使用情况的机制定义与操作路径：① 本次 run 不使用 worktree；② worktree 单分支；③ worktree 发布分支 + 开发分支。
- 创建时机的定义与时序矛盾（分支名源自需求 ↔ state 须落 worktree 分支）的解法。
- worktree 创建要求（模式 / 分支命名 / 基线分支 / 目录落点）的 skill 级默认配置，及通过现有配置方式的用户定制。
- 冷启动引导 / 交互流程中 worktree 模式的选择方式与友好性。
- 配套实现调整：预设链装配、run start 接入、worktreePath 注册路径等（清单由 Planning 决定）。

### Non-goals

- 不改变已定版的 workdir 判定语义、目录布局与产物生命周期规则（仅在其上游接入）。
- 不引入三种场景之外的 git 工作流能力（如自动建 PR、多 worktree 并行管理）。
- 不修改 .gitignore / git exclude（项目既有硬边界）。

---

## 需求对齐

| ID | Agent 对需求的理解 | 来源 | 成功结果 |
|---|---|---|---|
| FR-WTT-1 | 机制定义 worktree 创建时机，并给出「分支名需有实际含义（如 `feature/xxx`，源自需求）而 runDir / `.state.json` 需落在 worktree 分支内」这一时序矛盾的明确解法。 | 用户修订（BQ-2 答案） | AC-1 |
| FR-WTT-2 | 机制说明创建后的接入方式：`git.worktreePath` 注册路径、projectRoot / runDir / 代码工作目录落位、与预设链的衔接。 | 用户原始要求 + 项目事实 | AC-1 |
| FR-WTT-3 | 机制覆盖三种使用情况：① 不使用 worktree；② worktree 单分支；③ worktree 发布分支 + 开发分支。 | 用户修订（BQ-2 答案） | AC-2 |
| FR-WTT-4 | worktree 分支创建要求存在 skill 级默认配置；用户定制通过项目现有配置方式接入，无需改 skill 源码。 | 用户修订（BQ-2 答案） | AC-3 |
| FR-WTT-5 | worktree 模式的选择与创建融入现有冷启动引导 / 确认交互，保持用户友好：默认可静默走、定制可表达、不替用户决定。 | 用户修订（BQ-2 答案） | AC-2 |

---

## 约束与保留术语

- 保留用户术语：`worktree`、`创建时机`、`机制补充`、`git.worktreePath`、`run start`、`单分支`、`发布分支 + 开发分支`、`skill 级配置`。
- 用户明确约束：worktree 模式下 runDir / `.state.json` 必须落在 worktree 分支内；分支名必须有实际含义（`feature/xxx` 风格）。
- 项目事实约束：机制权威载体为 SKILL.md；workdir 判定（worktreePath 非空 → worktree）已定版；当前 `run start` 不捕获 worktreePath（注册归 git-worktree 任务，而 basic / standard 预设链均未包含该阶段）；本次 skill 调用即呈现该时序问题（worktree 在 run start 前凭一句话需求手工创建，分支名先于需求澄清而定）。

---

## 解释与假设

| 类型 | 内容 | 依据或原因 | 若错误的影响 |
|---|---|---|---|
| Interpretation | 「单分支」指 worktree 工作分支为唯一新分支；「发布分支 + 开发分支」指存在作为基线的发布分支与承载开发的工作分支，基线可按配置选择。 | 对用户场景描述的最小等价解释。 | 若用户指其他分支策略（如多 worktree 并行、长生命周期分支），场景矩阵与配置项设计需相应调整。 |
| Interpretation | 「现有配置方式」指项目现行的原子任务 defaults / configurable 配置机制（skill 级 config）。 | 项目现行机制为唯一既存配置通道。 | 若用户指其他配置通道，配置接入点与文档说明位置不同。 |

---

## 对齐变化摘要

| 变更类型 | ID | 修改前 | 修改后 | 依据 |
|---|---|---|---|---|
| 已解决 | BQ-1 | 交付形态待确认 | 文档 + 实现调整 | 用户答复 |
| 已解决 | BQ-2 | 创建时机三选一待确认 | 覆盖三场景 + 时序矛盾解法 + 配置 + 交互（详见 FR-WTT-1/3/4/5） | 用户答复 |
| 修改 | FR-WTT-1 | 定义创建时机（时点、创建者） | 增加「时序矛盾必须有明确解法」义务 | 用户修订 |
| 新增 | FR-WTT-3 / FR-WTT-4 / FR-WTT-5 | — | 三场景覆盖 / skill 级默认配置与定制 / 交互友好 | 用户修订 |
| 新增 | AC-2 / AC-3 / AC-4 | — | 对应新增 FR 的可观察结果 | 用户修订 |
| 已解决 | （原 Assumption：机制对象为本仓库） | 待验证 | 确认为 ddo-code-flow 自身机制 | 用户答复涉及 skill 级配置与本 skill 调用问题 |

---

## 留给 Planning

- **PD-1**：时序矛盾的具体解法与状态迁移实现（如两段式启动、run start 延后物化、冷启动预提取分支名后再建 worktree 等方案选型）。
- **PD-2**：预设链装配方式（git-worktree 阶段是否 / 如何进入 basic 与 standard，或改为启动接入参数）。
- **PD-3**：配置项 schema 与挂载点（沿用原子任务 defaults / configurable 机制的具体字段设计：模式默认值、命名规则、基线分支、目录落点）。
- **PD-4**：worktree 模式缺省值（默认不开启以保持现状，或默认开启强制隔离）。

---

## 成功结果

| ID | 用户可观察的结果 | Validates | 来源 |
|---|---|---|---|
| AC-1 | 按机制文档，读者能无歧义回答「本次 run 用不用 worktree、何时创建、分支名从哪来、state 落在哪、创建后各阶段在哪工作」，且与已定版内容不矛盾。 | FR-WTT-1、FR-WTT-2 | agent 解释（由用户原始要求与修订等价推导） |
| AC-2 | 三种使用情况各有明确操作路径：用户对照场景即知自己该如何启动 run、会走哪条链路。 | FR-WTT-3、FR-WTT-5 | 用户原始要求（场景列表） |
| AC-3 | 不改 skill 源码，仅通过配置即可改变 worktree 创建的默认行为（如命名规则 / 基线分支 / 目录落点）并实际生效。 | FR-WTT-4 | agent 解释 |
| AC-4 | 实现与文档一致：按新机制以 worktree 模式启动 run 时，state 与代码改动实际落在 worktree 分支。 | FR-WTT-1、FR-WTT-2 | agent 解释（由 BQ-1 答案「文档 + 实现调整」推导） |

---

## 用户确认

- ✅ **同意**：批准当前 spec，进入 Planning。
- ❌ **修改：<反馈>**：修改当前 spec，展示变化后重新确认。
- ❓ **提问：<问题>**：仅答疑；如需据此改动，必须随后明确选择 `修改`。
