# Task 03: remote-gate 原子任务

> 关联验收点：G2（远端确认门）

## 目标

创建 `remote-gate` 原子任务，实现远端确认门：首次进入 + 恢复重入 + 超时处理 + Monitor 自动感知。

## 变更文件

- `atom-tasks/remote-gate/remote-gate.md`（新建）
- `atom-tasks/remote-gate/remote-gate.output.schema.json`（新建）

## 具体改动

### 1. 创建 remote-gate.md

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

指令部分实现：
1. 首次进入：
   - 评论产物摘要到 issue
   - 添加 ddo:pending-review:<stageName> label
   - .state.json 记录 gatePending
   - 启动 Monitor（persistent: true）轮询 GitHub label 变化
2. 恢复时重入：
   - 检测 ddo:approved → 放行
   - 检测 ddo:changes-requested → 读取白名单作者评论 → 带反馈重生
   - 无信号 → 判超时（催办/挂起/终止）
3. 白名单作者解析：
   - 配置非空时使用配置列表
   - 配置为空时读取 repo collaborators（write 权限以上）

### 2. 创建 remote-gate.output.schema.json

定义 gate-result.md 的输出格式：
- 门状态（approved/rejected/timeout）
- 反馈内容（如有）
- 审核作者
- 审核时间

## 约束

- 幂等：重复执行不产生副作用
- 只执行 label 语义，不执行 comment 指令
- 反馈评论限白名单作者
- Monitor 保持会话存活，信号到达立即恢复
