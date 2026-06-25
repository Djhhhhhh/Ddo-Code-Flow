---
name: coding
version: "1.0.0"
stage: coding
enabled: true
timeoutSec: 0
concurrency:
  parallelizable: true
confirmation:
  required: false
  rejectAction: regenerate-with-feedback
io:
  inputs:
    - ref: "run://docs/{type}/{dateDescription}/tasks/task-group.json"
      required: true
    - ref: "run://docs/{type}/{dateDescription}/tasks/"
      required: true
    - ref: "run://docs/{type}/{dateDescription}/plan.md"
      required: true
    - ref: "run://docs/{type}/{dateDescription}/test-plan.md"
      required: true
  outputs:
    - ref: "run://"
      kind: dir
---

# coding

> 按 tasks/task-group.json 的拓扑顺序执行每个 task-NN.md；同层任务可批次化产出（在指令型 runtime 下相当于一次响应输出多文件）。

## 指令

解析 tasks/task-group.json。如果存在 parallelGroups，将其作为批次调度（每个内部数组是一个批次，按顺序执行）；否则通过 dependsOn 对 tasks[] 进行拓扑排序，将同层任务归为一个批次。按顺序处理每个批次：读取批次中的每个 task-NN.md，在 targetDir 中执行所述编辑，并在 .state.json 的对应 task 条目中写入一行完成标记。不得跳过任务。不得编造任务。在批次开始前，如果批次中每个任务都已标记完成，则将其视为无操作跳过。

## 约束

- 从 tasks/ 读取 task-group.json——不要从 run 目录顶层读取。
- 仅操作 targetDir 内的文件；不得修改 skill 本身。
- 保留无关文件；做最小化、有针对性的编辑。
- 当任务失败时，在 .state.json 中记录失败，并仅在通知用户后继续后续批次中的独立任务。
