---
name: tasking
version: "4.0.0"
enabled: true
timeoutSec: 0
concurrency:
  parallelizable: false
confirmation:
  rejectAction: regenerate-with-feedback
consumes:
  - role: plan
    required: true
  - role: test-plan
    required: true
produces:
  - role: tasks-dir
    kind: dir
    primary: true
  - role: task-group
    kind: json
outputSchemaRef: "skill://atom-tasks/tasking/task-group.output.schema.json"
---

# tasking

> 基于 `{{inputs.plan}}` 与 `{{inputs.test-plan}}` 把工作拆为任务目录，并生成 task-group 产物描述任务依赖与并行批次。

## 指令

读取 `{{inputs.plan}}`（决策）和 `{{inputs.test-plan}}`（验收）。参考 task-group.output.schema.json 中的 sections 定义和 example 示例来组织输出格式。生成 tasks-dir 产物，包含 task-01.md、task-02.md、... 每个任务必须遵循 task-group.output.schema.json 中定义的任务格式，并明确引用它覆盖的 test-plan 分组（G1、G2、...）。然后生成 task-group 产物，包含字段 { version, tasks[], parallelGroups? }。每个 tasks[i] 必须有唯一 id「task-NN」、file「task-NN.md」、title 和 dependsOn[]（已有 id 的数组）。可选提供 parallelGroups[]，它是权威的批次调度（覆盖依赖推导的层级分组）。

## 约束

- task-group 产物必须位于任务目录内部——不得写到 artifactDir 顶层。
- 每个任务必须声明「关联验收点」引用 test-plan 分组 ID。
- dependsOn 条目必须是 tasks[] 中实际存在的 id。
- 如果提供了 parallelGroups，每个 task id 必须恰好出现在一个内部数组中。
- 任务应小到可以独立 review；如果一个任务涉及超过约 5 个文件，考虑拆分。
