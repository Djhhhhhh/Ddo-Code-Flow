# task-10 — reporting + reflection atom-tasks 及其模板

## 目标
落地最后两个阶段的 atom-task：生成 execution-report.md 与 reflection-report.md。

## 范围
- `skills/ddo-swe/atom-tasks/reporting/reporting.json`
- `skills/ddo-swe/atom-tasks/reporting/execution-report_template.md`
- `skills/ddo-swe/atom-tasks/reflection/reflection.json`
- `skills/ddo-swe/atom-tasks/reflection/reflection-report_template.md`

## 依赖
- task-01

## 关联验收点
- G3.1 / G3.2
- G4.4：两份报告的内容要求

## 步骤
1. `reporting.json`：
   - `name = "reporting"`, `stage = "reporting"`, `enabled = true`。
   - `description`：汇总各阶段产物与 Verification 结果，生成 execution-report.md。
   - `io.inputs`: `skill://atom-tasks/reporting/execution-report_template.md`（required）+ `run://.state.json`（required）+ `run://verification.log`（required: false）+ `run://spec.md` / `plan.md` / `test-plan.md`（required: false）。
   - `io.outputs`: `run://execution-report.md`。
2. `execution-report_template.md` 至少含段落：
   - 本次需求摘要、Run 元信息（runId / createdAt）、各 stage 的产物清单、Verification 结果摘要、Context missing 清单、引用三份核心文档。
3. `reflection.json`：
   - `name = "reflection"`, `stage = "reflection"`, `enabled = true`。
   - `description`：检查 TODO 与未完结流程，生成 reflection-report.md。
   - `io.inputs`: `skill://atom-tasks/reflection/reflection-report_template.md` + `run://execution-report.md` + targetDir 中 TODO 扫描结果。
   - `io.outputs`: `run://reflection-report.md`。
   - `confirmation.required = true`。
4. `reflection-report_template.md` 至少含：未完结 TODO 列表 / 后续建议 / 本次 run 经验。

## 产物
- 4 个文件
