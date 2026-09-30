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
