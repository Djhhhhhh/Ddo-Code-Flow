# tasking

> 基于 Plan 与 Test Plan 拆分出可独立 review 的任务集，生成任务文件与依赖描述。

## 指令

1. 读取 Context 中的 Plan（split 模式含 manifest 与 current parts）与 Test Plan；
2. 将实现工作拆分为 `tasks/task-01.md`、`task-02.md`…每个任务文件写明：目标、涉及文件、执行步骤、完成标准；
3. 拆分粒度：任务小到可独立 review；一个任务超过约 5 个文件时考虑拆分；
4. 生成 `tasks/task-group.json` 描述任务依赖与批次：`tasks[]`（id、标题、dependsOn），可选用 `parallelGroups`（每内层数组是一个可并行批次）；无 parallelGroups 时由 dependsOn 拓扑分层；
5. 不得编造 Plan/Test Plan 之外的任务；验证类任务须引用 Test Plan 的分组与条目 ID。
