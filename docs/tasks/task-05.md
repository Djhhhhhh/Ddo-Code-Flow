# task-05 — spec atom-task + spec_template.md

## 目标
落地 Specification 阶段的 atom-task 与其规约模板。

## 范围
- `skills/ddo-swe/atom-tasks/spec/spec.json`
- `skills/ddo-swe/atom-tasks/spec/spec_template.md`

## 依赖
- task-01（schema）

## 关联验收点
- G3.1 / G3.2：子目录、JSON、模板存在与合规。

## 步骤
1. `spec.json`：
   - `name = "spec"`, `stage = "specification"`, `enabled = true`。
   - `description`：基于 requirement.md 与 context 汇总，套用 spec_template 生成 spec.md。
   - `io.inputs`: `skill://atom-tasks/spec/spec_template.md`（required）+ `run://requirement.md`（required）+ `run://context-summary.md`（required: false）。
   - `io.outputs`: `run://spec.md` (`kind: markdown`)。
   - `prompt.instruction`：明确"生成 spec.md，只描述 What/Why 与验收，不写技术方案"。
   - `prompt.guardrails`：至少含"对每条功能需求编号"、"不内嵌实现细节"、"末尾保留用户确认段"。
   - `confirmation.required = true`，`rejectAction = "regenerate-with-feedback"`。
2. `spec_template.md` 以本 skill 自己的 `docs/spec.md` 结构为骨架抽象：
   - § 项目概述 / § 术语表 / § 功能需求（按 stage/模块分组）/ § 产物与目录结构 / § 关键流程 / § 约束与原则 / § 验收标准 / § 非功能需求 / § 范围说明 / § 开放问题 / § 用户确认。
   - 模板里用 `{{ placeholder }}` 标注 AI 需填空的位置；不要把示例文字写死。

## 产物
- `spec.json`
- `spec_template.md`
