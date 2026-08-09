# Ddo-Code-Flow Issue/PR 驱动流水线 + 节点级模型路由 Plan

> 基于已确认的 spec.md 做技术决策：定 schema、定通信方式、定运行时模型、定关键算法、定取舍。

---

## 1. 决策原则

| # | 原则 | 落地体现 |
|---|------|----------|
| P-1 | 状态落在文件系统 + GitHub，不依赖常驻进程 | .state.json 持久化 + gh CLI 读写 label/comment，任何会话可恢复 |
| P-2 | 控制信号仅认 label，comment 仅作数据载荷 | 防注入底线：流水线不执行 comment 中的任何指令 |
| P-3 | 复用现有 atom-task 与 runtime 机制 | 远端确认门是新 atom-task，但复用 .state.json 持久化与恢复框架 |
| P-4 | 两项能力独立实施、独立上线 | 能力 A（Issue 驱动）与能力 B（模型路由）仅在 coding/review 节点交汇 |
| P-5 | 向后兼容 | 现有 standard/guarded/lightweight 工作流行为不变；模型路由未配置时回退为继承 |
| P-6 | 渐进式读取 | 新增 atom-task 只在进入该 node 时加载，不预加载 |

---

## 2. 整体架构

### 2.1 架构图

```text
                        ┌─────────────────────────────────────┐
                        │           GitHub (控制平面)           │
                        │  Issue: label 状态机 + comment 数据   │
                        │  PR: draft PR + 人工合并              │
                        └──────────────┬──────────────────────┘
                                       │ gh CLI 双向读写
                                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    ddo-code-flow Runtime (执行平面)                   │
│                                                                      │
│  ┌──────────┐   ┌──────────────┐   ┌────────────┐   ┌────────────┐ │
│  │issue-fetch│──▶│context/spec/ │──▶│remote-gate │──▶│ coding     │ │
│  │ 原子任务  │   │plan/...阶段  │  │ 原子任务    │  │(模型路由)  │ │
│  └──────────┘   └──────────────┘   └────────────┘   └────────────┘ │
│       │                                   │               │         │
│       │              ┌────────────────────┘               │         │
│       ▼              ▼                                    ▼         │
│  ┌──────────┐   ┌──────────────┐                   ┌────────────┐ │
│  │.state.json│   │ 恢复时重入   │                   │subagent    │ │
│  │ 持久化    │   │ 远端门读信号 │                   │模型委派    │ │
│  └──────────┘   └──────────────┘                   └────────────┘ │
│                                                                      │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐   │
│  │delivery-doc  │──▶│  create-pr   │──▶│ 完成：label + comment │   │
│  │ 原子任务     │   │  原子任务    │   │                      │   │
│  └──────────────┘   └──────────────┘   └──────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                        ┌──────────────────────────┐
                        │    LLM 网关（可选）        │
                        │  按模型名路由到不同供应商   │
                        │  单会话单凭证的唯一解法     │
                        └──────────────────────────┘
```

### 2.2 关键事实

- FR-LABEL-1~3：label 承载控制信号，comment 仅作数据载荷，流水线不执行 comment 指令
- FR-CLAIM-1~5：issue-fetch 原子任务负责认领锁（打"执行中" label）+ 拉取 issue 内容
- FR-GATE-1~7：远端确认门是幂等、可重入的原子任务，复用 .state.json 持久化
- FR-MODEL-1~8：模型路由通过 subagent 委派实现，主会话模型不可程序化切换
- FR-REVIEW-1~3：多模型评审扇出通过"模型列表"参数逐个委派 subagent

---

## 3. 目录与命名（最终定版）

```text
Ddo-Code-Flow/
├── config.json                              # 全局配置（新增 atomTaskOverrides 模型路由）
├── config.schema.json                       # schema 更新
├── workflows/
│   ├── issue-driven.json                    # 新增：Issue 驱动工作流定义
│   ├── lightweight.json                     # 不变
│   ├── standard.json                        # 不变
│   └── guarded.json                         # 不变
├── atom-tasks/
│   ├── issue-fetch/                         # 新增：认领 + 拉取 issue
│   │   ├── issue-fetch.md
│   │   └── issue-fetch.output.schema.json
│   ├── remote-gate/                         # 新增：远端确认门
│   │   ├── remote-gate.md
│   │   └── remote-gate.output.schema.json
│   ├── delivery-doc/                        # 新增：交付文档
│   │   ├── delivery-doc.md
│   │   └── delivery-doc.output.schema.json
│   ├── create-pr/                           # 新增：创建 PR
│   │   ├── create-pr.md
│   │   └── create-pr.output.schema.json
│   ├── coding/
│   │   └── coding.md                        # 更新：新增 model option + loop 自检
│   ├── verification/
│   │   └── verification.md                  # 更新：新增 maxRetries option
│   ├── review/                              # 更新：新增 models[] 参数支持扇出
│   │   └── review.md
│   └── ... (现有 atom-task 不变)
└── scripts/
    └── gh-watcher.sh                        # 新增：gh 轮询脚本（可选加速器）
```

---

## 4. 核心 Schema

### 4.1 Label 词汇表（Q-1 答案）

所有 label 统一使用 `ddo:` 前缀，防止与仓库其他 label 冲突，也便于 watcher 精确过滤：

| Label | 语义 | 类别 |
|-------|------|------|
| `ddo:trigger` | 待开发，标记需要流水线处理的 issue | 触发 |
| `ddo:in-progress` | 执行中，认领锁 | 执行 |
| `ddo:pending-review:<stage>` | 待审核（带阶段名） | 审核 |
| `ddo:approved` | 审核通过 | 审核 |
| `ddo:changes-requested` | 要求修改 | 审核 |
| `ddo:failed` | 执行失败 | 终态 |
| `ddo:completed` | 完成 | 终态 |
| `ddo:suspended` | 已挂起 | 挂起 |

**理由**：`ddo:` 前缀确保 watcher 扫描时不会误触发其他 label；英文小写 kebab-case 是 GitHub 社区惯例；`pending-review:<stage>` 用冒号分隔阶段名；封闭集合，不可自定义新增。

### 4.2 issue-fetch 原子任务

```yaml
---
name: issue-fetch
version: "1.0.0"
stage: requirement
enabled: true
timeoutSec: 120
concurrency:
  parallelizable: false
confirmation:
  required: false
io:
  inputs: []
  outputs:
    - ref: "run://docs/{type}/{dateDescription}/issue-context.md"
      kind: markdown
options:
  - name: issueRef
    type: string
    required: true
    description: "Issue 编号或 URL"
  - name: claimLabel
    type: string
    default: "ddo:in-progress"
    description: "认领锁 label 名"
  - name: triggerLabel
    type: string
    default: "ddo:trigger"
    description: "触发 label 名"
---
```

### 4.3 remote-gate 原子任务

```yaml
---
name: remote-gate
version: "1.0.0"
stage: dynamic
enabled: true
timeoutSec: 0
concurrency:
  parallelizable: false
confirmation:
  required: false
io:
  inputs:
    - ref: "run://docs/{type}/{dateDescription}/gate-artifact.md"
      required: true
    - ref: "run://docs/{type}/{dateDescription}/.state.json"
      required: true
  outputs:
    - ref: "run://docs/{type}/{dateDescription}/gate-result.md"
      kind: markdown
options:
  - name: issueNumber
    type: integer
    required: true
    description: "目标 issue 编号"
  - name: stageName
    type: string
    required: true
    description: "当前阶段名（用于 label）"
  - name: timeoutHours
    type: integer
    default: 72
    description: "超时阈值（小时）"
  - name: timeoutAction
    type: string
    enum: ["suspend", "abort"]
    default: "suspend"
    description: "超时动作"
  - name: whitelistAuthors
    type: array
    items: { type: string }
    default: []
    description: "授权反馈作者白名单（空=repo collaborators）"
---
```

### 4.4 delivery-doc 原子任务

```yaml
---
name: delivery-doc
version: "1.0.0"
stage: delivery
enabled: true
timeoutSec: 0
concurrency:
  parallelizable: false
confirmation:
  required: false
io:
  inputs:
    - ref: "run://docs/{type}/{dateDescription}/spec.md"
      required: true
    - ref: "run://docs/{type}/{dateDescription}/plan.md"
      required: true
    - ref: "run://docs/{type}/{dateDescription}/test-plan.md"
      required: false
    - ref: "run://docs/{type}/{dateDescription}/verification.log"
      required: false
  outputs:
    - ref: "run://docs/{type}/{dateDescription}/delivery-doc.md"
      kind: markdown
---
```

### 4.5 create-pr 原子任务

```yaml
---
name: create-pr
version: "1.0.0"
stage: delivery
enabled: true
timeoutSec: 300
concurrency:
  parallelizable: false
confirmation:
  required: false
io:
  inputs:
    - ref: "run://docs/{type}/{dateDescription}/delivery-doc.md"
      required: true
    - ref: "run://docs/{type}/{dateDescription}/.state.json"
      required: true
  outputs:
    - ref: "run://docs/{type}/{dateDescription}/pr-info.md"
      kind: markdown
options:
  - name: issueNumber
    type: integer
    required: true
    description: "关联 issue 编号"
  - name: baseBranch
    type: string
    default: "main"
    description: "目标分支"
  - name: draftPR
    type: boolean
    default: true
    description: "是否创建 draft PR"
---
```

### 4.6 模型路由配置 Schema（Q-5 答案）

模型路由配置放在 `atomTaskOverrides` 中，使用保留键 `model`：

```jsonc
// config.json 全局覆盖
{
  "atomTaskOverrides": {
    "coding": { "model": "opus" },
    "review": { "model": ["sonnet", "haiku"] }
  }
}

// workflows/issue-driven.json 工作流级覆盖
{
  "atomTaskOverrides": {
    "coding": { "model": "opus" },
    "plan": { "model": "opus" },
    "review": { "model": ["sonnet", "haiku", "fable"] }
  }
}
```

**字段语义约束**：

- `model`：保留键，不参与普通 options 合并。值类型为 string（单模型）或 string[]（多模型评审扇出）。
- 值为档位别名（opus/sonnet/haiku/fable）时直接作为 subagent 模型参数。
- 值为完整模型名时写入 subagent 定义文件 model 字段，再按名委派。
- 值为 `"inherit"` 或未配置 → 节点在主会话内联执行。
- 优先级：workflow 级 atomTaskOverrides > config 全局 atomTaskOverrides > atom-task 默认值 > 继承。

### 4.7 issue-driven.json 工作流定义

```jsonc
{
  "$schema": "../config.schema.json#/$defs/workflowDefinition",
  "id": "issue-driven",
  "version": "1.0.0",
  "name": "Issue Driven",
  "description": "Issue/PR 驱动开发流水线：认领 issue → 远端确认门 → 交付 PR。",
  "descriptionEn": "Issue/PR driven pipeline: fetch issue → remote gates → deliver PR.",
  "confirmationGates": [],  // 远端确认门替代本地确认门
  "pipeline": [
    {
      "stage": "context",
      "description": "读取项目上下文。",
      "enabled": true,
      "atomTasks": {
        "entry": ["context"],
        "nodes": {
          "context": { "next": ["requirement"], "parallelApprove": false, "parallelWith": [] }
        }
      }
    },
    {
      "stage": "requirement",
      "description": "认领 issue 并拉取内容，创建工作树。",
      "enabled": true,
      "atomTasks": {
        "entry": ["issue-fetch"],
        "nodes": {
          "issue-fetch": { "next": ["requirement"], "parallelApprove": false, "parallelWith": [] },
          "requirement": { "next": ["git-worktree"], "parallelApprove": false, "parallelWith": [] },
          "git-worktree": { "next": ["spec"], "parallelApprove": false, "parallelWith": [] }
        }
      }
    },
    {
      "stage": "spec",
      "description": "生成 spec.md，通过远端确认门审核。",
      "enabled": true,
      "atomTasks": {
        "entry": ["spec"],
        "nodes": {
          "spec": { "next": ["remote-gate-spec"], "parallelApprove": false, "parallelWith": [] },
          "remote-gate-spec": { "next": ["plan"], "parallelApprove": false, "parallelWith": [] }
        }
      }
    },
    {
      "stage": "planning",
      "description": "生成 plan.md，通过远端确认门审核。",
      "enabled": true,
      "atomTasks": {
        "entry": ["plan"],
        "nodes": {
          "plan": { "next": ["remote-gate-plan"], "parallelApprove": false, "parallelWith": [] },
          "remote-gate-plan": { "next": ["test-plan"], "parallelApprove": false, "parallelWith": [] }
        }
      }
    },
    {
      "stage": "test-plan",
      "description": "生成 test-plan.md，通过远端确认门审核。",
      "enabled": true,
      "atomTasks": {
        "entry": ["test-plan"],
        "nodes": {
          "test-plan": { "next": ["remote-gate-test-plan"], "parallelApprove": false, "parallelWith": [] },
          "remote-gate-test-plan": { "next": ["tasking"], "parallelApprove": false, "parallelWith": [] }
        }
      }
    },
    {
      "stage": "tasking",
      "description": "拆分任务。",
      "enabled": true,
      "atomTasks": {
        "entry": ["tasking"],
        "nodes": {
          "tasking": { "next": ["coding"], "parallelApprove": false, "parallelWith": [] }
        }
      }
    },
    {
      "stage": "coding",
      "description": "执行编码，支持自检轮次。",
      "enabled": true,
      "atomTasks": {
        "entry": ["coding"],
        "nodes": {
          "coding": { "next": ["verification"], "parallelApprove": false, "parallelWith": [] }
        }
      }
    },
    {
      "stage": "verification",
      "description": "验收，支持重试次数。",
      "enabled": true,
      "atomTasks": {
        "entry": ["verification"],
        "nodes": {
          "verification": { "next": ["delivery-doc"], "parallelApprove": false, "parallelWith": [] }
        }
      }
    },
    {
      "stage": "delivery",
      "description": "交付文档 + 创建 PR。",
      "enabled": true,
      "atomTasks": {
        "entry": ["delivery-doc"],
        "nodes": {
          "delivery-doc": { "next": ["create-pr"], "parallelApprove": false, "parallelWith": [] },
          "create-pr": { "next": [], "parallelApprove": false, "parallelWith": [] }
        }
      }
    },
    {
      "stage": "done",
      "description": "标记完成。",
      "enabled": true,
      "atomTasks": {
        "entry": [],
        "nodes": {}
      }
    }
  ],
  "atomTaskOverrides": {
    "test-plan": { "enabled": true, "tdd": true }
  }
}
```

---

## 5. 关键算法 / 流程

### 5.1 触发模式：手动 + Watcher 自动巡检

**双模式设计**：

| 模式 | 触发方式 | 适用场景 |
|------|----------|----------|
| 手动触发（默认） | 用户在会话中指定 issue 编号，工作流立即拉取执行 | 开发调试、单次任务 |
| Watcher 自动巡检（可选） | 后台脚本持续扫描 GitHub，发现 `ddo:trigger` 标记的 issue 自动拉起工作流 | 无人值守、批量处理 |

**手动触发流程**：
```
用户在会话中: "用 issue-driven 工作流处理 #42"
  ↓
工作流解析 → 加载 issue-driven.json
  ↓
issue-fetch 原子任务: 解析 #42 → 检查 label → 认领 → 拉取
  ↓
后续阶段自动执行（远端门暂停 → 恢复时用户再次进入会话）
```

**Watcher 自动巡检流程**：
```
gh-watcher.sh 后台运行
  ↓ 每 30 秒轮询
gh issue list --label "ddo:trigger" --json number,title,labels
  ↓ 发现新 issue
检查是否已有 .state.json 在处理该 issue（防重复）
  ↓ 未处理
拉起 headless agent 会话: "用 issue-driven 工作流处理 #N"
  ↓
issue-fetch 认领 → 后续阶段自动执行
  ↓ 遇到远端门暂停
Watcher 继续扫描其他 issue（不阻塞）
  ↓ 下次轮询发现门信号变化
恢复对应 run 的会话继续执行
```

**Watcher 恢复巡检**：
```
gh-watcher.sh 扫描已暂停的 run
  ↓ 读取 .state.json.gatePending
检查对应 issue 的 label 变化
  ↓ 发现 ddo:approved 或 ddo:changes-requested
拉起会话恢复该 run
```

### 5.2 完整 Loop 流程（端到端）

以下是一个完整 issue 驱动开发的端到端流程，展示 Loop 如何工作：

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 阶段 0: 用户在 GitHub 上创建 issue 并打标                                │
│                                                                         │
│   1. 创建 issue: "实现用户登录功能"                                       │
│   2. 打 label: ddo:trigger                                         │
│   3. issue 现在带 ddo:trigger 标记，等待被拉取                       │
└─────────────────────────────────────────┬───────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 阶段 1: 触发拉取（手动或 Watcher）                                       │
│                                                                         │
│   手动: 用户在会话中说 "用 issue-driven 处理 #42"                         │
│   Watcher: gh-watcher.sh 扫描到 #42 带 ddo:trigger                 │
│                                                                         │
│   → issue-fetch 原子任务:                                               │
│     1. 检查 ddo:in-progress 不存在（未被认领）                       │
│     2. 添加 ddo:in-progress（认领锁）                               │
│     3. 移除 ddo:trigger（防止重复扫描）                              │
│     4. 拉取 issue 内容 → issue-context.md                               │
└─────────────────────────────────────────┬───────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 阶段 2: 自动执行（本地会话）                                             │
│                                                                         │
│   context → requirement → git-worktree → spec                           │
│                                                                         │
│   spec.md 生成完毕，进入远端确认门                                       │
└─────────────────────────────────────────┬───────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 阶段 3: 远端确认门 — 暂停但会话保持存活                                   │
│                                                                         │
│   1. 评论 spec 摘要到 issue                                             │
│   2. 添加 label: ddo:pending-review:spec                                │
│   3. .state.json 记录 gatePending                                       │
│   4. 启动 Monitor（persistent: true）轮询 GitHub label 变化              │
│      → 会话不结束，保持存活，自动感知信号                                 │
└─────────────────────────────────────────┬───────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 阶段 4: 用户在 GitHub 上审核（无需本地会话）                              │
│                                                                         │
│   用户在 issue 页面:                                                    │
│     - 查看 spec 摘要评论                                                │
│     - 添加 label: ddo:approved  ← 表示通过                         │
│     - 或添加 ddo:changes-requested + 评论反馈  ← 表示需要修改       │
└─────────────────────────────────────────┬───────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 阶段 5: 自动恢复（Monitor 感知信号）                                      │
│                                                                         │
│   Monitor 检测到 label 变化 → 通知 agent                                │
│   → remote-gate 重入:                                                   │
│     1. 检测到 ddo:approved                                              │
│     2. 移除 ddo:pending-review:spec 和 ddo:approved                     │
│     3. 放行到下一阶段                                                    │
│                                                                         │
│   → 继续执行: plan → remote-gate-plan → test-plan → ...                 │
│   → 每个远端门重复阶段 3-5                                               │
│                                                                         │
│   会话意外退出时：用户手动恢复（.state.json 已持久化，不丢状态）          │
└─────────────────────────────────────────┬───────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 阶段 6: 交付                                                            │
│                                                                         │
│   verification 通过 → delivery-doc → create-pr                          │
│                                                                         │
│   1. 生成交付文档                                                       │
│   2. 推送特性分支，创建 draft PR                                         │
│   3. 评论 PR 链接到 issue                                               │
│   4. 添加 label: ddo:completed                                     │
│   5. 用户在 GitHub 上人工合并 PR                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**关键点**：
- **Loop 是事件驱动的**：不是轮询循环，而是"暂停 → Monitor 轮询 → 信号到达 → 恢复"的状态机
- **用户确认在 GitHub 上**：通过打 label 确认/否决，无需回到本地会话
- **会话内自动感知**：Monitor 保持会话存活，每 30 秒检查 GitHub label，信号到达立即恢复
- **会话死了不丢状态**：.state.json 已持久化，用户手动恢复即可继续
- **Watcher 是可选加速器**：用于无人值守场景，手动恢复同样可行

### 5.3 issue-fetch 认领算法

```
输入：issueRef（编号或 URL）、claimLabel="ddo:in-progress"、triggerLabel="ddo:trigger"
1. 解析 issueRef → issueNumber
2. gh issue view <issueNumber> --json labels,state,body,title
3. IF issue 已带 claimLabel → abort("已被认领，跳过")
4. IF issue 不带 triggerLabel → abort("缺少 ddo:trigger 标记")
5. gh issue edit <issueNumber> --add-label <claimLabel>
6. gh issue edit <issueNumber> --remove-label <triggerLabel>  // 摘掉触发标记，防止重复扫描
7. 提取 issue title、body、labels、comments → 写入 issue-context.md
8. 需求完整性检查：IF title 为空 OR body < 50 字符 → 暂停，评论缺失信息
9. 输出 issue-context.md
```

### 5.3 远端确认门状态机（Q-2 答案）

```
首次进入：
  1. 读取 gate-artifact.md（本阶段产物摘要）
  2. gh issue comment <issueNumber> --body "<产物摘要>"
  3. gh issue edit <issueNumber> --add-label "ddo:pending-review:<stageName>"
  4. 在 .state.json 写入 gatePending 记录：
     { "stage": "<stageName>", "enteredAt": "<ISO 8601>", "status": "pending" }
  5. 更新 .state.json.currentStage = "waiting-remote-gate"
  6. 持久化，结束会话

恢复时重入（手动或 Watcher 触发）：
  1. 读取 .state.json.gatePending
  2. gh issue view <issueNumber> --json labels,comments
  3. 检查 labels：
     a. IF 包含 "ddo:approved"：
        - gh issue edit <issueNumber> --remove-label "ddo:pending-review:<stageName>"
        - gh issue edit <issueNumber> --remove-label "ddo:approved"
        - gatePending.status = "approved"
        - 放行下一节点
     b. IF 包含 "ddo:changes-requested"：
        - 读取最新 comment（限白名单作者）
        - gh issue edit <issueNumber> --remove-label "ddo:pending-review:<stageName>"
        - gh issue edit <issueNumber> --remove-label "ddo:changes-requested"
        - gatePending.status = "rejected"
        - 带反馈重生当前阶段
     c. 两者都没有：
        - IF now - enteredAt > timeoutHours：
          - timeoutAction == "suspend" → gh issue edit --add-label "ddo:suspended"，暂停
          - timeoutAction == "abort" → gh issue edit --add-label "ddo:failed"，终止
        - ELSE → 继续等待，结束会话
```

**超时默认动作**（Q-2 答案）：默认 72 小时后挂起（suspend）。配置项 `timeoutAction` 可选 `suspend` 或 `abort`。催办机制：超时前 24 小时评论催办提醒。

**用户确认方式**：用户在 GitHub issue 页面操作 label 即可确认/否决，无需回到本地会话。会话内 Monitor 自动感知信号变化并恢复执行。

**本地 Loop 机制**：远端门暂停时不结束会话，而是启动 Monitor 保持会话存活并轮询 GitHub：

```
远端门暂停
  ↓
启动 Monitor（persistent: true）:
  命令: while true; do
    labels=$(gh issue view <issueNumber> --json labels --jq '.labels[].name')
    if echo "$labels" | grep -q "ddo:approved"; then
      echo "GATE_APPROVED"
      exit 0
    fi
    if echo "$labels" | grep -q "ddo:changes-requested"; then
      echo "GATE_REJECTED"
      exit 0
    fi
    if echo "$labels" | grep -q "ddo:failed"; then
      echo "GATE_FAILED"
      exit 1
    fi
    sleep 30
  done
  description: "等待远端门信号: issue #<N>"
  ↓
Monitor 事件到达（GATE_APPROVED / GATE_REJECTED）
  ↓
Agent 收到通知 → 读取信号 → 恢复执行后续阶段
```

**会话存活期间**：Monitor 自动轮询，信号变化立即恢复，无需用户干预。
**会话意外退出**：.state.json 已持久化，用户手动进入会话提供 .state.json 路径即可恢复（不丢状态）。

### 5.4 白名单作者解析（Q-3 答案）

```
IF options.whitelistAuthors 非空：
  使用配置的作者列表
ELSE：
  gh api repos/{owner}/{repo}/collaborators --jq '.[].login'
  过滤权限 >= write 的用户
```

**配置方式**：`remote-gate` 原子任务的 `whitelistAuthors` option。config.json 的 `atomTaskOverrides.remote-gate.whitelistAuthors` 可设全局默认。

### 5.5 需求完整性检查规则（Q-4 答案）

issue-fetch 认领时检查：

| 检查项 | 必填 | 规则 |
|--------|------|------|
| title | ✅ | 非空 |
| body | ✅ | ≥ 50 字符 |
| labels 含 trigger | ✅ | 必须存在 |

不满足 → 暂停并评论缺失项，等待补充。不做强制字段模板（issue 自由度高），只做最低完整性。

### 5.6 模型路由解析算法（Q-6 答案）

```
输入：atomTaskName
1. 检查 workflow 级 atomTaskOverrides[atomTaskName].model → 若存在，记为 modelValue
2. ELSE 检查 config 全局 atomTaskOverrides[atomTaskName].model → 若存在，记为 modelValue
3. ELSE 检查 atom-task 默认 options.model → 若存在，记为 modelValue
4. ELSE modelValue = "inherit"

IF modelValue == "inherit" OR modelValue 未设置：
  → 节点在主会话内联执行（向后兼容）
ELSE IF modelValue 是 string（单模型）：
  → 委派 subagent，传入 model 参数
  → IF subagent 定义文件存在（预生成），按名委派
  → ELSE 运行时动态生成 subagent 定义（写入临时 .md），按名委派
ELSE IF modelValue 是 string[]（多模型，仅 review）：
  → 按列表逐个委派 subagent 独立评审
  → 每个 subagent 只回结论级摘要
  → 父会话合并为一份评审报告

记录实际使用的模型到 .state.json.stages[stage].nodes[node].actualModel
```

**subagent 定义文件策略**（Q-6 答案）：运行时动态生成。在 `<worktreePath>/.subagents/` 下按需创建，以 `<atomTaskName>-<modelAlias>.md` 命名。不预生成，避免维护负担。

### 5.7 多模型评审合并策略（Q-7 答案）

```
输入：reviews[]（每个 subagent 返回的结论级摘要）
1. 简单拼接：每个 review 独立一段，标注模型名
2. 共识提取：标记所有 review 都提到的问题为"高置信度"
3. 冲突标记：仅一个 review 提到的问题标记为"待确认"
4. 输出：合并评审报告（markdown）
```

**理由**：不做投票/加权（过度设计）。简单拼接 + 共识/冲突标记足够人类决策。合并逻辑在父会话执行，不委派给 subagent。

### 5.8 Loop 自检算法

```
coding 节点：
  options.maxSelfCheckRounds = 3（默认）
  round = 0
  WHILE round < maxSelfCheckRounds:
    执行编码
    运行测试/静态检查
    IF 全部通过 → break
    round++
    自行修复失败项
  IF round >= maxSelfCheckRounds AND 仍有失败：
    gh issue edit --add-label "ddo:failed"
    gh issue comment --body "自检超限，转人工：{失败原因}"
    暂停

verification 节点：
  options.maxRetries = 2（默认）
  retry = 0
  WHILE retry < maxRetries:
    执行验收
    IF 全部通过 → break
    retry++
    回到 coding 修复
  IF retry >= maxRetries AND 仍有失败：
    gh issue edit --add-label "ddo:failed"
    gh issue comment --body "验收超限，转人工：{失败原因}"
    暂停
```

### 5.9 Watcher 轮询脚本（Q-8 答案的一部分）

Q-8：现有 standard/guarded 工作流**不同步支持**远端确认门。远端确认门是 issue-driven 工作流的专属能力。standard/guarded 保持本地确认门不变。

**Watcher 职责**：
1. **扫描新触发 issue**：发现带 `ddo:trigger` label 的 issue → 拉起工作流
2. **扫描门信号变化**：发现带 `ddo:approved` / `ddo:changes-requested` 的 issue → 恢复对应 run

```bash
#!/bin/bash
# scripts/gh-watcher.sh — 双模式巡检脚本
# 模式 1: 扫描新触发 issue（无参数）
# 模式 2: 等待特定门信号（传入 ISSUE_NUMBER）
ISSUE=${1:-""}
INTERVAL=${3:-30}

if [ -z "$ISSUE" ]; then
  # 模式 1: 扫描新触发 issue
  while true; do
    # 查找带 ddo:trigger 且未被认领的 issue
    issues=$(gh issue list --label "ddo:trigger" --json number,title --jq '.[].number')
    for num in $issues; do
      # 检查是否已有 run 在处理该 issue（防重复）
      if ! find . -path "*/docs/*/*/.state.json" -exec grep -l "\"issueNumber\":$num" {} \; 2>/dev/null | head -1; then
        echo "NEW_ISSUE:$num"
        # 这里可以拉起 agent 会话处理
      fi
    done
    sleep "$INTERVAL"
  done
else
  # 模式 2: 等待特定门信号
  while true; do
    labels=$(gh issue view "$ISSUE" --json labels --jq '.labels[].name')
    if echo "$labels" | grep -q "ddo:approved"; then
      echo "GATE_APPROVED"
      exit 0
    fi
    if echo "$labels" | grep -q "ddo:changes-requested"; then
      echo "GATE_REJECTED"
      exit 0
    fi
    if echo "$labels" | grep -q "ddo:failed"; then
      echo "GATE_FAILED"
      exit 1
    fi
    sleep "$INTERVAL"
  done
fi
```

**Watcher 与手动恢复的关系**：Watcher 仅为加速器（FR-WATCH-4）。任何时候用户手动进入会话，提供 `.state.json` 路径或 issue 编号，同样能恢复执行。Watcher 不是正确性来源。

---

## 6. 错误处理与回退

| 触发条件 | 行为 |
|---|---|
| gh CLI 命令失败 | 立即终止并明确报错，不静默忽略（NFR-2） |
| issue 已被认领（带 ddo:in-progress label） | 跳过，abort 并提示（FR-CLAIM-3） |
| issue 缺少 ddo:trigger label | abort 并提示 |
| issue 需求不完整 | 暂停，评论缺失项，等待补充（FR-CLAIM-5） |
| 远端门超时 | 默认挂起（suspend），可配为 abort（FR-GATE-4） |
| 远端门反馈作者不在白名单 | 忽略该评论，继续等待 |
| 模型路由失败 | 回退为继承模式，记录警告，不中断（NFR-3） |
| subagent 执行失败 | 记录失败到 .state.json，父会话决定重试或转人工 |
| LLM 网关不可用 | 模型路由回退继承，记录警告 |
| 本地确认门 vs 远端门冲突 | issue-driven 工作流的 confirmationGates 为空，远端门由 DAG 中的 remote-gate 节点承载 |

---

## 7. 风险与权衡

| # | 风险 | 描述 | 处置 |
|---|------|------|---|
| R-1 | issue 质量差 | 用户 issue 描述不完整导致下游跑偏 | 认领时做最低完整性检查；不满足则暂停等待补充 |
| R-2 | 远端门注入 | 恶意用户在 comment 中写指令 | 硬规则：流水线只执行 label 语义，不执行 comment 指令；反馈限白名单作者 |
| R-3 | 并发认领冲突 | 两个会话同时认领同一 issue | `ddo:in-progress` label 添加是原子操作（GitHub API 保证），先到先得；后到者检测到已存在则跳过 |
| R-4 | subagent 上下文隔离 | subagent 缺少父会话上下文 | 交接内容自包含：任务全文 + 方案引用 + 文件路径 + 验收锚点 |
| R-5 | 全局模型覆盖干扰 | 环境变量覆盖所有 subagent 模型 | 实施前置检查确认未设置；文档明确警告 |
| R-6 | 轮询资源消耗 | watcher 长时间轮询消耗 API 配额 | 间隔不低于 30 秒；watcher 仅为加速器，手动恢复同样能推进 |
| R-7 | issue-driven 与 standard 差异大 | 新工作流引入大量新 atom-task | 能力 A/B 独立实施；新 atom-task 不修改现有任务，仅新增 |
| R-8 | draft PR 合并遗忘 | 人忘记合并 draft PR | issue label 保持"completed"，PR 页面可见；可加催办提醒 |

---

## 8. 实施次序（高层路线，供 Tasking 拆分参考）

| 阶段 | 能力单元 | 说明 | 依赖 |
|---|---|---|---|
| 1 | Label 协议定义 + config.schema.json 更新 | 定义 label 词汇表 schema，更新 config.json 支持 issue-driven 工作流索引 | 无 |
| 2 | issue-fetch 原子任务 | 认领锁 + 拉取 issue 内容 + 完整性检查 | 阶段 1 |
| 3 | remote-gate 原子任务 | 远端确认门：首次进入 + 恢复重入 + 超时处理 | 阶段 1 |
| 4 | issue-driven.json 工作流定义 | 组装完整 DAG，引用所有新 atom-task | 阶段 1-3 |
| 5 | coding/verification 更新 | 新增 maxSelfCheckRounds / maxRetries options + loop 自检逻辑 | 阶段 1 |
| 6 | delivery-doc 原子任务 | 交付文档生成 | 阶段 1 |
| 7 | create-pr 原子任务 | 推送分支 + 创建 draft PR + 评论 issue + 更新 label | 阶段 1, 6 |
| 8 | 模型路由 runtime | subagent 委派 + 模型值解析 + 双路径（别名/完整名） | 阶段 1 |
| 9 | review 扇出 | 多模型评审 + 合并策略 | 阶段 8 |
| 10 | gh-watcher.sh | 轮询脚本（可选加速器） | 阶段 3 |
| 11 | SKILL.md 更新 | 新增"远端确认门"与"模型路由"运行时说明 | 阶段 1-10 |
| 12 | 全流程演练 | 用真实 issue 走完整链路验收 | 阶段 1-11 |

---

## 9. 与 spec 的开放问题对应表

| spec Open Question | plan 中的落地 |
|---|---|
| Q-1 label 词汇表的具体命名方案 | 第 4.1 节：`ddo:` 前缀 + 英文 kebab-case，冒号分隔阶段名（如 `ddo:pending-review:spec`） |
| Q-2 远端确认门的超时默认动作 | 第 5.3 节：默认 72 小时后挂起（suspend），可配为 abort；超时前 24 小时催办 |
| Q-3 白名单作者如何配置 | 第 5.4 节：remote-gate 的 `whitelistAuthors` option；空则读取 repo collaborators（write 权限以上） |
| Q-4 issue-fetch 需求完整性检查的具体规则 | 第 5.5 节：title 非空 + body ≥ 50 字符 + ddo:trigger label 存在 |
| Q-5 节点级模型路由的配置位置 | 第 4.6 节：放在 atomTaskOverrides 中，使用保留键 `model` |
| Q-6 subagent 定义文件策略 | 第 5.6 节：运行时动态生成，写入 `<worktreePath>/.subagents/`，按需创建 |
| Q-7 多模型评审的合并策略 | 第 5.7 节：简单拼接 + 共识提取 + 冲突标记，不做投票/加权 |
| Q-8 现有工作流是否支持远端确认门 | 第 5.9 节：不支持。远端门是 issue-driven 专属；standard/guarded 保持本地确认门 |

---

## 10. 用户确认

请确认以下任一选项：

- ✅ **同意**：本 plan 符合预期，可进入 **Test-Planning** 阶段生成 `test-plan.md`。
- ❌ **修改**：请在下方/对话中列出需要调整的章节与意见，AI 将基于反馈重新生成本文档。
