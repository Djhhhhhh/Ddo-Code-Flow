# 工作项 09 · coding-worktree — 设计方案

> 版本：**v1.1（2026-09-24 扩围定稿）**——v1.0 仅 coding，按用户修订扩围至全部引用工作目录的任务；**实现完毕（2026-09-24）：六套件全绿（exec 新增 3 例），真实布局 E2E 冒烟通过（coding/plan projectRoot 分支路径推导正确），AC-4 全仓 grep 干净**。
> 需求依据：[spec.md](./spec.md) v2（已确认，FR-WT-1～5 / AC-1～5，无未解决 BQ）
> 契约基线：[../05-atom-tasks/plan.md](../05-atom-tasks/plan.md) §2.1（D12：ctx 钩子按 state 现算）、[../02-index-structure/plan.md](../02-index-structure/plan.md) v1.2（state.git 字段）

## 1. 定位与设计原则

把任务与 worktree 从**强依赖**改为**弱依赖**（条件默认），全任务统一。三条原则：

1. **判定单一事实源**：工作目录只由 `state.git.worktreePath` 判定——非空字符串 → worktree 分支；缺失或空串 → projectRoot 分支。`mainBranch` 不参与判定（basic 链无 worktree 时它也非空）。
2. **现算注入（D12）+ 单一实现**：判定收敛在共享模块 `tools/lib/workdir.js`，四个有钩子任务（coding/plan/verification/reflection）共用并注入 `## Context: 工作目录`；无钩子任务（review）用同规则的条件表述，不另造判定。
3. **分支互斥**：注入的约束与生效分支一一对应，任一分支下不存在不可满足的硬约束（FR-WT-3）。

## 2. 判定规则

| 场景 | state.git 形态 | 判定 | 生效工作目录 |
|---|---|---|---|
| 非 git 项目 | `{ "mainBranch": "" }` | worktreePath 缺失 | projectRoot |
| git 项目 + basic 链（现状） | `{ "mainBranch": "main" }` | worktreePath 缺失 | projectRoot |
| 未来 worktree 登记（后续轮） | `worktreePath` 非空 | worktree 分支 | worktreePath |

要点：`mainBranch` 有无**不参与判定**——否则今天的 basic 链会落入「在 git 目录开发」却无目录可选，回到本次要解的问题。

## 3. 变更清单（v1.1 扩围）

| 文件 | 动作 | 内容 |
|---|---|---|
| `tools/lib/workdir.js` | 新增 | 共享判定 `resolveWorkdir(state, statePath)`：worktreePath 非空 → `{ branch:'worktree', dir, ctx }`；否则 projectRoot（statePath 上溯四级）→ `{ branch:'project-root', dir, ctx }`。ctx 统一标题 `## Context: 工作目录`，分支各自携带互斥约束一句话 |
| `atom-tasks/coding/coding.js` | 扩展 | 注入 workdir ctx（置首）；判定来自共享模块 |
| `atom-tasks/plan/plan.js` | 扩展 | 同上注入（plan §1 在生效目录中做仓库事实检查） |
| `atom-tasks/verification/verification.js` | 扩展 | 同上注入（cmd 执行位置） |
| `atom-tasks/reflection/reflection.js` | 扩展 | 同上注入（扫描位置） |
| `atom-tasks/coding/prompt.md` | 改写 | §约束 L19 改为引用注入结果：「仅在『Context: 工作目录』声明的目录内创建/修改文件，不得操作该目录之外的任何路径」；删除对 state.git.worktreePath 的无条件引用 |
| `atom-tasks/coding/config.json` | 改写 | `defaults.rules[0]` 同步条件化 |
| `atom-tasks/plan/prompt.md` | 改写 | 总约束「所有输出写入 worktreePath 工作树」→「产物写入 run 目录（流水线管理），所描述的实现面向工作目录 ctx 声明的生效目录」；§1「在 worktree 中检查」→「在生效目录中检查」 |
| `atom-tasks/verification/prompt.md` | 改写 | cmd「在 state git.worktreePath 的工作树中执行」→「在『Context: 工作目录』声明的生效目录中执行」；轻量流程「并在工作树执行」同步 |
| `atom-tasks/reflection/prompt.md` | 改写 | 扫描位置改引用工作目录 ctx |
| `atom-tasks/review/prompt.md` | 改写 | 无钩子：复审对象改为「生效工作目录中的代码改动」，括注自判定规则（worktreePath 非空 → worktree，否则 → 当前项目目录） |
| `atom-tasks/test-plan/test-plan.output.schema.json` | 改写 | rules 中「可在 worktreePath 中运行」→「可在生效工作目录中运行（括注判定）」 |
| `atom-tasks/reflection/reflection.output.schema.json` | 改写 | description/example/fieldDocs 中「worktreePath 中的 TODO」→「生效工作目录中的 TODO」 |
| `SKILL.md` / `README.md` | 校对 | grep 全仓 `worktreePath`：cleanup-worktree（条件式，合法）与 git-worktree（生产者）之外不得再有无条件引用；预计零改动 |
| `tools/tests/exec.test.js` | 扩展 | workdir 两分支用例 + 共享判定跨任务一致性用例（见 §4） |

不动：CLI 命令面、state schema、确认门机制、cleanup-worktree / git-worktree（Non-goals）。

## 4. 测试计划（沙箱约定沿用）

| 对象 | 用例 |
|---|---|
| projectRoot 分支 | state.git 无 worktreePath / 空串 / 缺 git 对象 三态：coding exec 输出含「工作目录」ctx 且声明当前项目目录；全文不含「必须落在 git.worktreePath」类硬约束（AC-1） |
| worktree 分支 | fixture state 带 worktreePath（既有夹具形态）：输出声明仅在该路径内改动 + 主工作树禁触（AC-2） |
| 分支互斥 | 任一分支输出不同时含两个目录的约束（AC-3） |
| 共享实现 | verification（或 reflection）exec 输出的工作目录判定与 coding 同源一致（AC-5） |
| 文档一致性 | 全仓 grep：coding/plan/verification/reflection/review/test-plan/reflection-schema 无无条件 worktreePath 约束（AC-4） |
| 回归 | 既有 6 套件全绿 |

## 5. 开放问题

| # | 问题 | 状态 |
|---|---|---|
| O1 | worktreePath 进入 state 的通道（命令写入 / git-worktree 产物登记 / 钩子读 worktree-info.json） | 留 worktree 轮（git-worktree 任务入链时一并定） |
| O2 | coding「在 state 写完成标记」与命令面的矛盾 | 非本轮范围（spec Non-goals），另行立项 |
| O3 | plan/verification 等任务在 worktree 分支下的产物/执行路径实测（待 O1 落地后验证） | 挂 O1 |

## 6. 评审要点

| # | 结论 |
|---|---|
| P1 | 判定字段 = `state.git.worktreePath` 非空（spec Interpretation 落地；mainBranch 不参与判定） |
| P2 | 注入形式 = 共享 `tools/lib/workdir.js` + 各钩子 ctx 段 `## Context: 工作目录`（PD-1/PD-2），prompt 只引用不判定；无钩子任务用同规则条件表述 |
| P3 | 文案改写范围 = coding（prompt+config）、plan（总约束+§1）、verification、reflection、review、test-plan/reflection schema 文案，缺一不可 |

## 变更记录

| 版本 | 日期 | 说明 |
|---|---|---|
| v1.0 | 2026-09-24 | 初版定稿：判定规则表、五文件变更清单、两分支测试计划、P1–P3 评审点 |
| v1.1 | 2026-09-24 | **扩围定稿**（用户修订：所有产物位置统一按 state 配置落地）：新增共享 `tools/lib/workdir.js`；钩子注入扩至 plan/verification/reflection；review 条件表述；test-plan/reflection schema 文案同步；新增 FR-WT-5 / AC-5 与共享实现测试 |
