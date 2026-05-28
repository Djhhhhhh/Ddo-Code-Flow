# task-07 — test-plan atom-task + test-plan_template.md（含 cmd:/human: 语法约定）

## 目标
落地 Test-Planning 阶段的 atom-task；模板必须**显式定义** `cmd:` / `human:` 两类 checklist 语法（plan §8.2 决策）。

## 范围
- `skills/ddo-swe/atom-tasks/test-plan/test-plan.json`
- `skills/ddo-swe/atom-tasks/test-plan/test-plan_template.md`

## 依赖
- task-01（schema）

## 关联验收点
- G3.1 / G3.2
- G5.3：Verification 阶段需要按这套语法判定，故模板的语法必须能被 verification atom-task 解析（task-09）。

## 步骤
1. `test-plan.json`：
   - `name = "test-plan"`, `stage = "test-planning"`, `enabled = true`。
   - `description`：基于已确认 spec.md 生成 checklist 形式的 test-plan.md。
   - `io.inputs`: `skill://atom-tasks/test-plan/test-plan_template.md`（required）+ `run://spec.md`（required）。
   - `io.outputs`: `run://test-plan.md`。
   - `prompt.guardrails`：至少含"每条验收项必须为 `- [ ] cmd:` 或 `- [ ] human:` 之一"、"机器项的 cmd 必须可在 targetDir 工作目录中独立执行"、"不混用其它前缀"。
   - `confirmation.required = true`。
2. `test-plan_template.md`：
   - 显式说明 cmd: / human: 两类语法、判定标准（cmd exit code = 0、human 由用户勾选）。
   - 按 group 组织：每个 group 含目标 + checklist + 通过判据。
   - 末尾"最终验收"段含一条 `cmd: tail -n 1 verification.log | grep -q "ALL PASSED"` 标准条目。
   - 同样使用 `{{ placeholder }}`。

## 产物
- `test-plan.json`
- `test-plan_template.md`
