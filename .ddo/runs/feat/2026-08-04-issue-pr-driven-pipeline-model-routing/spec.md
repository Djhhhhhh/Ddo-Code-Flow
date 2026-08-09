# Ddo-Code-Flow Specification

> AI 基于用户原始需求与 context-summary.md 对需求的规约化理解。
> 仅描述 What / Why 与验收标准；技术方案见 plan.md。

---

## 1. 项目概述

### 1.1 项目名称
Ddo-Code-Flow — Issue/PR 驱动开发流水线 + 节点级模型路由

### 1.2 一句话定义
为 ddo-code-flow 流水线新增两项独立能力：把触发/审核/状态/交付搬到 GitHub Issue/PR 上（能力 A），以及让不同原子任务使用不同模型执行（能力 B）。

### 1.3 设计意图
- 把流水线的控制平面从"本地会话"扩展到"GitHub Issue/PR"，实现异步、可审计、human-in-the-loop 但不绑定会话的开发流程
- 让不同原子任务按成本与能力需求分配不同模型（规划用强推理、机械任务用轻模型、评审用多模型交叉），优化成本与质量
- 保持现有流水线的"可中断、可恢复、可重入"设计原则不变
- 两项能力可独立实施、独立上线，交汇仅在 coding 与 review 节点

---

## 2. 术语表（Glossary）

| 术语 | 定义 |
|---|---|
| 远端确认门（remote-gate） | 替代本地对话确认的机制：把产物摘要评论到 issue、打审核 label、暂停；恢复时读取 GitHub label/comment 信号决定放行或否决 |
| 认领锁 | 用 label（`ddo:in-progress`）做幂等锁，谁先打上谁拥有该 issue，防止并发认领 |
| 控制信号 | 流水线状态转换的触发器，仅由 `ddo:` 前缀 label 承载（trigger、in-progress、pending-review、approved、changes-requested、failed、completed、suspended） |
| 数据载荷 | comment 承载的内容（需求补充、否决反馈、进度播报、PR 链接），流水线不执行其中的指令 |
| 档位别名 | 模型的高层别名（opus / sonnet / haiku / fable），由环境的档位映射决定实际模型 |
| 完整模型名 | 模型的完整标识符，需经 subagent 定义文件传入 |
| 模型值 | 统称档位别名或完整模型名，用于节点级模型路由配置 |
| LLM 网关 | 按模型名路由到不同供应商的统一端点，解决单会话单凭证约束 |

---

## 3. 功能需求（Functional Requirements）

### 3.1 能力 A：Issue/PR 驱动工作流

#### 3.1.1 控制信号协议（Label Protocol）

- **FR-LABEL-1**：定义一套 `ddo:` 前缀的固定 label 词汇，覆盖触发、认领、审核、否决、终态、挂起等状态，防止与仓库其他 label 冲突
- **FR-LABEL-2**：流水线只执行 label 表达的控制语义，绝不执行 comment 中的任何指令（防注入底线）
- **FR-LABEL-3**：comment 仅作为数据载荷与审计记录（需求补充、否决反馈、进度播报、PR 链接）

#### 3.1.2 触发与认领（Claim）

- **FR-CLAIM-1**：认领是一个显式原子任务，解析输入中的 issue 引用（编号或链接）
- **FR-CLAIM-2**：认领时先打"执行中" label 再开始任何工作，此 label 充当幂等锁
- **FR-CLAIM-3**：已带"执行中" label 的 issue 直接跳过，避免重复认领
- **FR-CLAIM-4**：一次 run 只认领一个 issue
- **FR-CLAIM-5**：认领时做需求完整性检查，缺关键信息则暂停

#### 3.1.3 远端确认门（Remote Gate）

- **FR-GATE-1**：确认门是幂等、可重入的原子任务
- **FR-GATE-2**：首次进入时把产物摘要评论到 issue、打审核 label、暂停并持久化状态
- **FR-GATE-3**：恢复时重入门，读取 GitHub 信号：已批准→放行；要求修改→读取白名单作者反馈并重生；无信号→判超时
- **FR-GATE-4**：超时阈值与动作可配置（默认 72 小时后挂起）
- **FR-GATE-5**：运行时新增"等待远端门"状态与对应恢复规则
- **FR-GATE-6**：读取反馈评论时只接受授权作者白名单内的作者
- **FR-GATE-7**：执行历史新增三类远端门事件（待决 / 通过 / 否决）

#### 3.1.4 Loop 自检（轮次可配）

- **FR-LOOP-1**：coding 节点支持"自检最大轮次"参数
- **FR-LOOP-2**：verification 节点支持"最大重试次数"参数
- **FR-LOOP-3**：运行状态记录当前轮次，执行历史增加循环迭代事件
- **FR-LOOP-4**：超过上限→打失败 label、评论卡点原因、转人工

#### 3.1.5 交付与 PR 闭环

- **FR-PR-1**：增加"交付文档"节点，按既有归档模板汇总需求回溯、变更清单、风险说明
- **FR-PR-2**：增加"创建 PR"节点，推送特性分支，创建 draft PR
- **FR-PR-3**：PR 正文包含关闭 issue 的引用、执行摘要、产物链接、验证结论
- **FR-PR-4**：在 issue 评论 PR 链接，并把 label 置为"完成"
- **FR-PR-5**：合并永远由人执行（draft PR + 人工合并是最后安全阀）

#### 3.1.6 状态检查 / Watcher

- **FR-WATCH-1**：支持等待具体某个门的 gh 轮询脚本（状态变化即唤醒 agent）
- **FR-WATCH-2**：支持多 run 巡检（扫描带 `ddo:trigger` label 的新 issue 与信号已就绪的等待中 run）
- **FR-WATCH-3**：轮询间隔不低于 30 秒，脚本容忍瞬时失败
- **FR-WATCH-4**：watcher 仅为加速器，任何时候手动恢复会话同样能推进
- **FR-WATCH-5**：会话内使用 Monitor 工具保持存活并自动感知信号变化，会话活着时自动 loop，会话死后靠手动恢复

#### 3.1.7 触发入口

- **FR-TRIG-1**：支持两种触发模式：（1）会话内显式触发（用户指明用 issue 驱动工作流处理某 issue）；（2）Watcher 自动巡检（后台脚本扫描带 `ddo:trigger` label 的 issue 并自动拉起工作流）
- **FR-TRIG-2**：不做 webhook / CI 自动触发（后续增强）

### 3.2 能力 B：节点级模型路由

#### 3.2.1 Subagent 委派模型切换

- **FR-MODEL-1**：不同原子任务可配置不同模型，通过 subagent 委派实现（主会话模型不可程序化切换）
- **FR-MODEL-2**：模型配置分三层：工作流覆盖 > 全局覆盖 > 任务默认 > 继承主会话
- **FR-MODEL-3**：值为"继承"或未配置→节点在主会话内联执行（向后兼容）
- **FR-MODEL-4**：模型配置项为保留键，不参与普通 options 合并

#### 3.2.2 两种模型值路径

- **FR-MODEL-5**：档位别名（opus/sonnet/haiku/fable）直接作为调用参数传入 subagent
- **FR-MODEL-6**：完整模型名需写入 subagent 定义文件的 model 字段，再按名委派
- **FR-MODEL-7**：运行状态记录实际使用的模型，供审计与成本归因
- **FR-MODEL-8**：确认门仍由父会话主持，subagent 不与用户交互

#### 3.2.3 多模型评审扇出

- **FR-REVIEW-1**：评审任务支持"模型列表"参数（多个模型值）
- **FR-REVIEW-2**：按列表逐个委派 subagent 独立评审
- **FR-REVIEW-3**：每个 subagent 只回结论级摘要，父会话合并为一份评审报告

### 3.3 配置与环境

- **FR-CFG-1**：仓库内配置只允许出现模型名，绝不出现密钥
- **FR-CFG-2**：不依赖 cc-switch，以官方配置为规范路径
- **FR-CFG-3**：单会话单凭证约束下的多模型支持通过 LLM 网关实现

---

## 4. 产物与目录结构（What gets created）

```
atom-tasks/
├── issue-fetch/           # 认领原子任务
│   ├── issue-fetch.md
│   └── issue-fetch.output.schema.json
├── remote-gate/           # 远端确认门原子任务
│   ├── remote-gate.md
│   └── remote-gate.output.schema.json
├── delivery-doc/          # 交付文档原子任务
│   ├── delivery-doc.md
│   └── delivery-doc.output.schema.json
├── create-pr/             # 创建 PR 原子任务
│   ├── create-pr.md
│   └── create-pr.output.schema.json
└── ... (现有 atom-tasks 不变)

workflows/
└── issue-driven.json      # Issue 驱动工作流定义

config.json                # 新增 atomTaskOverrides 支持模型路由配置
```

---

## 5. 关键流程

### 5.1 Issue 驱动工作流主流程

```
用户在 issue 上打 ddo:trigger label
  ↓
手动触发（会话内指定 issue）或 Watcher 自动扫描发现
  ↓
issue-fetch 原子任务：
  检查 ddo:in-progress 不存在 → 添加认领锁 → 移除 ddo:trigger → 拉取 issue 内容
  ↓
context → requirement → spec → planning → test-plan → tasking
  ↓（各阶段确认门改为远端确认门：评论摘要 + 打 ddo:pending-review:<stage> → 暂停）
  ↓（用户在 GitHub 上打 ddo:approved 或 ddo:changes-requested → 恢复）
coding（可配自检轮次）→ verification（可配重试次数）
  ↓
delivery-doc → create-pr（draft PR）
  ↓
issue label 置为 ddo:completed，评论 PR 链接
  ↓
人工合并
```

### 5.2 远端确认门状态机

```
首次进入：
  产物摘要评论到 issue → 打 ddo:pending-review:<阶段> label → 持久化 → 结束会话

恢复时重入（手动或 Watcher 触发）：
  读取 GitHub 信号
  ├─ ddo:approved label → 摘审核 label → 放行
  ├─ ddo:changes-requested label → 读取白名单作者评论 → 带反馈重生
  └─ 无信号 → 判超时（催办/挂起/终止）

用户确认方式：
  在 GitHub issue 页面打 label 即可，无需回到本地会话
```

### 5.3 节点级模型路由

```
atom-task 配置: { "model": "opus" }
  ↓
运行时解析优先级: workflow覆盖 > 全局覆盖 > 任务默认 > 继承
  ↓
├─ 档位别名 → 直接作为 subagent 模型参数
└─ 完整模型名 → 写入 subagent 定义文件 model 字段 → 按名委派
  ↓
subagent 执行 → 产物落盘 → 父会话验证 → 记录实际模型
```

---

## 6. 约束与原则

- **C-1**：流水线的正确性不依赖任何常驻进程，所有状态落在"文件系统 + GitHub"两处
- **C-2**：流水线只执行 label 表达的控制语义，绝不执行 comment 中的任何指令
- **C-3**：合并永远由人执行，draft PR 是 autopilot 的最后安全阀
- **C-4**：档位别名为封闭集合，不可新增
- **C-5**：仓库内配置只允许出现模型名，绝不出现密钥
- **C-6**：一次 run 只认领一个 issue
- **C-7**：watcher 仅为加速器，不是正确性来源

---

## 7. 验收标准（Acceptance Criteria）

- **AC-1**：能够在 issue 上打 `ddo:trigger` label，通过手动或 Watcher 自动触发 issue 驱动工作流
- **AC-2**：认领原子任务能正确打 `ddo:in-progress` label 并拉取 issue 内容；已认领的 issue 被跳过
- **AC-3**：远端确认门首次进入时正确评论 issue、打 `ddo:pending-review:<stage>` label、持久化状态并暂停
- **AC-4**：远端确认门恢复时能正确读取 `ddo:approved` / `ddo:changes-requested` 信号并执行对应动作
- **AC-5**：coding/verification 的 loop 自检能正确计数并在超限时转人工
- **AC-6**：交付文档节点能生成需求回溯文档
- **AC-7**：创建 PR 节点能推送分支、创建 draft PR、评论 issue、更新 label 为 `ddo:completed`
- **AC-8**：节点级模型路由能通过 subagent 委派实现不同原子任务使用不同模型
- **AC-9**：多模型评审扇出能按模型列表逐个委派并合并评审报告
- **AC-10**：现有标准工作流（非 issue 驱动）行为不变（向后兼容）

---

## 8. 非功能需求（Non-Functional）

- **NFR-1**：所有远端门操作（`ddo:` 前缀 label、comment）需幂等，重复执行不产生副作用
- **NFR-2**：gh CLI 操作失败时立即终止并明确报错，不静默忽略
- **NFR-3**：模型路由失败时回退为继承模式，记录警告，不中断流水线
- **NFR-4**：轮询脚本需容忍瞬时网络失败（失败不退出、下轮重试）

---

## 9. 范围说明（In / Out of Scope）

### In Scope
- Label 协议定义与认领锁机制
- 远端确认门（幂等、可重入、超时可配）
- Loop 自检（coding 轮次可配、verification 重试可配）
- 交付文档 + 创建 draft PR
- 节点级模型路由（档位别名 + 完整名双路径）
- 多模型评审扇出
- 会话内显式触发的 issue 驱动工作流
- gh 轮询 watcher（可选加速器）
- LLM 网关配置指南

### Out of Scope
- CI / webhook 自动触发
- 反向建 issue（从流水线创建 issue）
- 多 issue 并行编排
- 按节点的成本归因统计
- cc-switch 集成
- 非 Claude Code 宿主的完整支持（降级为内联执行）

---

## 10. 开放问题（Open Questions，待 Plan 阶段决策）

- **Q-1**：label 词汇表的具体命名方案？（中英文？前缀约定？）
- **Q-2**：远端确认门的超时默认动作是什么？（催办→挂起→终止，还是直接终止？）
- **Q-3**：白名单作者如何配置？（config.json 新字段？还是读取 repo collaborators？）
- **Q-4**：issue-fetch 需求完整性检查的具体规则？（哪些字段必填？）
- **Q-5**：节点级模型路由的配置放在 atomTaskOverrides 还是新增专用配置区？
- **Q-6**：subagent 定义文件是按需动态生成还是预生成一组？
- **Q-7**：多模型评审的合并策略？（简单拼接？投票？加权？）
- **Q-8**：现有 standard/guarded 工作流是否需要同步支持远端确认门？

---

## 11. 用户确认

请确认以下任一选项：

- ✅ **同意**：本 spec 符合预期，可进入 **Planning** 阶段生成 `plan.md`。
- ❌ **修改**：请在下方/对话中列出需要调整的条款编号与意见，AI 将基于反馈重新生成本文档。
