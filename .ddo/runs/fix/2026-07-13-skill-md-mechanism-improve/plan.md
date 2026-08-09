# Ddo-Code-Flow SKILL.md 机制完善 Plan

> 基于已确认的 spec.md 做技术决策。

---

## 1. 决策原则

| # | 原则 | 落地体现 |
|---|------|----------|
| P-1 | 修复真实 bug，不做表面优化 | 聚焦步骤重复、字段缺失、验证范围、逻辑分散四个实际问题 |
| P-2 | 最小侵入 | 仅修改 SKILL.md，不触碰 config/atom-task/schema |
| P-3 | 向后兼容 | .state.json 只增字段（workflowId），现有 run 可正常恢复 |

---

## 2. .state.json 完整字段说明

### 2.1 新 run 初始化时（Step 3，worktreePath 未设置）

```json
{
  "runId": null,
  "workflowId": "standard",
  "configPath": "/Users/user/projects/Ddo-Code-Flow/config.json",
  "workflowPath": "/Users/user/projects/Ddo-Code-Flow/workflows/standard.json",
  "projectRoot": "/Users/user/projects/Ddo-Code-Flow",
  "createdAt": "2026-07-13T12:00:00+08:00",
  "userRequirement": "用户的原始需求文本",
  "currentStage": "context",
  "stages": {},
  "history": [
    { "event": "created", "at": "2026-07-13T12:00:00+08:00", "note": "workflowId=standard" }
  ],
  "historyMeta": {
    "version": "1.0.0",
    "eventTypes": ["created", "resumed", "worktree-created", "node-start", "node-done", "node-failed", "gate-pending", "gate-approved", "gate-rejected", "stage-done", "stage-skipped", "recovery-triggered", "rollback-analyzed", "rollback-triggered", "run-completed"],
    "feedbackFormat": "第x轮反馈：（反馈具体内容）",
    "feedbackScope": "x 为同一 node 在同一 stage 内的否决轮次，从 1 开始递增",
    "rules": [
      "history 只追加不修改",
      "gate-rejected 必须包含 feedback 字段",
      "node-failed 必须包含 note 字段（错误描述）",
      "recovery-triggered 必须包含 target 字段（回退目标阶段）",
      "每个 node-start/node-done 必须包含 stage 和 node 字段"
    ]
  }
}
```

### 2.2 git-worktree 完成后（worktreePath 已设置，延迟产物已刷写）

```json
{
  "runId": "fix-2026-07-13-skill-md-mechanism-improve",
  "workflowId": "standard",
  "configPath": "/Users/user/projects/Ddo-Code-Flow/config.json",
  "workflowPath": "/Users/user/projects/Ddo-Code-Flow/workflows/standard.json",
  "projectRoot": "/Users/user/projects/Ddo-Code-Flow",
  "createdAt": "2026-07-13T12:00:00+08:00",
  "userRequirement": "用户的原始需求文本",
  "worktreePath": "/Users/user/projects/Ddo-Code-Flow-fix-2026-07-13-skill-md-mechanism-improve",
  "type": "fix",
  "dateDescription": "2026-07-13-skill-md-mechanism-improve",
  "currentStage": "spec",
  "stages": {
    "context": { "status": "done", "completedAt": "2026-07-13T12:00:00+08:00" },
    "requirement": { "status": "done", "completedAt": "2026-07-13T12:00:00+08:00" }
  },
  "history": [
    { "event": "created", "at": "2026-07-13T12:00:00+08:00", "note": "workflowId=standard" },
    { "event": "node-start", "stage": "context", "node": "context", "at": "2026-07-13T12:00:01+08:00" },
    { "event": "node-done", "stage": "context", "node": "context", "at": "2026-07-13T12:00:05+08:00" },
    { "event": "stage-done", "stage": "context", "at": "2026-07-13T12:00:05+08:00" },
    { "event": "node-start", "stage": "requirement", "node": "requirement", "at": "2026-07-13T12:00:06+08:00" },
    { "event": "node-done", "stage": "requirement", "node": "requirement", "at": "2026-07-13T12:00:10+08:00" },
    { "event": "node-start", "stage": "requirement", "node": "git-worktree", "at": "2026-07-13T12:00:11+08:00" },
    { "event": "worktree-created", "at": "2026-07-13T12:00:15+08:00", "note": "branch=fix/2026-07-13-skill-md-mechanism-improve" },
    { "event": "node-done", "stage": "requirement", "node": "git-worktree", "at": "2026-07-13T12:00:15+08:00" },
    { "event": "stage-done", "stage": "requirement", "at": "2026-07-13T12:00:15+08:00" }
  ],
  "historyMeta": {
    "version": "1.0.0",
    "eventTypes": ["created", "resumed", "worktree-created", "node-start", "node-done", "node-failed", "gate-pending", "gate-approved", "gate-rejected", "stage-done", "stage-skipped", "recovery-triggered", "rollback-analyzed", "rollback-triggered", "run-completed"],
    "feedbackFormat": "第x轮反馈：（反馈具体内容）",
    "feedbackScope": "x 为同一 node 在同一 stage 内的否决轮次，从 1 开始递增",
    "rules": [
      "history 只追加不修改",
      "gate-rejected 必须包含 feedback 字段",
      "node-failed 必须包含 note 字段（错误描述）",
      "recovery-triggered 必须包含 target 字段（回退目标阶段）",
      "每个 node-start/node-done 必须包含 stage 和 node 字段"
    ]
  }
}
```

### 2.3 运行完成时（所有阶段 done）

```json
{
  "runId": "fix-2026-07-13-skill-md-mechanism-improve",
  "workflowId": "standard",
  "configPath": "/Users/user/projects/Ddo-Code-Flow/config.json",
  "workflowPath": "/Users/user/projects/Ddo-Code-Flow/workflows/standard.json",
  "projectRoot": "/Users/user/projects/Ddo-Code-Flow",
  "createdAt": "2026-07-13T12:00:00+08:00",
  "userRequirement": "用户的原始需求文本",
  "worktreePath": "/Users/user/projects/Ddo-Code-Flow-fix-2026-07-13-skill-md-mechanism-improve",
  "type": "fix",
  "dateDescription": "2026-07-13-skill-md-mechanism-improve",
  "currentStage": "done",
  "stages": {
    "context":      { "status": "done", "completedAt": "2026-07-13T12:00:00+08:00" },
    "requirement":  { "status": "done", "completedAt": "2026-07-13T12:00:00+08:00" },
    "spec":         { "status": "done", "completedAt": "2026-07-13T12:00:00+08:00" },
    "planning":     { "status": "done", "completedAt": "2026-07-13T12:00:00+08:00" },
    "test-plan":    { "status": "done", "completedAt": "2026-07-13T12:00:00+08:00" },
    "tasking":      { "status": "done", "completedAt": "2026-07-13T12:00:00+08:00" },
    "coding":       { "status": "done", "completedAt": "2026-07-13T12:00:00+08:00" },
    "verification": { "status": "done", "completedAt": "2026-07-13T12:00:00+08:00" },
    "reporting":    { "status": "done", "completedAt": "2026-07-13T12:00:00+08:00" },
    "reflection":   { "status": "done", "completedAt": "2026-07-13T12:00:00+08:00" }
  },
  "history": [
    { "event": "created", "at": "2026-07-13T12:00:00+08:00", "note": "workflowId=standard" },
    { "event": "worktree-created", "at": "2026-07-13T12:00:15+08:00", "note": "branch=fix/2026-07-13-skill-md-mechanism-improve" },
    { "event": "node-start", "stage": "spec", "node": "spec", "at": "2026-07-13T12:00:20+08:00" },
    { "event": "node-done", "stage": "spec", "node": "spec", "at": "2026-07-13T12:00:40+08:00" },
    { "event": "gate-pending", "stage": "spec", "node": "spec", "at": "2026-07-13T12:00:40+08:00" },
    { "event": "gate-approved", "stage": "spec", "node": "spec", "at": "2026-07-13T12:01:00+08:00" },
    { "event": "stage-done", "stage": "spec", "at": "2026-07-13T12:01:00+08:00" },
    { "event": "node-start", "stage": "planning", "node": "plan", "at": "2026-07-13T12:01:01+08:00" },
    { "event": "node-done", "stage": "planning", "node": "plan", "at": "2026-07-13T12:02:00+08:00" },
    { "event": "gate-pending", "stage": "planning", "node": "plan", "at": "2026-07-13T12:02:00+08:00" },
    { "event": "gate-approved", "stage": "planning", "node": "plan", "at": "2026-07-13T12:02:30+08:00" },
    { "event": "stage-done", "stage": "planning", "at": "2026-07-13T12:02:30+08:00" },
    { "event": "gate-pending", "stage": "test-plan", "node": "test-plan", "at": "2026-07-13T12:03:00+08:00" },
    { "event": "gate-approved", "stage": "test-plan", "node": "test-plan", "at": "2026-07-13T12:03:30+08:00" },
    { "event": "stage-done", "stage": "test-plan", "at": "2026-07-13T12:03:30+08:00" },
    { "event": "stage-done", "stage": "tasking", "at": "2026-07-13T12:04:00+08:00" },
    { "event": "stage-done", "stage": "coding", "at": "2026-07-13T12:05:00+08:00" },
    { "event": "node-done", "stage": "verification", "node": "verification", "at": "2026-07-13T12:06:00+08:00" },
    { "event": "stage-done", "stage": "verification", "at": "2026-07-13T12:06:00+08:00" },
    { "event": "stage-done", "stage": "reporting", "at": "2026-07-13T12:07:00+08:00" },
    { "event": "gate-pending", "stage": "reflection", "node": "reflection", "at": "2026-07-13T12:07:30+08:00" },
    { "event": "gate-approved", "stage": "reflection", "node": "reflection", "at": "2026-07-13T12:08:00+08:00" },
    { "event": "stage-done", "stage": "reflection", "at": "2026-07-13T12:08:00+08:00" },
    { "event": "run-completed", "at": "2026-07-13T12:08:01+08:00" }
  ]
}
```

### 2.4 恢复旧 run 时（.state.json 已存在，无新字段）

旧版 .state.json 可能没有 `workflowId`、`configPath`、`workflowPath`、`historyMeta` 字段。恢复时 agent 应：
1. 使用 Step 2 解析出的 workflowId
2. 补写缺失字段（workflowId, configPath, workflowPath, historyMeta）
3. 继续执行

```json
{
  "runId": "old-run-id",
  "workflowId": "standard",
  "configPath": "/Users/user/projects/Ddo-Code-Flow/config.json",
  "workflowPath": "/Users/user/projects/Ddo-Code-Flow/workflows/standard.json",
  "projectRoot": "/Users/user/projects/Ddo-Code-Flow",
  "createdAt": "2026-07-10T00:00:00Z",
  "userRequirement": "旧的需求文本",
  "worktreePath": "/Users/user/projects/Ddo-Code-Flow-feat-2026-07-10-old-run",
  "type": "feat",
  "dateDescription": "2026-07-10-old-run",
  "currentStage": "coding",
  "stages": {
    "context": { "status": "done" },
    "requirement": { "status": "done" },
    "spec": { "status": "done" },
    "planning": { "status": "done" },
    "test-plan": { "status": "done" },
    "tasking": { "status": "done" }
  },
  "history": [
    { "event": "created", "at": "2026-07-10T00:00:00Z", "note": "workflowId not set (legacy)" },
    { "event": "resumed", "at": "2026-07-13T12:00:00+08:00", "note": "从 coding 阶段恢复, 补写 workflowId/configPath/workflowPath" }
  ],
  "historyMeta": {
    "version": "1.0.0",
    "eventTypes": ["created", "resumed", "worktree-created", "node-start", "node-done", "node-failed", "gate-pending", "gate-approved", "gate-rejected", "stage-done", "stage-skipped", "recovery-triggered", "rollback-analyzed", "rollback-triggered", "run-completed"],
    "feedbackFormat": "第x轮反馈：（反馈具体内容）",
    "feedbackScope": "x 为同一 node 在同一 stage 内的否决轮次，从 1 开始递增",
    "rules": [
      "history 只追加不修改",
      "gate-rejected 必须包含 feedback 字段",
      "node-failed 必须包含 note 字段（错误描述）",
      "recovery-triggered 必须包含 target 字段（回退目标阶段）",
      "每个 node-start/node-done 必须包含 stage 和 node 字段"
    ]
  }
}
```

### 2.5 字段语义约束

| 字段 | 类型 | 设置时机 | 说明 |
|---|---|---|---|
| `runId` | string \| null | git-worktree 完成后 | 工作树目录名，初始化时为 null |
| `workflowId` | string | **初始化时** ← 本次修复新增 | 解析出的工作流 ID（如 "standard"） |
| `configPath` | string | **初始化时** ← 本次修复新增 | config.json 绝对路径，用于直接恢复时定位配置 |
| `workflowPath` | string | **初始化时** ← 本次修复新增 | 目标 workflow JSON 绝对路径，用于直接恢复时加载工作流 |
| `projectRoot` | string | 初始化时 | 项目根目录绝对路径，用于 skill:// 路径解析 |
| `createdAt` | string | 初始化时 | ISO 8601 时间戳 |
| `userRequirement` | string | 初始化时 | 用户原始需求原文 |
| `worktreePath` | string | git-worktree 完成后 | 工作树绝对路径 |
| `type` | string | git-worktree 完成后 | 分支前缀（feat/fix/chore/...） |
| `dateDescription` | string | git-worktree 完成后 | 日期+描述 slug |
| `currentStage` | string | 全生命周期更新 | 当前所在阶段名 |
| `stages` | object | 全生命周期更新 | 各阶段状态（status + completedAt） |
| `history` | array | 全生命周期追加 | 事件日志，只追加不修改，结构见 §2.6 |
| `historyMeta` | object | **初始化时** ← 本次修复新增 | history 编写规则元信息，见 §2.7 |
| `pendingOutputs` | object | 延迟写入期间 | worktreePath 未设置时暂存 base64 编码的产物 |

### 2.6 history 事件日志规范

#### 2.6.1 事件类型定义

| 事件 | 触发时机 | 必填字段 |
|---|---|---|
| `created` | .state.json 初始化 | — |
| `resumed` | 恢复已有 run | — |
| `worktree-created` | git-worktree 完成 | — |
| `node-start` | atom-task 开始执行 | `stage`, `node` |
| `node-done` | atom-task 执行完成 | `stage`, `node` |
| `node-failed` | atom-task 执行失败 | `stage`, `node`, `note`（错误描述） |
| `gate-pending` | 确认门等待用户输入 | `stage`, `node`（可选） |
| `gate-approved` | 用户确认通过 | `stage`, `node`（可选） |
| `gate-rejected` | 用户否决（含反馈） | `stage`, `node`（可选）, `feedback` |
| `stage-done` | 阶段所有 node 完成 | `stage` |
| `stage-skipped` | 阶段因 entry 为空被跳过 | `stage`, `note` |
| `recovery-triggered` | 验证失败回到 coding | `stage`, `target`（回退目标阶段）, `note` |
| `rollback-analyzed` | agent 分析回滚判断结果 | `stage`, `note`（分析结论） |
| `rollback-triggered` | 跨阶段回滚执行 | `stage`, `target`（回滚目标阶段）, `feedback`, `note` |
| `run-completed` | 最后阶段 done | — |

#### 2.6.2 history 条目结构

```jsonc
{
  "event": "<事件类型>",           // 必填，取值见 §2.6.1
  "at": "<ISO 8601>",             // 必填
  "stage": "<stage-name>",        // 部分事件必填，见上表
  "node": "<node-name>",          // 部分事件必填，见上表
  "note": "<human-readable>",     // 可选，补充说明
  "feedback": "<user feedback>",  // 可选，gate-rejected 时记录用户原文
  "target": "<stage-name>"        // 可选，recovery-triggered 时记录回退目标
}
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `event` | string | ✅ | 事件类型，取值见 §2.6.1 |
| `at` | string | ✅ | ISO 8601 时间戳 |
| `stage` | string | 条件 | 阶段相关事件必填（node-start/done/failed, gate-*, stage-done/skipped, recovery） |
| `node` | string | 条件 | 节点相关事件必填（node-start/done/failed, gate-pending/approved/rejected 时可选） |
| `note` | string | ❌ | 人类可读的补充说明。node-failed 时为错误描述；stage-skipped 时为跳过原因；recovery 时为回退原因 |
| `feedback` | string | ❌ | gate-rejected 时记录用户反馈，格式：`第x轮反馈：（反馈具体内容）`。x 为同一 node 在同一 stage 内的否决轮次，从 1 开始递增 |
| `target` | string | ❌ | recovery-triggered 时记录回退目标阶段名（如 "coding"） |

#### 2.6.3 完整 history 示例（含确认门迭代）

以下示例展示了 spec 阶段经历 2 次否决 + 1 次通过的完整 history：

```json
"history": [
  { "event": "created", "at": "2026-07-13T12:00:00+08:00", "note": "workflowId=standard" },
  { "event": "node-start", "stage": "context", "node": "context", "at": "2026-07-13T12:00:01+08:00" },
  { "event": "node-done", "stage": "context", "node": "context", "at": "2026-07-13T12:00:05+08:00" },
  { "event": "stage-done", "stage": "context", "at": "2026-07-13T12:00:05+08:00" },
  { "event": "node-start", "stage": "requirement", "node": "requirement", "at": "2026-07-13T12:00:06+08:00" },
  { "event": "node-done", "stage": "requirement", "node": "requirement", "at": "2026-07-13T12:00:10+08:00" },
  { "event": "node-start", "stage": "requirement", "node": "git-worktree", "at": "2026-07-13T12:00:11+08:00" },
  { "event": "worktree-created", "at": "2026-07-13T12:00:15+08:00", "note": "branch=fix/2026-07-13-skill-md-mechanism-improve" },
  { "event": "node-done", "stage": "requirement", "node": "git-worktree", "at": "2026-07-13T12:00:15+08:00" },
  { "event": "stage-done", "stage": "requirement", "at": "2026-07-13T12:00:15+08:00" },
  { "event": "node-start", "stage": "spec", "node": "spec", "at": "2026-07-13T12:00:16+08:00" },
  { "event": "node-done", "stage": "spec", "node": "spec", "at": "2026-07-13T12:00:30+08:00" },
  { "event": "gate-pending", "stage": "spec", "node": "spec", "at": "2026-07-13T12:00:30+08:00", "note": "等待用户确认 spec.md" },
  { "event": "gate-rejected", "stage": "spec", "node": "spec", "at": "2026-07-13T12:01:00+08:00", "feedback": "第1轮反馈：验收标准太笼统，需要细化每个维度的检查点" },
  { "event": "node-start", "stage": "spec", "node": "spec", "at": "2026-07-13T12:01:01+08:00", "note": "带反馈重新生成" },
  { "event": "node-done", "stage": "spec", "node": "spec", "at": "2026-07-13T12:01:20+08:00" },
  { "event": "gate-pending", "stage": "spec", "node": "spec", "at": "2026-07-13T12:01:20+08:00", "note": "等待用户确认修订后的 spec.md" },
  { "event": "gate-rejected", "stage": "spec", "node": "spec", "at": "2026-07-13T12:02:00+08:00", "feedback": "第2轮反馈：第三维度'启动精简'的范围描述不准确，应改为合并 Step 1+2" },
  { "event": "node-start", "stage": "spec", "node": "spec", "at": "2026-07-13T12:02:01+08:00", "note": "带反馈重新生成" },
  { "event": "node-done", "stage": "spec", "node": "spec", "at": "2026-07-13T12:02:30+08:00" },
  { "event": "gate-pending", "stage": "spec", "node": "spec", "at": "2026-07-13T12:02:30+08:00", "note": "等待用户确认修订后的 spec.md（第 2 次修订）" },
  { "event": "gate-approved", "stage": "spec", "node": "spec", "at": "2026-07-13T12:03:00+08:00", "note": "用户确认通过" },
  { "event": "stage-done", "stage": "spec", "at": "2026-07-13T12:03:00+08:00" },
  { "event": "node-start", "stage": "planning", "node": "plan", "at": "2026-07-13T12:03:01+08:00" },
  { "event": "node-done", "stage": "planning", "node": "plan", "at": "2026-07-13T12:04:00+08:00" },
  { "event": "gate-pending", "stage": "planning", "node": "plan", "at": "2026-07-13T12:04:00+08:00" },
  { "event": "gate-approved", "stage": "planning", "node": "plan", "at": "2026-07-13T12:04:30+08:00" },
  { "event": "stage-done", "stage": "planning", "at": "2026-07-13T12:04:30+08:00" }
]
```

#### 2.6.4 验证失败回退示例

```json
{ "event": "node-failed", "stage": "verification", "node": "verification", "at": "2026-07-13T13:00:00+08:00", "note": "3/5 checklist items failed" },
{ "event": "recovery-triggered", "stage": "verification", "target": "coding", "at": "2026-07-13T13:00:01+08:00", "note": "verification 失败，回退到 coding 重做" }
```

### 2.7 historyMeta 规范

`historyMeta` 是写在 `.state.json` 初始化时的元信息字段，用于规范 agent 在整个 run 生命周期内如何编写 history。它作为"写入说明书"随 `.state.json` 一起持久化，确保 agent 在任何时刻（包括恢复时）都能读取到 history 的编写规则。

```jsonc
{
  "historyMeta": {
    "version": "1.0.0",                    // history 格式版本
    "eventTypes": [ ... ],                 // 允许的事件类型枚举（见 §2.6.1）
    "feedbackFormat": "第x轮反馈：（反馈具体内容）",  // gate-rejected 的 feedback 字段格式
    "feedbackScope": "x 为同一 node 在同一 stage 内的否决轮次，从 1 开始递增",
    "rules": [                             // agent 必须遵守的编写规则
      "history 只追加不修改",
      "gate-rejected 必须包含 feedback 字段，格式遵循 feedbackFormat",
      "node-failed 必须包含 note 字段（错误描述）",
      "recovery-triggered 必须包含 target 字段（回退目标阶段）",
      "每个 node-start/node-done 必须包含 stage 和 node 字段"
    ]
  }
}
```

**设计意图**：
- historyMeta 随 .state.json 持久化，agent 在恢复时可直接读取规则，无需重新解析 SKILL.md
- feedbackFormat 明确了用户反馈的标准格式（`第x轮反馈：...`），避免 agent 自由发挥
- rules 列表是强制性约束，agent 写入 history 时必须逐条检查

### 2.8 通过 .state.json 直接恢复工作流

**场景**：用户中断了之前的 run，现在直接给 agent 一个 `.state.json` 路径，要求"从这里继续"。

**恢复流程**：
1. Agent 读取 `.state.json`
2. 从 `configPath` 加载 config.json（无需搜索）
3. 从 `workflowPath` 加载 workflow JSON（无需通过 selection.rules 重新解析）
4. 校验 `workflowId` 与 config.workflows.items[] 的一致性
5. 校验 `workflowPath` 文件存在且有效
6. 读取 `historyMeta` 获取 history 编写规则
7. 读取 `currentStage` 确定恢复点
8. 追加 `resumed` 事件到 history
9. 从 `currentStage` 继续执行 pipeline

**优势**：
- 不需要重新执行 Step 1（config 校验）和 Step 2（workflow 解析）
- `.state.json` 是自包含的恢复文件，所有必要信息都在其中
- 用户只需提供一个文件路径即可恢复整个工作流

### 2.9 文档版本归档（_del 目录）

#### 2.9.1 目录结构

```
<worktreePath>/docs/<type>/<dateDescription>/
├── .state.json
├── context-summary.md
├── spec.md                              ← 当前版本
├── plan.md                              ← 当前版本
├── _del/                                ← 归档目录（git-worktree 时创建）
│   ├── spec.md.2026-07-13T12:01:00+08:00.md    ← 旧版本
│   ├── plan.md.2026-07-13T12:05:00+08:00.md    ← 旧版本
│   └── ...
└── ...
```

#### 2.9.2 归档时机

| 场景 | 归档动作 |
|---|---|
| 确认门否决后重新生成 | 归档当前版本，再覆盖 |
| 跨阶段回滚 | 归档回滚目标阶段及下游所有已生成文档 |
| 确认门通过 | **不归档**（已确认的版本不需要归档） |

#### 2.9.3 归档流程

```
1. 判断文档是否需要归档（重大修改 / 回滚）
2. 如果需要：
   a. cp <原文件> _del/<原文件名>.<当前时间戳>.md
   b. 用新内容覆盖原文件
3. 如果不需要（小改动、格式调整）：
   a. 直接覆盖原文件
```

#### 2.9.4 归档文件命名

格式：`<原文件名>.<ISO 8601 时间戳>.md`

示例：
- `spec.md.2026-07-13T12:01:00+08:00.md` — spec 第 1 次修订
- `spec.md.2026-07-13T12:05:00+08:00.md` — spec 第 2 次修订
- `plan.md.2026-07-13T12:10:00+08:00.md` — plan 回滚前版本

### 2.10 确认门跨阶段回滚机制

#### 2.9.1 问题描述

当前 SKILL.md 中，确认门的否决处理仅在同一阶段内循环（plan 被否决 → 重新生成 plan）。但用户反馈可能涉及上游文档的变更：
- 用户在 plan 阶段说"需求范围不对，应该加一个 XX 功能" → 这是 spec 层面的变更
- 用户在 test-plan 阶段说"技术方案要换" → 这是 plan 层面的变更

如果不回滚到上游阶段，会导致 plan 与 spec 不一致。

#### 2.9.2 回滚判断流程

```
用户否决 plan（带反馈）
    │
    ▼
Agent 分析反馈内容
    │
    ├─ 反馈仅涉及技术决策（库选型、架构、算法）
    │   → 在 plan 阶段重新生成 plan，不回滚
    │
    ├─ 反馈涉及 spec 层面（需求范围、FR 增删、AC 修改）
    │   → 回滚到 spec 阶段
    │   → 更新 spec.md（纳入反馈）
    │   → 用户确认 spec
    │   → 重新生成 plan
    │   → 用户确认 plan
    │
    └─ 反馈不明确
        → 向用户询问："这个修改是否需要调整需求规格（spec）？"
```

#### 2.9.3 回滚判断标准

**需要回滚到 spec 的情况**：
- 用户要求增删功能需求（FR-xxx）
- 用户要求修改验收标准（AC-xxx）
- 用户要求调整项目范围（In/Out of Scope）
- 用户要求修改术语定义或项目概述
- 用户说"需求本身有问题"、"spec 不对"

**不需要回滚的情况**（仅在 plan 阶段处理）：
- 用户要求更换技术方案（库、框架、架构模式）
- 用户要求调整实施次序
- 用户要求修改错误处理策略
- 用户说"方案不好"、"换个实现方式"

#### 2.9.4 回滚后的 .state.json 状态变更

回滚时 agent 必须：
1. 将 `currentStage` 回退到目标阶段（如 "spec"）
2. 将目标阶段的 `stages[stage].status` 从 "done" 改为 "in-progress"
3. 将下游阶段的 `stages[stage].status` 清除（因为需要重新执行）
4. 记录 `rollback-triggered` 事件到 history
5. 回滚后重新经过的每个阶段都必须重新走确认门

#### 2.9.5 回滚 history 示例

用户在 plan 阶段要求修改 spec：

```json
"history": [
  { "event": "gate-pending", "stage": "planning", "node": "plan", "at": "2026-07-13T12:04:00+08:00", "note": "等待用户确认 plan.md" },
  { "event": "gate-rejected", "stage": "planning", "node": "plan", "at": "2026-07-13T12:04:30+08:00", "feedback": "第1轮反馈：需要增加一个 FR 关于 workflowId 不匹配时的错误处理" },
  { "event": "rollback-analyzed", "stage": "planning", "at": "2026-07-13T12:04:31+08:00", "note": "反馈涉及新增 FR，需要回滚到 spec 阶段" },
  { "event": "rollback-triggered", "stage": "planning", "target": "spec", "at": "2026-07-13T12:04:32+08:00", "feedback": "第1轮反馈：需要增加一个 FR 关于 workflowId 不匹配时的错误处理" },
  { "event": "node-start", "stage": "spec", "node": "spec", "at": "2026-07-13T12:04:33+08:00", "note": "回滚后重新生成 spec" },
  { "event": "node-done", "stage": "spec", "node": "spec", "at": "2026-07-13T12:05:00+08:00" },
  { "event": "gate-pending", "stage": "spec", "node": "spec", "at": "2026-07-13T12:05:00+08:00", "note": "回滚后等待用户确认修订后的 spec.md" },
  { "event": "gate-approved", "stage": "spec", "node": "spec", "at": "2026-07-13T12:05:30+08:00" },
  { "event": "stage-done", "stage": "spec", "at": "2026-07-13T12:05:30+08:00" },
  { "event": "node-start", "stage": "planning", "node": "plan", "at": "2026-07-13T12:05:31+08:00", "note": "spec 已更新，重新生成 plan" },
  { "event": "node-done", "stage": "planning", "node": "plan", "at": "2026-07-13T12:06:30+08:00" },
  { "event": "gate-pending", "stage": "planning", "node": "plan", "at": "2026-07-13T12:06:30+08:00" },
  { "event": "gate-approved", "stage": "planning", "node": "plan", "at": "2026-07-13T12:07:00+08:00" },
  { "event": "stage-done", "stage": "planning", "at": "2026-07-13T12:07:00+08:00" }
]
```

#### 2.9.6 扩展：test-plan 阶段的回滚

test-plan 阶段的回滚目标可以是 spec 或 plan：
- 用户说"测试用例覆盖不全，漏了 XX 场景" → 可能是 spec 的 AC 不全 → 回滚到 spec
- 用户说"测试方法不对，应该用集成测试" → 可能是 plan 的技术方案问题 → 回滚到 planning
- 用户说"这个功能不需要测试" → 可能是 spec 的范围问题 → 回滚到 spec

---

## 3. 问题分析与修复方案（含优化前后对比）

### 3.1 问题 P-1：步骤编号重复

**优化前**（当前 SKILL.md）：
```
Step 1 — Load and validate
Step 2 — Resolve target workflow
Step 3 — Resolve target directory and initialize state    ← 第一个 Step 3
Step 3 — Execute the pipeline                             ← 第二个 Step 3（编号重复！）
Step 4 — Stage-level failure recovery
Step 5 — Finalize
```

**优化后**：
```
Step 1 — Load and validate
Step 2 — Resolve target workflow
Step 3 — Initialize state and execute pipeline            ← 合并为一个
Step 4 — Stage-level failure recovery
Step 5 — Finalize
```

**变化说明**：将两个 Step 3 合并为一个。原 "Resolve target directory and initialize state" 的内容（路径解析、状态初始化、Metrics deferred）作为 Step 3 的前半部分，原 "Execute the pipeline" 作为 Step 3 的后半部分。路径解析规则表只在合并后的 Step 3 开头出现一次。

---

### 3.2 问题 P-2：.state.json 初始化模板缺少 workflowId

**优化前**（当前 SKILL.md Step 3 模板）：
```json
{
  "runId": null,
  "projectRoot": "<项目根目录绝对路径>",
  "createdAt": "<ISO 8601>",
  "userRequirement": "<verbatim user prompt>",
  "currentStage": "context",
  "stages": {},
  "history": [{ "event": "created", "at": "<ISO 8601>" }]
}
```
同时 Step 2.8 说：`Record workflowId in .state.json`——但此时 .state.json 还不存在（新 run）。

**优化后**：
```json
{
  "runId": null,
  "workflowId": "<resolved workflow id>",
  "projectRoot": "<项目根目录绝对路径>",
  "createdAt": "<ISO 8601>",
  "userRequirement": "<verbatim user prompt>",
  "currentStage": "context",
  "stages": {},
  "history": [{ "event": "created", "at": "<ISO 8601>" }]
}
```
同时删除 Step 2.8 的 "Record workflowId in .state.json"。

**变化说明**：模板创建时就包含 `workflowId`，消除 Step 2 写入时文件不存在的时序矛盾。

---

### 3.3 问题 P-3：Step 1 验证范围过广

**优化前**（当前 SKILL.md Step 1 第 4 步）：
```
4. Validate workflows: For each entry in config.workflows.items[]:
   a. Verify the path file exists and is valid JSON.
   b. Validate against $defs/workflowDefinition in config.schema.json.
   c. Run the DAG no-cycle check on every stage's atomTasks.entry + atomTasks.nodes[*].next.
```
→ 启动时加载并校验 **所有** workflow JSON（lightweight、standard、guarded）

**优化后**：
```
Step 1（只保留引用检查）：
4. Validate that config.workflows.default references an existing workflows.items[].id.
5. Validate that all config.workflows.selection.rules[].workflow references exist in workflows.items[].

Step 2（解析出目标后才加载）：
5. Load the workflow JSON from config.workflows.items[].path for the resolved id.
6. Validate the loaded workflow JSON against $defs/workflowDefinition.
7. Run the DAG no-cycle check on the workflow's pipeline stages.
```
→ 启动时只做 id 引用检查（不加载文件），解析出目标后才加载 **1 个** workflow JSON

**变化说明**：
- 优化前：启动时加载 3 个 workflow 文件 → 只用 1 个
- 优化后：启动时加载 0 个 workflow 文件 → 解析后加载 1 个

---

### 3.4 问题 P-4：恢复逻辑分散

**优化前**：
```
Step 2.7: Resume override — If .state.json already exists and contains a workflowId field,
          use that workflow instead (resuming a previous run should not switch workflows).
Step 2.8: Record workflowId in .state.json.

...（中间隔了 Step 2 的其他内容）...

Step 3.2: Search targetDir for an existing .state.json. If found, read it and resume.
          Append a resumed entry to .state.json.history.
```
→ 恢复逻辑分两处：Step 2.7 管 workflowId 覆盖，Step 3.2 管文件搜索和恢复

**优化后**：
```
Step 3.2: Search targetDir for an existing .state.json (any subdirectory matching
          */docs/*/.state.json). If found:
          a. Read it.
          b. Resume override: if .state.json contains workflowId, use that workflow
             (override Step 2 result). If no workflowId, use Step 2 result and
             write workflowId to .state.json.
          c. Validate workflowId exists in config.workflows.items[].
          d. Resume from currentStage. Append "resumed" to .state.json.history.
          e. Flush pendingOutputs if worktreePath is set.
          If not found: initialize .state.json in memory (with workflowId).
```
→ 恢复逻辑集中在 Step 3 一个连续块中

**变化说明**：
- 优化前：恢复逻辑分散在 Step 2.7 + Step 3.2，中间隔了其他内容
- 优化后：恢复逻辑集中在 Step 3.2，从搜索到恢复到初始化一气呵成

---

### 3.5 问题 P-5：路径解析表重复

**优化前**：路径解析规则表出现两次：
- 第一个 Step 3（"Resolve target directory"）的开头
- 第二个 Step 3（"Execute the pipeline"）的开头

**优化后**：路径解析规则表只在合并后的 Step 3 开头出现一次。

---

## 4. 修改后的 SKILL.md 完整结构

```
Step 1 — Load and validate
  1. Read config.json + config.schema.json
  2. Validate config.json against schema; reject on failure
  3. Auto-migration v2→v3 (if needed)
  4. Validate config.workflows.default references an existing items[].id
  5. Validate all config.workflows.selection.rules[].workflow references exist in items[].id

Step 2 — Resolve target workflow
  1. Read the resolved config.workflows object
  2. Explicit parameter (workflow=, mode=, profile=)
  3. Rule matching (selection.rules, first match wins)
  4. Fallback (fallback: true)
  5. Default (config.workflows.default)
  6. Load the workflow JSON from items[].path
  7. Validate against $defs/workflowDefinition schema
  8. DAG no-cycle check
  9. This is the "active workflow"

Step 3 — Initialize state and execute pipeline
  【路径解析规则表 — 唯一出现位置】

  Part A — Resolve target directory
  1. Resolve targetDir relative to CWD
  2. Search targetDir for existing .state.json
     a. If found:
        - Read it
        - Resume override: if has workflowId → use it; if not → use Step 2 result
        - Validate workflowId exists in config.workflows.items[]
        - Resume from currentStage, append "resumed" to history
        - Flush pendingOutputs if worktreePath is set
     b. If not found: initialize .state.json in memory (with workflowId)
  3. Metrics deferred

  Part B — Execute pipeline
  For each stage in active workflow's pipeline:
    > 渐进式加载: Only load atom-tasks/<name>/<name>.md when entering that node.
    1. Resolve effective DAG (prune disabled nodes)
    2. Topological batching (Kahn's algorithm)
    3. For each layer: load + execute nodes, parallel-approve if needed
    4. Stage-level confirmation gate
    5. Persist state at every transition

Step 4 — Stage-level failure recovery
  Follow recovery instructions in atom-task .md files.

Step 5 — Finalize
  1. Metrics runFinish (if enabled)
  2. Tell user run is complete, point to execution-report.md
```

---

## 5. 实施次序

1. **Task 1**：修改 Step 1 — 删除第 4 步的 workflow 文件全量校验，改为引用完整性检查
2. **Task 2**：修改 Step 2 — 新增 workflow JSON 加载 + schema 校验 + DAG 检查（从 Step 1 移入），删除 Step 2.7 和 2.8
3. **Task 3**：合并两个 Step 3 — 统一为 "Initialize state and execute pipeline"，修复 .state.json 模板（加入 workflowId/configPath/workflowPath/historyMeta），整合恢复逻辑到 Step 3.2
4. **Task 4**：新增 .state.json 直接恢复流程 — SKILL.md 中描述通过 .state.json 路径直接恢复的步骤
5. **Task 5**：新增 history 事件日志规范 — 在 SKILL.md 中定义事件类型、条目结构、historyMeta、feedback 格式
6. **Task 6**：新增文档版本归档机制 — git-worktree 时创建 _del 目录，确认门否决时归档旧文档
7. **Task 7**：新增跨阶段回滚机制 — 回滚判断流程、判断标准、.state.json 状态变更、history 示例
8. **Task 8**：全文检查 — 步骤编号连续、路径解析表只出现一次、交叉引用正确、事件类型列表完整

---

## 6. 与 spec 的开放问题对应表

| spec Open Question | plan 中的落地 |
|---|---|
| Q-1 合并后步骤数量？ | 保持 5 个（合并两个 Step 3 为一个），Step 1+2 不合并以保持职责清晰 |
| Q-2 Step 1 校验 selection.rules 引用是否需要加载 workflow JSON？ | 不加载，只检查 items[].id 存在性；实际加载和校验在 Step 2 |

---

## 7. 用户确认

请确认以下任一选项：

- ✅ **同意**：本 plan 符合预期，可进入 **Test-Planning** 阶段生成 `test-plan.md`。
- ❌ **修改**：请在下方/对话中列出需要调整的章节与意见，AI 将基于反馈重新生成本文档。
