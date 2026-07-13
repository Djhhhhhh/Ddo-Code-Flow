# Task 03: .state.json 直接恢复流程

> 关联验收点：G6（通过 .state.json 直接恢复工作流）

## 目标

在 SKILL.md 中新增通过 .state.json 路径直接恢复工作流的流程描述。

## 修改文件

- `SKILL.md`（主修改文件）

## 具体改动

### 新增 "Direct resume via .state.json" section

在 Step 3 的恢复逻辑之后，新增一个子 section 描述直接恢复流程：

```markdown
**Direct resume via .state.json**: When the user provides a `.state.json` path
directly (e.g., "resume from this .state.json"), the agent can skip Step 1 and Step 2:

1. Read the `.state.json` file.
2. Load `config.json` from `configPath`.
3. Load the workflow JSON from `workflowPath`.
4. Validate `workflowId` matches `config.workflows.items[]`.
5. Validate `workflowPath` file exists and is valid.
6. Read `historyMeta` for history writing rules.
7. Read `currentStage` to determine resume point.
8. Append a `resumed` event to `history`.
9. Continue pipeline execution from `currentStage`.
```

## 验证

- [ ] SKILL.md 中包含 "Direct resume via .state.json" 或类似描述
- [ ] 描述中包含 configPath 和 workflowPath 的使用
- [ ] 描述中包含校验 workflowId 一致性的步骤
