# coding

> 按任务清单（或 plan 实施步骤）执行真实代码改动。产物是代码变更本身，不是文档。

---

> ⚠ 交互硬约束：本次执行包含必须完成的交互，未完成前禁止调用任何推进命令（next/rollback/run finish 等）。与用户交互必须使用宿主提问工具（如 AskUserQuestion）执行，不得以自由文本代替。

## 完成确认门

<!-- @interact:required tool=ask-user -->
必须调用宿主提问工具向用户请求确认，未获得明确回复前不得调用任何推进命令。
<!-- /interact -->

coding 的代码改动完成、进入工作流后续阶段（reporting / verification 等）之前，必须经用户确认——不得静默推进。

**门选项从统一呈现入口获取**：跑 `node tools/cli.js gate present --state <statePath>` 取交互 payload（本门全部选项的 name/desc/dispatch），把各选项原样呈现给用户（宿主提问工具），不得在 payload 之外自造选项。用户选择后按 dispatch 处理：
- 命令型（`next --decision 同意`）→ agent 代跑 dispatch 命令，放行后续阶段；
- 相位内交互（`in-phase`）→ 先 `gate interact --state <statePath> --option <name> [--note <摘要>]` 记录交互，再按下方行为定义处理；处理完成后**重新 `gate present` 送审**——未重新呈现前的决议会被结构拦截（重新询问由结构强制，不靠自觉）。

相位内交互行为定义：

- `同意`：确认 coding 产物完成，本相位完成并放行后续阶段；
- `提问：<问题>`：对实现内容答疑（只读说明，不动代码）；
- `修改：<反馈>`：按反馈调整**相位 01 的代码变更本身**（无产物归档动作——`_del` 机制属 rollback，不属门内修改），完成后重新送审。

---

## Context: 工作目录

- 生效工作目录：/Users/djhhh/work_area/Ddo-Code-Flow-fix-issue-69-skill-protocol
- 本次仅在上述工作树内创建/修改文件与执行命令，不得触碰主工作树或其他路径。

## Context: Alignment Spec

# Issue 69 Alignment Spec

## 对齐摘要

- 用户目标：修复 issue #69「SKILL.md 质量优化」。
- 期望交付：以 issue 的两份完整目标稿为依据，更新 SKILL.md 与 README.md，入口协议与使用说明一致。
- 关键变化：仅显式调用、按有无描述分流、完整当前位置统一执行与审核、交付收尾专用协议。
- 边界：本次对齐文档契约，不扩展 CLI 能力，不宣称文档能够独自保证跨宿主行为。
- 当前状态：待用户确认，无阻塞问题。

## 用户目标

- 让代理执行入口清楚说明何时启动、如何启动、如何推进和收口，减少自由推断导致的偏离。
- 让使用者和维护者说明与代理入口保持一致，以 issue 中给出的目标内容为依据。

## 范围与非目标

### In Scope

- 对齐 SKILL.md 与 README.md 的完整目标内容，包括调用、启动、执行、审核、恢复、路径与生命周期。
- 核对说明能否由现有 CLI 和任务协议承接；发现不一致时明确报告，不伪造支持。
- 保留用户指定的正常运行材料，代码改动在独立 worktree 中进行。

### Non-goals

- 不新增多门独立决议、自动校验推进、用户级预设或其他路线图能力。
- 不修改已安装 skill 副本，不将文档变更当作已部署到宿主。
- 不擅自提升版本号或扩大为 CLI 运行时重构。

## 需求对齐

| ID | Agent 对需求的理解 | 来源 | 成功结果 |
|---|---|---|---|
| FR-1 | 仅显式调用 skill 或显式引用入口执行才启动；显式调用后不按任务复杂度豁免；审阅文件不等于调用。 | 用户原始要求：issue 两份目标稿 | AC-1 |
| FR-2 | 带描述调用新建并保留原始输入，不询问恢复或重复目标，只询问其余配置。 | 用户原始要求：目标稿启动分流 | AC-2 |
| FR-3 | 无描述调用先选恢复或新建，不因运行数量自动选择；无可恢复运行时等待决定。 | 用户原始要求：目标稿启动分流 | AC-3 |
| FR-4 | 执行与直接加载任务使用明确路径及有效任务目录，worktree 在启动前创建。 | 用户原始要求：目标稿执行位置和前置动作 | AC-4 |
| FR-5 | 每轮处理完整 currentStage，所有普通位置完整 exec、执行和校验后才统一推进，人工审核也先 exec。 | 用户原始要求：目标稿执行循环 | AC-5 |
| FR-6 | 审核依据 gate payload 与用户明确决议；交互留痕并重新呈现，多门统一决议不得偷换为单门授权。 | 用户原始要求：目标稿人工审核步骤 | AC-6 |
| FR-7 | closeout-worktree 作为唯一当前位置执行专属收尾，外层不得重复 validate、next、finish 或 cleanup。 | 用户原始要求：目标稿交付链专用收尾 | AC-7 |
| FR-8 | 清楚区分正常、免归档、临时模式的保存、回滚与结束规则，以及 run finish 与代码、worktree 清理的边界。 | 用户原始要求：目标稿产物生命周期及结束异常 | AC-8 |
| FR-9 | README 面向使用者与维护者，与入口协议保持一致，并区分现有能力、验证限制及后续方向。 | 用户原始要求：issue 第二份目标稿 | AC-9 |

## 约束与保留术语

- 保留术语：run、currentStage、exec、validate、next、gate present、gate interact、run finish、skillRoot、runDir、DDO_HOME。
- 用户已选：single worktree、basic、fix、正常材料居所。
- SKILL.md 只承载最终执行协议，不添加开发历史、轮次或 PR 叙述。

## 解释与假设

| 类型 | 内容 | 依据或原因 | 若错误的影响 |
|---|---|---|---|
| Interpretation | 两个评论是本次两份文档的目标稿，按完整语义落实，而不只修改标题所提及的 SKILL.md。 | issue 正文为空，评论分别完整给出入口和 README。 | 若仅需其中一份，用户可在本次审核收窄范围。 |
| Interpretation | 本次解决文档与代理执行契约，不修改 guide 等 CLI 行为。 | 目标稿明确让入口分流优先于现有 startupCheck.hint，并明确现有 CLI 限制。 | 如需结构性强制新语义，应作为额外范围确认。 |

## 成功结果

| ID | 用户可观察的结果 | Validates | 来源 |
|---|---|---|---|
| AC-1 | 两份文档不再指示关键词自动激活，也不再豁免显式调用的小任务；文件审阅不启动。 | FR-1 | agent 解释：目标稿等价核对 |
| AC-2 | 带描述示例与规则均从既有目标进入其余配置，新建意图不被旧 run 改变。 | FR-2 | agent 解释：目标稿等价核对 |
| AC-3 | 无描述示例与规则都先询问恢复或新建，零或单个旧 run 均不授权自动选择。 | FR-3 | agent 解释：目标稿等价核对 |
| AC-4 | 文档明确绝对 CLI 入口、任务目录优先级和启动前 worktree 创建，恢复不错误回落默认目录。 | FR-4 | agent 解释：目标稿等价核对 |
| AC-5 | 文档明确完整位置清单、完整指令消费、逐项校验、统一推进，空清单转收口。 | FR-5 | agent 解释：目标稿等价核对 |
| AC-6 | 文档明确重新呈现与明确批准、多门同决议限制及不同决议时暂停，不虚构独立推进命令。 | FR-6 | agent 解释：目标稿等价核对 |
| AC-7 | 专用收尾的唯一位置前提、正常免归档/临时命令及外层不重复执行均有明确说明。 | FR-7 | agent 解释：目标稿等价核对 |
| AC-8 | 三种材料处理方式、临时材料提前保存、失败与中止收口、worktree 独立清理边界一致且无误导承诺。 | FR-8 | agent 解释：目标稿等价核对 |
| AC-9 | README 的安装、示例、命令、扩展与验证说明均与入口一致；CLI 测试不冒充独立会话或跨宿主验证。 | FR-9 | agent 解释：目标稿等价核对 |

## 用户确认

当前无阻塞问题，等待用户决议。

- ✅ **同意**：批准当前 spec，进入 Planning。
- ❌ **修改：<反馈>**：修改当前 spec，展示变化后重新确认。
- ❓ **提问：<问题>**：仅答疑；如需据此改动，必须随后明确选择 `修改`。

## Context: Plan

# Issue 69 文档协议修复 Plan

## 执行摘要

revision: 1；文档模式：single。以 issue #69 评论中的完整目标稿替换 SKILL.md 和 README.md，核对与现有 CLI/原子任务的承接关系。仅修改两份产品文档，运行材料另保存在本 runDir。保留版本 2.0.3；不修改 CLI、任务、预设、安装副本或忽略规则。

## 范围与非目标

| 事项 | 说明 | AI 索引 |
|---|---|---|
| 文档范围 | 显式调用、启动分流、执行/审核循环、恢复、任务路径及产物生命周期；README 配套示例和限制。 | FR-1—FR-9 |
| 非目标 | 不新增运行时能力、测试框架、独立多门决议或版本发布；不把本会话当作新入口独立会话验证。 | DEC-1 |

## 现有设计与复用基线

| 能力 | 文件路径 | 符号 | 证据类型 | 采用方式 | 适用边界 | AI 索引 |
|---|---|---|---|---|---|---|
| 现有入口和用户文档 | SKILL.md；README.md | 何时使用；快速开始；驱动一个 run | Repository Fact | 扩展现有实现 | 当前存在自动触发、小任务豁免和恢复优先说明，由目标稿统一替换。 | FR-1—FR-3 |
| 启动数据源 | tools/cli.js | runGuide | Repository Fact | 复用现有实现 | 保留 questions/followUp；startupCheck.hint 不改变入口分支。 | FR-2、FR-3 |
| 有效任务目录 | tools/cli.js | tasksDirFor | Repository Fact | 复用现有实现 | flag 优先于 state.dirs.tasksDir 再回落内置目录。 | FR-4 |
| 全位置统一推进 | tools/cli.js | runNext | Repository Fact | 复用现有实现 | 遍历 currentStage，无自动 validate；同一 decision 校验全部门。 | FR-5、FR-6 |
| 呈现与交互 | tools/cli.js | gatePresent；gateInteract | Repository Fact | 复用现有实现 | 多门交互必须指定 stage；交互后需重新呈现。 | FR-6 |
| 生命周期 | tools/cli.js | runFinish | Repository Fact | 复用现有实现 | 正常归档保留原目录，no-archive 免历史，ephemeral 删除材料。 | FR-8 |
| worktree 前置与收尾 | atom-tasks/git-worktree/prompt.md；atom-tasks/closeout-worktree/prompt.md；atom-tasks/cleanup-worktree/prompt.md | 执行步骤；指令 | Repository Fact | 复用现有实现 | 创建先于 start；专用收尾自行推进和 finish；清理不得丢弃未提交工作。 | FR-4、FR-7 |
| 预设 | workflows/basic.json；workflows/standard.json；workflows/pr-delivery.json；workflows/pr-delivery-issue.json | stages | Repository Fact | 复用现有实现 | 四条现有预设不改编排。 | FR-9 |

## 整体架构与流程

维持 CLI 提供状态与指令、代理执行、用户决议的分工。更新入口层选择规则与完整位置的驱动约束，不新增状态转移实现。

- 显式带描述调用：保留输入 → guide → 其余配置 → 按需前置动作 → start。
- 显式无描述调用：用户先选恢复/新建 → 所选分支；零/单个运行不自动改变用户选择。
- 普通执行：完整 currentStage → 各位置 exec → 所有普通位置执行和校验 → 审核或统一 next → 重新读状态。
- 专用收尾：仅 closeout-worktree 为唯一位置时按其 exec 执行，外层不重复收尾。

以上为文档流程说明，不引入新的运行时状态机或正式图。

## 技术选型与方案对比

| 方案 | 来源 | 仓库适配性 | 代价与风险 | 状态 | 结论 | AI 索引 |
|---|---|---|---|---|---|---|
| 按目标稿完整更新两份文档 | 初始 Plan | CLI 已支持所述命令和限制；目标稿显式处理 guide 提示冲突。 | 需要核对目标稿与实现，不可将文字规则描述成结构强制。 | accepted | 最小满足已批准范围，不改运行时。 | DEC-1、FR-1—FR-9 |

DEC-1：采用 issue 两份目标稿，保留内容语义及版本号，只规范文件结尾换行。不自行增补历史说明或扩写能力。依据为已批准 spec 和上述仓库事实。权衡：入口分流仍由代理遵循，CLI hint 暂不变；这是目标稿明确的边界。发现实质冲突时暂停报告，不静默扩展范围。

## 数据模型设计

### 实体与字段

不适用：无数据模型改动。currentStage、dirs、atomTasks、git 和 ephemeral 均沿用现有 state。

### schema 与 DDL（如适用）

不适用：不涉及 schema 或数据库。

### 状态与不变量

.state.json 仍是唯一执行事实源；所有推进通过 CLI；文档不承诺未实现的独立多门推进。

### 迁移、兼容与回滚

无需数据迁移。文档可通过版本控制恢复；不修改已有 run 状态结构。

## API 接口设计

| 接口/入口 | 请求 | 响应 | 错误与幂等 | 复用标准 | 实现职责 | AI 索引 |
|---|---|---|---|---|---|---|
| 显式 skill 调用 | 附带或不附带任务描述 | 新建配置问询或恢复/新建选择 | 创建失败不启动；无可恢复运行则等待用户 | guide/resume/start | 仅更新代理入口协议 | FR-1—FR-4 |
| CLI 命令 | 现有 flags 与 statePath | JSON 或 exec 文本 | 保留 0/1/2 退出码与现有错误语义 | tools/cli.js | 不改命令接口 | FR-5—FR-8 |

## 算法设计

不适用：本次只更新文档，不新增算法或运行时状态机；统一推进与审核规则引用现有 runNext 实现。

## 文件变更计划

| 文件/目录 | 变更职责 | 复用或依赖 | AI 索引 |
|---|---|---|---|
| SKILL.md | 替换为 issue 第一份目标稿，作为纯最终执行协议，保留 metadata.version=2.0.3。 | tools/cli.js 及前置/收尾任务 | FR-1—FR-8 |
| README.md | 替换为第二份目标稿，同步说明、示例、命令边界和验证限制。 | SKILL.md、四条预设与测试入口 | FR-9 |
| 本 runDir | 保存需求原文、已审核规格、计划和后续任务要求的报告。 | basic 工作流的 Output Contract | DEC-1 |

## 兼容、稳定性与回滚

| 关注点 | 适用性 | 设计/理由 | 回滚信号 | AI 索引 |
|---|---|---|---|---|
| CLI 与已有运行 | 适用 | 不改脚本、预设、state schema；保持可恢复性。 | 目标稿与已读命令不一致时报告 | FR-4—FR-8 |
| guide 提示 | 适用 | 目标稿明确调用契约优先，不机械执行旧的恢复优先 hint。 | 新入口仍被该 hint 带偏需另行评估 | FR-2、FR-3 |
| 安装与宿主 | 适用 | 修改仓库文档不等于同步安装副本；独立会话和跨宿主验证单列。 | 宿主加载或调用参数差异 | FR-9 |
| 性能/迁移 | 不适用 | 文档变更，无可执行实现调整。 | 无对应运行时变更 | DEC-1 |

## Verification Anchor

| 需验证契约 | 可观察结果 | 证据位置 | AI 索引 |
|---|---|---|---|
| 目标内容完整性 | 两份文件与对应 issue 目标稿一致；frontmatter 版本不变；无旧协议残留指令。 | issue 原文、git diff | AC-1—AC-9 |
| 命令承接与回归 | 既有 node --test tools/tests/*.test.js 结果记录，失败如实处理。 | tools/tests、coding/reporting 产物 | AC-4—AC-8 |
| 文档结构与链接 | diff --check 通过；相对链接目标存在，代码围栏闭合。 | SKILL.md、README.md | AC-9 |
| 验证边界 | 报告明确静态核对与 CLI 回归不等于新入口独立会话/跨宿主验证。 | 报告 | AC-1—AC-9 |

## 开放问题与 Spec 对应

| 问题 | 确定答案或阻塞原因 | 解决位置 | AI 索引 |
|---|---|---|---|
| 是否同步修改 CLI 的 guide 分流 | 不改；按已批准 spec 在入口明确忽略冲突 hint。 | DEC-1 | FR-2、FR-3 |
| 是否新增独立多门审核能力 | 不新增；记录现有限制和暂停规则。 | 执行循环/审核说明 | FR-6 |

## 风险与下游交接

Coding 读取本 single Plan、已批准 spec 和已固化 issue 原文；两份目标稿均完整落实，不只替换启动段落。文件当前内容在修改前已读。若 issue 出现实质修订或实现证据失效，暂停报告并重新确认，不自行更改已批准契约。

不编写测试框架或 Plan 专属校验脚本；使用一次内联结构检查与已有 CLI 测试入口。用户未授权提交、推送或合并时，不把 basic 的确认自动解释为这些操作授权。

## 用户确认

- **同意**：批准当前 revision，进入 Coding。
- **修改：<反馈>**：更新 revision 并重新送审。
- **提问：<问题>**：只答疑，不改文档与确认状态。
- **归档**：列出可用模板，不代表批准。
- **归档：<模板名>**：按指定模板生成归档，不代表批准。

---

## Rules

- 所有代码改动必须落在「Context: 工作目录」声明的生效目录内（由 state 现算：git.worktreePath 非空为 worktree，否则为当前项目目录）
- 不得为通过检查而注释/删除既有测试，除非任务本身要求
