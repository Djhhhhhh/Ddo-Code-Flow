# Task 01: SKILL.md 步骤结构修复

> 关联验收点：G1（步骤编号与结构修复）、G3（Step 1 验证范围收窄）、G4（恢复逻辑整合）

## 目标

修复 SKILL.md 的步骤结构问题：合并两个 Step 3、收窄 Step 1 验证范围、将 workflow 校验移入 Step 2、整合恢复逻辑。

## 修改文件

- `SKILL.md`（主修改文件）

## 具体改动

### 1. 修改 Step 1 — 删除 workflow 文件全量校验

**删除** Step 1 中的第 4 步（遍历校验 workflows.items[]）。

**替换为**：
```
4. Validate that `config.workflows.default` references an existing `workflows.items[].id`.
5. Validate that all `config.workflows.selection.rules[].workflow` references exist in `workflows.items[]`.
```

### 2. 修改 Step 2 — 移入 workflow 校验，删除旧恢复逻辑

在 Step 2 的第 6 步（Load the workflow JSON）之后，新增：
```
7. Validate the loaded workflow JSON against `$defs/workflowDefinition` in `config.schema.json`.
8. Run the DAG no-cycle check on every stage's `atomTasks.entry` + `atomTasks.nodes[*].next`. Reject and abort on any cycle.
9. This is the **active workflow**.
```

**删除**原 Step 2 的第 7 步（Resume override）和第 8 步（Record workflowId）。

### 3. 合并两个 Step 3

将原 Step 3（"Resolve target directory and initialize state"）和 Step 3（"Execute the pipeline"）合并为一个 "Step 3 — Initialize state and execute pipeline"。

路径解析规则表只在合并后的 Step 3 开头出现一次（删除原第一个 Step 3 中的重复）。

### 4. 整合恢复逻辑到 Step 3

在合并后的 Step 3 中，将恢复逻辑集中处理：
```
2. Search targetDir for an existing .state.json
   a. If found:
      - Read it
      - Resume override: if .state.json contains workflowId → use it; if not → use Step 2 result
      - Validate workflowId exists in config.workflows.items[]
      - Resume from currentStage, append "resumed" to history
      - Flush pendingOutputs if worktreePath is set
   b. If not found: initialize .state.json in memory
```

### 5. 重编号

确认全文步骤编号连续：Step 1 → Step 2 → Step 3 → Step 4 → Step 5。

## 验证

- [ ] grep -c "^### Step [0-9]" SKILL.md 输出 5
- [ ] grep "^### Step" SKILL.md | sort | uniq -d 无输出
- [ ] Step 1 中不再有 "For each entry in config.workflows.items[]"
- [ ] Step 2 中包含 "Validate the loaded workflow JSON" 和 "DAG no-cycle check"
- [ ] Step 2 中不再有 "Resume override" 和 "Record workflowId"
- [ ] 路径解析规则表只出现一次
