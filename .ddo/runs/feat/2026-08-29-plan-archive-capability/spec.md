# Plan 归档能力 Spec

> 本文档用于确认 agent 是否正确理解用户关于「plan atom-task 新增归档能力」的需求。（revision 2：已写回 BQ-1 答案）

---

## 对齐摘要

- 用户目标：为 plan atom-task 的既有归档机制补全模版——新增名为 `ddo` 的归档模版，内容为绑定的 GitHub issue #36（《【Feature】plan归档能力补全》）中的「技术方案设计模板」，使【归档：ddo】可用。
- 期望交付：`atom-tasks/plan/references/ddo.md` 模版文件（内容忠实采用 issue #36 模版），经既有归档机制按 `归档：ddo` 选用并生成/刷新 tech-design 归档产物。
- 关键边界：归档机制本身已存在且不改（按名选模版、生成/刷新 tech-design）；归档仅归档（不驱动下游）；归档不代表 Plan 批准；Plan revision 变更后归档即 stale。
- 当前状态：BQ-1 已解决并写回，无未解决阻塞问题，等待用户确认批准。

---

## 用户目标

- 补全 plan atom-task 的归档能力：把 issue #36 的模版「加进去」，让归档参数【归档：ddo】生效。
- 用户明确：「现在是有支持归档参数的，本质这个需求就是把这个模版加进去」。

---

## 范围与非目标

### In Scope

- 在 plan atom-task 归档模版目录（`atom-tasks/plan/references/`）新增模版 `ddo.md`，内容忠实采用 issue #36「技术方案设计模板」。
- 模版与既有归档机制衔接：`归档` 命令可枚举到 ddo 模版；`归档：ddo` 可按名命中并生成/刷新归档产物。
- 与新增模版直接相关的文档同步（如 README/说明中对归档模版清单的既有描述）。

### Non-goals

- 不修改 plan atom-task 既有归档机制的行为逻辑（按名选择、不回写模版、静态检查等保持原样）。
- 不新增 ddo 之外的其他归档模版。
- 不改变 planning 确认门机制与 gate 语义。
- 不在 Plan revision 变更后自动重新归档（仅失效为 stale，刷新仍需用户再次执行 `归档：ddo`）。
- 不改动其他 atom-task、workflow、runtime 的行为。

---

## 需求对齐

| ID | Agent 对需求的理解 | 来源 | 成功结果 |
|---|---|---|---|
| FR-1 | 在 plan atom-task 归档模版目录新增名为 `ddo` 的归档模版文件，使 `归档：ddo` 可被既有机制按名选中。 | 用户原始要求 + 用户修订（BQ-1 答案：复用既有归档参数通道） | AC-1 |
| FR-2 | `ddo` 模版内容忠实采用 issue #36「技术方案设计模板」：章节「一、需求描述」（需求背景与预期效果）与「二、技术方案详情」（2.1 整体架构 / 2.2 技术选型与方案对比 / 2.3 业务详细流程 / 2.4 接口设计 / 2.5 算法设计 / 2.6 数据结构设计 / 2.7 错误码设计）；Mermaid-only；无内容处标注 N/A、不脑补。 | 用户原始要求（绑定 issue #36） | AC-1, AC-5 |
| FR-3 | `归档：ddo` 经既有机制生成/刷新归档产物（tech-design 角色）；该产物仅归档、不作为任何下游阶段输入（`drivesDownstream=false`）。 | 用户原始要求（绑定 issue #36）+ 项目事实（plan.md §5/§6 已规定） | AC-2 |
| FR-4 | Plan revision 变化后既有 ddo 归档立即失效（stale），须由用户再次执行 `归档：ddo` 刷新（`staleWhenPlanRevisionChanges=true`）。 | 用户原始要求（绑定 issue #36）+ 项目事实（plan.md §6 已规定） | AC-3 |
| FR-5 | `归档：ddo` 不是批准动作，不改变 planning 确认门状态。 | 用户原始要求（绑定 issue #36）+ 项目事实（plan.md §6 已规定） | AC-4 |

---

## 约束与保留术语

- 保留用户术语：`【归档：ddo】`、`归档：<模板名>`、`归档`、`stale`、`revision`、`drivesDownstream`、`staleWhenPlanRevisionChanges`、`current parts`。
- 项目事实约束：归档模版统一放在 `atom-tasks/plan/references/`，按名称精确匹配（完整文件名或不含 `.md` 的 basename），不接受目录片段、通配符或目录穿越路径；归档过程不得回写模版文件；归档产物登记为既有 `tech-design` 角色（artifacts.json 已登记）。
- 项目事实约束（v4 职责边界）：业务指令与 options 归 atom-task 层；确认门仅存在于 workflow JSON；新产物角色须先登记 `atom-tasks/artifacts.json`；新 `.state.json` 顶层字段须在 `state.schema.json` 声明唯一 `x-ddo-writer`。
- issue #36 模板约束：按「技术方案」视角收敛；任务拆分、逐行实现细则不在归档文档展开；所有正式图统一 Mermaid，禁止 PlantUML 与 ASCII 架构图。

---

## 解释与假设

| 类型 | 内容 | 依据或原因 | 若错误的影响 |
|---|---|---|---|
| Interpretation | 模版文件名取 `ddo.md`（basename `ddo`），使 `归档：ddo` 按既有精确匹配规则命中。 | 用户给定参数【归档：ddo】；plan.md §6 按 basename/完整文件名精确匹配。 | 若期望其他文件名，命中规则需用户另行指定。 |
| Interpretation | issue #36 正文整体作为模版内容收录（含其头部「整理依据 / 文档边界 / 归档属性」说明），不做内容改写。 | 用户要求「具体模版在 issue 中」「把这个模版加进去」，未授权删改。 | 若期望裁剪头部说明，模版内容需按反馈调整。 |
| Interpretation | 归档内容生成仍按既有机制以「选中模板 + 当前 revision 完整详细 Plan」为主输入；模版中引用 spec/requirement 的章节从本次 run 既有产物取材。 | plan.md §6 现有规定 + issue 模板「整理依据」原文。 | 若期望归档强制读取更多角色，机制说明需扩展（超出本次范围则另立需求）。 |

---

## 对齐变化摘要

| 变更类型 | ID | 修改前 | 修改后 | 依据 |
|---|---|---|---|---|
| 已解决 | BQ-1 | 归档参数输入通道未定（运行参数 vs 运行中短语） | 复用 plan atom-task 既有归档通道：`归档` 枚举模版、`归档：<模板名>` 触发归档 | 用户回答：「现在是有支持归档参数的，本质这个需求就是把这个模版加进去」 |
| 修改 | FR-1 | 泛化的「新增归档能力，参数生效时生成归档文档」 | 收窄为「新增名为 ddo 的归档模版文件，接入既有机制」 | 同上（归档机制已存在，无需新增触发接口） |
| 修改 | FR-3/FR-4/FR-5 | 作为待实现的新行为 | 改为「沿用既有机制（项目事实：plan.md §5/§6 已规定）且不回归」 | plan atom-task 现有指令已实现这些归档属性 |
| 删除 | FR-6（v1） | 独立的 Mermaid 约束 FR | 并入 约束与保留术语 与 FR-2 | 属模版内容约束而非独立义务，避免重复 |
| 删除 | PD-1（v1） | 复用 tech-design 还是新增角色 | 移除：项目事实确认 tech-design 角色已存在且即归档产物角色 | artifacts.json / plan.md §6 既有事实 |
| 修改 | I-1（v1） | `ddo` 为模版类型标识（推测） | 确认 `ddo` 为模版名（文件名），内容即 issue #36 模版 | 用户回答 + plan.md §6 匹配规则 |
| 删除 | A-1（v1） | 归档输出位置假设 | 移除：输出位置已由既有机制确定（run 产物目录 tech-design 角色） | 项目事实 |

---

## 留给 Planning

- **PD-1**：stale 标记与「模板名 + 来源 Plan revision」记录的承载方式（沿用既有 tech-design 产物内的记录约定即可，或需补充）——属实现选择。
- **PD-2**：README/docs 中是否存在需要同步的归档模版清单描述及其更新方式——属实现选择。

---

## 成功结果

| ID | 用户可观察的结果 | Validates | 来源 |
|---|---|---|---|
| AC-1 | 在 plan 阶段输入 `归档` 时，模版列表中出现 `ddo`；输入 `归档：ddo` 后生成/刷新归档产物，其章节按 issue #36 模板组织。 | FR-1, FR-2 | 用户原始要求 |
| AC-2 | `归档：ddo` 产出的归档文档不出现在任何下游阶段（tasking/coding/verification/review/reporting/reflection）的输入中。 | FR-3 | 用户原始要求（绑定 issue #36） |
| AC-3 | Plan revision 变更后既有归档失效（stale）；再次执行 `归档：ddo` 后刷新为新归档。 | FR-4 | 用户原始要求（绑定 issue #36） |
| AC-4 | 执行 `归档` 或 `归档：ddo` 后，planning 确认门状态与批准流程不变。 | FR-5 | 用户原始要求（绑定 issue #36） |
| AC-5 | `ddo.md` 模版文件内容与 issue #36 模版一致（章节、Mermaid-only、N/A 规则、归档属性声明齐全），且未被归档过程回写改动。 | FR-2 | 用户原始要求 + 项目事实（归档不得回写模版） |

---

## 用户确认

请确认以下任一选项：

- ✅ **同意**：批准当前 spec，进入 **Planning**。
- ❌ **修改：<反馈>**：修改当前 spec，展示对齐变化摘要后重新确认。
- ❓ **提问：<问题>**：仅回答问题，不修改 spec、revision、确认状态或修订历史；答复后询问是否需要转为 `修改`。
