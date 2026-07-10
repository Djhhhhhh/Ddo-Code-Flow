# Task 02: 创建 3 个 Workflow 定义文件

> 关联验收点：G1（Workflow 定义文件存在性）、G3（DAG 无环校验）

## 目标

在 `workflows/` 目录下创建 `lightweight.json`、`standard.json`、`guarded.json`，每个文件自包含 pipeline、confirmationGates 和 atomTaskOverrides。

## 变更文件

- `workflows/lightweight.json`（新建）
- `workflows/standard.json`（新建）
- `workflows/guarded.json`（新建）

## 具体改动

### 1. workflows/standard.json

默认完整流水线，复用现有 12 阶段 pipeline 结构（从当前 config.json 的 pipeline 字段复制）：

- stages: context → requirement → spec → planning → test-plan → tasking → coding → verification → review → reporting → reflection → done
- confirmationGates: ["spec", "planning", "test-plan", "reflection"]
- atomTaskOverrides: { "test-plan": { "enabled": true, "tdd": true } }

### 2. workflows/lightweight.json

轻量模式，跳过 test-plan 和 tasking 阶段：

- stages: context → requirement → spec → planning → coding → verification → reporting → reflection → done
- confirmationGates: ["spec", "planning", "reflection"]
- atomTaskOverrides: {}

### 3. workflows/guarded.json

加强复审模式，在 standard 基础上启用 review 阶段：

- stages: context → requirement → spec → planning → test-plan → tasking → coding → verification → review → reporting → reflection → done
- confirmationGates: ["spec", "planning", "test-plan", "reflection"]
- atomTaskOverrides: { "review": { "enabled": true }, "test-plan": { "enabled": true, "tdd": true } }

## 约束

- 每个 workflow JSON 的 pipeline 中 stage DAG 必须无环。
- 只引用现有 atom-task：context、requirement、git-worktree、spec、plan、test-plan、tasking、coding、verification、review、reporting、reflection。
- 每个文件需包含 `$schema` 指向 `config.schema.json#/$defs/workflowDefinition`。
- stage 结构（atomTasks.entry、nodes、next、parallelApprove、parallelWith）必须与现有 config.json pipeline 一致。
