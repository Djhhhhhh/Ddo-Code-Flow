# Task 02: .state.json 模板增强与 history 规范

> 关联验收点：G2（.state.json 模板增强）、G5（history 事件日志规范）

## 目标

增强 .state.json 初始化模板，新增 history 事件日志规范 section。

## 修改文件

- `SKILL.md`（主修改文件）

## 具体改动

### 1. 修改 .state.json 初始化模板

在 Step 3 的初始化模板中新增字段：

```json
{
  "runId": null,
  "workflowId": "<resolved workflow id>",
  "configPath": "<config.json 绝对路径>",
  "workflowPath": "<workflow JSON 绝对路径>",
  "projectRoot": "<项目根目录绝对路径>",
  "createdAt": "<ISO 8601>",
  "userRequirement": "<verbatim user prompt>",
  "currentStage": "context",
  "stages": {},
  "history": [{ "event": "created", "at": "<ISO 8601>" }],
  "historyMeta": {
    "version": "1.0.0",
    "eventTypes": ["created", "resumed", "worktree-created", "node-start", "node-done", "node-failed", "gate-pending", "gate-approved", "gate-rejected", "stage-done", "stage-skipped", "recovery-triggered", "rollback-analyzed", "rollback-triggered", "run-completed"],
    "feedbackFormat": "第x轮反馈：（反馈具体内容）",
    "feedbackScope": "x 为同一 node 在同一 stage 内的否决轮次，从 1 开始递增",
    "rules": [
      "history 只追加不修改",
      "gate-rejected 必须包含 feedback 字段，格式遵循 feedbackFormat",
      "node-failed 必须包含 note 字段（错误描述）",
      "recovery-triggered 必须包含 target 字段（回退目标阶段）",
      "每个 node-start/node-done 必须包含 stage 和 node 字段"
    ]
  }
}
```

### 2. 新增 history 事件日志规范 section

在 SKILL.md 的 "Outputs to maintain" 之前，新增一个 section 描述 history 规范：

- 事件类型定义表（15 种事件）
- 条目结构（event, at, stage, node, note, feedback, target）
- feedback 格式规则
- 完整示例（含确认门迭代）

### 3. 新增 historyMeta 说明

在 history 规范 section 中说明 historyMeta 字段的作用和持久化机制。

## 验证

- [ ] grep -q '"workflowId"' SKILL.md
- [ ] grep -q '"configPath"' SKILL.md
- [ ] grep -q '"workflowPath"' SKILL.md
- [ ] grep -q '"historyMeta"' SKILL.md
- [ ] grep -q "gate-pending" SKILL.md
- [ ] grep -q "rollback-triggered" SKILL.md
- [ ] grep -q "第x轮反馈" SKILL.md
