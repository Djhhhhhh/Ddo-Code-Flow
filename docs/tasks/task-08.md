# task-08 — tasking atom-task + task_template.md（含 task-group.json 字段约定）

## 目标
落地 Tasking 阶段的 atom-task；明确产物 `task-group.json` 落在 `tasks/` **内部**（spec §FR-TASK-3 修订点）以及其 schema 字段。

## 范围
- `skills/ddo-swe/atom-tasks/tasking/tasking.json`
- `skills/ddo-swe/atom-tasks/tasking/task_template.md`

## 依赖
- task-01

## 关联验收点
- G3.1 / G3.2
- G4.2 / G4.3：`tasks/` 与 `tasks/task-group.json` 的存在与合规

## 步骤
1. `tasking.json`：
   - `name = "tasking"`, `stage = "tasking"`, `enabled = true`。
   - `description`：基于 plan.md 与 test-plan.md 拆分 task 列表并生成 task-group.json。
   - `io.inputs`: `skill://atom-tasks/tasking/task_template.md`（required）+ `run://plan.md`（required）+ `run://test-plan.md`（required）。
   - `io.outputs`:
     - `run://tasks/task-01.md`（kind: markdown，required，注释中说明"以及更多 task-NN.md"）
     - `run://tasks/task-group.json`（kind: json，required）
   - `prompt.guardrails` 至少含：
     - "task-group.json **必须**位于 `tasks/` 内部，不得放在同级"
     - "每个 task 必须列出：目标 / 范围 / 依赖 / 关联验收点 / 步骤 / 产物"
     - "每个 task 关联到 test-plan 中至少一个 group"
2. `task_template.md`：
   - 单个 task 的章节骨架（目标 / 范围 / 依赖 / 关联验收点 / 步骤 / 产物）。
   - 末尾附 `task-group.json` 的 schema 范例（plan §5.3 中给出的格式：`tasks[].id/file/dependsOn` + 可选 `parallelGroups`）。

## 产物
- `tasking.json`
- `task_template.md`
