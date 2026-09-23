# verify/v2-beta — v2-beta 版本 dogfooding 验证方法（playbook）

## 0. 版本锚定（不可丢失——丢了版本归属，本文件即无意义）

| 项 | 值 |
|---|---|
| **验证目标版本** | **v2-beta**：SKILL `version: 2.0.0`，范围 = 工作项 00–12 全量 + 内审修复 D-1～D-4 + SKILL exec 硬约束（A-1/A-2 处置） |
| playbook 版本 | v1.0（2026-09-24，随 v2-beta 首次 dogfooding 定稿） |
| 关联归档 | [../showcases/v2-beta/](../showcases/v2-beta/)（首跑结果：timeline / ASSESSMENT / artifacts / state-archive） |
| 测试基线 | `node --test tools/tests/*.test.js` = **82 用例全绿** |
| 维护约定 | **冻结**：本文件不随版本演进修改（只允许修笔误）；大迭代时由**用户提示**新建 `verify/<新版本>.md`；新增 dogfooding 流程类型（worktree 场景 / 并行多门 / history 可视化等）同样由用户发起 |
| 失效判据 | skill 行为超出上述范围（新命令 / state 新字段 / 门语义变化）→ 本 playbook 过期，以新 playbook 为准 |

## 1. 本版本重点注意（验证什么、为什么）

v2 的差异化主张是「流程长在结构里」——按结构保证强度排序，**F3/F6/F7/F5 是内审挖过坑的必复验项**：

| # | 重点 | 为什么 | 来源 |
|---|---|---|---|
| F1 | 确认门拦截与决议留痕 | 核心卖点：门未关 `next` 被结构性拦下；decision/closedAt 可审计 | v2 主线 |
| F2 | BQ 相位内写回 | spec 门先澄清（回答写回 + 对齐变化摘要）再批准；未解决 BQ 时不得提供「同意」 | 05/07 |
| F3 | 产物契约校验 + 修正循环 | 「做完了」由校验器判定；**D-1 占位符缺陷必须复验**（真实组名要能过 validate） | 内审 D-1（阻断级） |
| F4 | 执行节律位置锁 | exec/validate 只服务当前位置；抢跑必拦 exit 1 | 07 |
| F5 | **exec 硬约束：当次组装当次消费** | 内审 A-1/A-2：中断重开后 agent 凭记忆跳过 exec——本版本新增 SKILL 协议，**下轮重点复验** | 内审 A-1/A-2 |
| F6 | 时间戳本地时区 + runId 日期一致 | 内审 D-3：UTC 导致 runId「0924」与 startedAt「09-23T17:xxZ」日期错位 | 内审 D-3 |
| F7 | history `statePath` 绝对路径 | 内审 D-4：相对路径随 cwd 漂移，归档追溯链断裂 | 内审 D-4 |
| F8 | rollback `_del` 移动归档 | 失效产物隔离：原位消失、重做产新文件、archivedTo 告知去向 | 11 |
| F9 | finish 四步迁移 + 归档副本 | 归档先行保留收束前位置；jsonl 行 + `~/.ddo/history/<runId>/` | 11 |
| F10 | resume 发现层 + 冷启动 list | 断点接续与无参数引导 | 08/10 |

## 2. 输入清单

### 2.1 环境输入

| 输入 | 取值 | 说明 |
|---|---|---|
| Node | ≥18 | `node -v` 记录入结果 |
| DDO_HOME | **快速回归：`DDO_HOME=$(mktemp -d)` 隔离**；完整体验：真实 `~/.ddo` | 隔离跑判定更干净；真实跑能顺带验证全局索引多 run 共存 |
| 沙箱 | `eval/runs/<YYYYMMDD>-<slug>` | eval/README 沙箱规范；**不得**直接以 eval/ 或仓库根为 project |
| 预设 | `standard`（10 阶段全链） | 全覆盖 F1–F10；时间预算 30–60min（含 4 门人工决议） |
| 测试基线 | 82 用例 | 先跑 `node --test tools/tests/*.test.js`，非全绿不进入 dogfooding |

> **记录要求**：本表全部取值 + 执行主体信息（见 §5）必须原样进入该轮结论报告——环境信息是结论可复现的前提，缺项视为报告不合格。

### 2.2 任务输入（固定示例，保证跨轮可比）

标准任务（与首跑一致，结果可直接对照）：

> 开发个本地 ddo-code-flow 工作流可视化工具：语言用 node，通过从用户根目录的索引文件检查到本机执行过程中的 .state.json 来可视化执行流程，html 渲染的图都用 svg 来画，线不要出现相交的情况。

若换任务，必须满足：单文件交付物（coding 单批次可完成）/ 可写 cmd: 验收条目 / 天然含 1–2 个 BQ（数据范围、呈现形态类）。

### 2.3 决议脚本（门交互既定序列）

| 门 | 既定输入 | 验证点 |
|---|---|---|
| spec:02 | ① 先试无决议 `next`（应被拦）② 回答 BQ-1=仅运行中 run、BQ-2=静态 HTML ③ **「驳回」一次**（转移型 → rollback spec → 验证 `_del` 归档 F8）④ 重做后「同意」 | F1/F2/F8 |
| plan:02 | 「同意」（若 agent 产物标题带后缀被 validate 拦属正常修正循环） | F3 |
| test-plan:02 | 「同意」（**D-1 复验点**：真实组名必须过 validate） | F3 |
| reflection:02 | 「同意」 | F1 |

## 3. 执行步骤（含断言）

> 以下 `$SP` = run start 返回的 statePath；`$SB` = 沙箱绝对路径；CLI 一律 `node tools/cli.js …`。

| 步 | 动作 | 断言（比较基准） |
|---|---|---|
| 0 | `node --test tools/tests/*.test.js` | 82/82 全绿，否则终止 |
| 1 | `list workflows` / `list tasks` | exit 0；workflows 含 basic+standard；tasks ≥17 且含 desc |
| 2 | `run start --project $SB --workflow standard --title <任务输入>` | exit 0；返回 runId/statePath/currentStage=`requirement:01`；**F6**：state.startedAt 匹配 `^\d{4}-\d{2}-\d{2}T…[+-]\d{2}:\d{2}$`（非 Z 结尾）且日期与 runId 前 8 位一致；`dirs` 三绝对路径且 runDir ⊂ projectRoot |
| 3 | requirement：`exec` → 按组装 prompt 写 requirement.md → `validate` → `next` | exec 输出含 Output Contract 段；validate `validated:true`；next 激活 spec |
| 4 | spec:01：`exec`（**F5：必须当次完整消费，禁止凭记忆**）→ 写 spec.md（含 2 个 BQ）→ validate → next 开门 | 门选项 = 同意/驳回/修改/提问；无决议 next → exit 1 且 stderr 含选项清单（F1） |
| 5 | spec:02 门：按决议脚本 ①③④ | 「驳回」触发 `rollback --stage spec`：spec.md **移动**进 `_del/rollback-1/`、原位消失、输出 archivedTo（F8）；重做产新 spec.md 落 runDir；BQ 写回后 spec 含「对齐变化摘要」section（F2） |
| 6 | plan：exec → plan.md → validate → 门「同意」 | （首跑已知：标题后缀会被拦——属 F3 正常触发） |
| 7 | **中断重开复验（F5 专项，可选但推荐）**：此时 `run finish --status aborted` → 重开新 run → requirement 与 spec 两相位**必须重新 exec 并消费** | 观察点：agent 是否凭记忆跳过 exec；SKILL 硬约束是否被遵守；旧 run 的 history 行 statePath 为**绝对路径**（F7） |
| 8 | test-plan：exec → test-plan.md（G 分组 + Checklist/通过标准子节）→ validate → 门「同意」 | **D-1 复验**：`## G1. <真实组名>` 必须过 validate（不得再报「缺少必需 section」） |
| 9 | tasking：exec → tasks/task-group.json + task-NN.md → validate → next | **F4 复验**：在 tasking 就绪前抢先 `exec --task coding` → exit 1「执行位置不符」 |
| 10 | coding：exec → 按 task-NN 批次实现 → 自检循环 ≤3 轮 | 代码落沙箱（不越出 projectRoot）；产物声明的文件存在 |
| 11 | verification：exec → 逐条执行 cmd:（记录 exit code）→ **human: 必须经宿主提问工具**（不得代答）→ verification.log | cmd 全 PASS；human 用户确认；`ALL PASSED` 收尾；validate 过 |
| 12 | review / reporting：exec → 产物 → validate → next | review 覆盖 check-list 全条目；execution-report 含决策留痕引用 |
| 13 | reflection：exec → reflection-report（未完结项引用路径行号）→ 门「同意」 | completed:true |
| 14 | `run finish --status done` | **F7**：history jsonl 行 statePath 为绝对路径；**F6**：startedAt/endedAt 本地时区且日期=runId 日期；**F9**：`$DDO_HOME/history/<runId>/.state.json` 存在且保留收束前 currentStage；index 无残留 |
| 15 | resume 复验（F10）：另起 `DDO_HOME` 相同环境下 `resume` | 运行中阶段做本步更佳（step 11 前插一次）：列清单含本 run 位置概要；`resume --run-id` 返回双清单 |

## 4. 比较基准（产物与留痕的期望形态）

| 对象 | 期望 |
|---|---|
| run 目录文件 | requirement/spec/plan/test-plan.md、tasks/{task-group.json,task-NN.md}、verification.log、review-report.md、execution-report.md、reflection-report.md 齐全；（驳回注入时）`_del/rollback-1/spec.md` 存在且 runDir 无同名残留 |
| state 留痕 | 4 门 gate 均含 `decision`+`closedAt`；时间戳本地时区格式 |
| history jsonl | 1 行 done（+可选 1 行 aborted），statePath 绝对，finalStatus 正确 |
| 归档副本 | `history/<runId>/.state.json` 与原文件 runId/title/stages 一致，currentStage 保留收束前最后位置 |
| agent 行为（F5） | 每相位动手前有当次 exec 记录；中断重开后无凭记忆直写 |

## 5. 判定与记录

- **通过**：§3 全部断言成立 + §4 形态一致 → 结果摘要记入 `eval/showcases/<轮次>/`（新版本）或追加到现有 showcase 的复验记录（同版本重跑）
- **不通过**：任一断言失败 → 按全局递增编号记 D-N（v2-beta 已用至 D-4；新发现从 D-5 起），修或不修随版本决策，但**必须先记录**
- 已知非阻断观察项（不必 FAIL，但记录）：closedGates 概要无 phase 字段；plan↔test-plan 语义冲突靠 review 人审（无交叉校验）；coding「任务完成标记」无命令面（09-O2）

### 结论报告必备基础信息（缺项 = 报告不合格）

每轮 dogfooding 的结论报告（ASSESSMENT 或复验记录）开头必须带：

| 项 | 本 playbook 首跑取值（示例） |
|---|---|
| 执行主体（agent） | 宿主 + 模型名（如 Claude Code CLI / glm-5.3）——**模型不可省略** |
| 决议主体 | 真人用户（门/BQ/human 验收） |
| 被测工具版本 | skill version + 代码基线 commit + 运行中未提交变更说明 |
| Node / OS | 版本号 |
| DDO_HOME | 隔离或真实 |
| 执行窗口 | 起止本地时间 + 净时长 |
| 测试基线 | 用例数与结果 |

> 环境与模型信息随结论入版控——「哪个版本 × 什么模型跑出的结论」是跨轮对比与问题回溯的最低要求。

## 6. 首跑基线（对照用）

首跑（run `20260924-014319-025b`）在本 playbook 定稿前完成，差异：未注入「驳回」（F8 由单元测试与首跑 rollback 观察替代）、未做 step 7 中断重开复验（A-1/A-2 正是因此漏出——**后续轮次此步不可省**）。完整记录见 [../showcases/v2-beta/timeline.md](../showcases/v2-beta/timeline.md)。
