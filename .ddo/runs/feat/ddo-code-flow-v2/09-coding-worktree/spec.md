# Coding 与 Worktree 弱依赖 Spec

> 本文档用于确认 agent 是否正确理解用户关于「消除与 worktree 的强依赖，改为按 state 现算的条件默认」的需求。
> 状态：**v1 已批准（2026-09-24）→ v2 扩围修订（用户修订 2026-09-24：弱依赖规则从 coding 扩展到全部引用工作目录的任务），扩围即用户指令，视为已确认。**

---

## 对齐摘要

- 用户目标：消除任务指令与 worktree 的强依赖，basic 链（不含 git-worktree 任务）各相位可直接执行。
- 期望交付：所有以 `state.git.worktreePath` 为工作/产物位置依据的任务，统一按 .state.json 现算判定——无 git 配置信息则在当前项目目录，否则在对应 git 目录（worktree）。
- 关键边界：不引入 worktree 创建机制、不改 CLI 命令面与 state schema。
- 当前状态：v2 扩围修订已按用户指令确认，进入实现。

---

## 用户目标

- 消除任务与 worktree 的强依赖：coding、verification、reflection 等任务不再因 `state.git.worktreePath` 缺失而不可执行。
- 保留 worktree 隔离作为可选增强：state 中存在 worktree 信息时，任务仍严格限定在对应 git 目录内工作。
- 全任务统一：同一判定规则、同一实现点，避免各任务各自表述漂移。

---

## 范围与非目标

### In Scope

- coding 任务指令（`prompt.md`）与默认规则（`config.json` defaults.rules）中工作目录硬约束的条件化改写。
- plan / verification / reflection 任务指令中 `state.git.worktreePath` 无条件引用的条件化改写；review 任务指令同规则条件化。
- coding / plan / verification / reflection 四个 ctx 钩子统一注入「Context: 工作目录」（共享判定实现）。
- test-plan / reflection 输出 schema 中以 worktreePath 为前提的规则与描述文案同步。
- 相关文档表述同步（SKILL.md / README.md 如存在强绑定表述）。

### Non-goals

- 不实现 git-worktree 任务入链，不新增 worktree 创建/登记机制（留后续预设轮）。
- cleanup-worktree（本身即条件式，worktreePath 为空时合法跳过）与 git-worktree（worktreePath 生产者）不改。
- 不处理 coding 指令中「在 state 中写完成标记」与命令面的矛盾（相邻问题，另行处理）。
- 不改 CLI 命令集、state schema、确认门机制。

---

## 需求对齐

| ID | Agent 对需求的理解 | 来源 | 成功结果 |
|---|---|---|---|
| FR-WT-1 | 任务执行时若 state 中不存在 git 配置信息（`state.git.worktreePath` 缺失或为空），工作目录为当前项目目录（projectRoot）——编码改动、命令执行、代码扫描、复审均在此进行 | 用户原始要求 | AC-1 |
| FR-WT-2 | 若 `state.git.worktreePath` 存在且非空，工作目录为该 worktree，任务不触碰主工作树 | 用户原始要求 | AC-2 |
| FR-WT-3 | 两个分支互斥：任务收到的指令中不得同时存在指向两个工作目录的约束，且 projectRoot 分支下不存在不可满足的硬约束 | 用户原始要求 | AC-1、AC-3 |
| FR-WT-4 | 生效工作目录由任务 ctx 钩子组装时按 state 现算并显式注入 prompt，agent 无需自行解析 state 判定 | 用户原始要求 | AC-1、AC-2 |
| FR-WT-5 | 判定收敛为共享单一实现，各钩子共用；无钩子任务（如 review）的条件表述与同一规则语义一致 | 用户修订（统一处理） | AC-5 |

---

## 约束与保留术语

- 项目事实约束：v2 的 `state.git` 恒存在且含 `mainBranch`（gitInfo 三档推断链，非 git 环境为空串）。
- 项目事实约束：git-worktree 原子任务当前不在 basic 链，且没有任何命令会把 worktreePath 写入 state。
- 保留用户术语：`弱依赖`、`当前项目目录`、`对应的 git 目录`。

---

## 解释与假设

| 类型 | 内容 | 依据或原因 | 若错误的影响 |
|---|---|---|---|
| Interpretation | 「git 配置信息」的判定字段 = `state.git.worktreePath`（缺失或空串视为不存在），而非 state.git 对象存在与否、或 mainBranch 非空 | state.git 恒存在；mainBranch 在今天的 basic 链（无 worktree）也非空，按其判定会落入「在 git 目录开发」却无目录可选，与消除强依赖的目标矛盾；worktreePath 是唯一自洽判定 | 若用户另有所指（如未来引入其他 git 目录字段），FR-WT-1/2 的判定条件需改写 |
| Interpretation | 「当前项目目录」= run 所属 projectRoot（`.ddo/runs` 所在项目根） | 与 `run start --project` 的语义对齐 | 若指其他位置，AC-1 的观察结果需调整 |
| Interpretation | 「对应的 git 目录」= worktreePath 指向的 worktree（非主工作树） | worktree 隔离机制的既有语义 | 若指主工作树则与隔离目标冲突，需重新讨论 |

---

## 对齐变化摘要

| 变更类型 | ID | 修改前 | 修改后 | 依据 |
|---|---|---|---|---|
| 修改 | FR-WT-1 | coding 阶段在 projectRoot 开发 | 泛化为全部引用工作目录的任务（编码/命令执行/扫描/复审） | 用户修订 2026-09-24 |
| 修改 | FR-WT-2 | coding 仅在 worktree 内开发 | 泛化为全部任务不触碰主工作树 | 用户修订 2026-09-24 |
| 修改 | FR-WT-4 | coding exec 钩子注入 | 各任务 ctx 钩子统一注入 | 用户修订 2026-09-24 |
| 新增 | FR-WT-5 | —（无） | 判定收敛共享单一实现；无钩子任务条件表述同规则 | 用户修订 2026-09-24（「统一处理」） |
| 修改 | AC-1、AC-2 | 观察 coding exec 输出 | 泛化观察各任务 exec 输出 | 随 FR 泛化 |
| 新增 | AC-5 | —（无） | 共享实现一致性可验证 | 随 FR-WT-5 |
| 扩围 | In Scope / Non-goals | 仅 coding 三件套 + 文档 | 扩至 plan/verification/reflection/review 指令与 test-plan/reflection schema 文案 | 用户修订 2026-09-24 |

---

## 留给 Planning

- **PD-1**：生效工作目录 ctx 段的标题与格式（定为 `## Context: 工作目录`）——实现选择。
- **PD-2**：判定逻辑放在共享模块由各钩子复用（D12），不写死在静态 prompt 文本。
- **PD-3**：各任务 prompt / defaults.rules / schema 文案的统一改写方案。

---

## 成功结果

| ID | 用户可观察的结果 | Validates | 来源 |
|---|---|---|---|
| AC-1 | basic 链 E2E（无 worktree 信息）中，coding exec 输出的 prompt 明确声明「本次在当前项目目录开发」，且不含要求操作 worktreePath 的硬约束 | FR-WT-1、FR-WT-3 | 用户原始要求 |
| AC-2 | 构造 `state.git.worktreePath` 非空的 fixture 后，coding exec 输出的 prompt 明确声明仅在对应 worktree 内改动 | FR-WT-2、FR-WT-4 | 用户原始要求 |
| AC-3 | 对任务 exec 输出做全文检查：工作目录相关约束全部为条件式或与生效分支一致，无自相矛盾条目 | FR-WT-3 | agent 解释 |
| AC-4 | SKILL.md / README.md / 各任务文件中不再存在无条件引用 `state.git.worktreePath` 的硬约束表述（cleanup-worktree 的合法条件引用除外） | FR-WT-3 | agent 解释 |
| AC-5 | worktree 判定只有一处实现：plan/verification/reflection 钩子注入的「工作目录」与 coding 同源，分支结论一致 | FR-WT-5 | 用户修订 |

---

## 用户确认

若不存在未解决 BQ，请确认以下任一选项：

- ✅ **同意**：批准当前 spec，进入 **Planning**。
- ❌ **修改：<反馈>**：修改当前 spec，展示对齐变化摘要后重新确认。
- ❓ **提问：<问题>**：仅回答问题，不修改 spec、revision、确认状态或修订历史；答复后询问是否需要转为 `修改`。
