# task-06 — plan atom-task + plan_template.md

## 目标
落地 Planning 阶段的 atom-task 与技术方案模板。

## 范围
- `skills/ddo-swe/atom-tasks/plan/plan.json`
- `skills/ddo-swe/atom-tasks/plan/plan_template.md`

## 依赖
- task-01（schema）

## 关联验收点
- G3.1 / G3.2

## 步骤
1. `plan.json`：
   - `name = "plan"`, `stage = "planning"`, `enabled = true`。
   - `description`：基于已确认 spec.md 做技术决策，生成 plan.md。
   - `io.inputs`: `skill://atom-tasks/plan/plan_template.md`（required）+ `run://spec.md`（required）+ `run://context-summary.md`（required: false）。
   - `io.outputs`: `run://plan.md`。
   - `prompt.guardrails`：至少含"必须给 spec 中所有 Open Question 一个唯一确定答案"、"对每项决策写明取舍"、"不写代码"。
   - `confirmation.required = true`。
2. `plan_template.md` 以本 skill `docs/plan.md` 的结构为骨架：
   - § 决策原则 / § 整体架构 / § 关键 schema 设计 / § 状态机 / § 确认门与回退 / § UI 设计（若适用）/ § 风险与权衡 / § 实施次序 / § 与 spec 开放问题对应表 / § 用户确认。
   - 同样用 `{{ placeholder }}` 标记。

## 产物
- `plan.json`
- `plan_template.md`
