# task-04 — 简单 atom-tasks 集合：context / requirement / coding / review

## 目标
落地四个"轻量级"atom-task：它们要么没有模板文件、要么模板很短。

## 范围
- `skills/ddo-swe/atom-tasks/context/context.json`
- `skills/ddo-swe/atom-tasks/requirement/requirement.json`
- `skills/ddo-swe/atom-tasks/coding/coding.json`
- `skills/ddo-swe/atom-tasks/review/review.json`
- `skills/ddo-swe/atom-tasks/review/check-list.md`（review 占位 checklist）

## 依赖
- task-01（schema）

## 关联验收点
- G3.1：四个子目录与 JSON 文件存在。
- G3.2：JSON 字段合规、description 非空、URI 协议正确。

## 步骤
1. 每个 JSON 必填字段对齐 atom-task.schema.json；`name == 目录名`、`stage` 字段如下：
   - context.json: `stage = "context"`
   - requirement.json: `stage = "requirement"`
   - coding.json: `stage = "coding"`，`concurrency.parallelizable = true`
   - review.json: `stage = "review"`，`enabled = false`（默认禁用，spec §FR-REV-1）
2. 写每个 `description` 为简洁中文一句话，描述该 atom-task 做什么。
3. context.json 的 `io.inputs` 引用 `run://../AGENTS.md`、`run://../README.md`、`run://../product.md`，全部 `required: false`；`io.outputs` 引用 `run://context-summary.md`。
4. requirement.json 的 `io.inputs` 引用 `run://../requirement.md`（`required: false`）；`io.outputs` 引用 `run://requirement.md`（统一落到 run 目录内）。
5. coding.json 的 `io.inputs` 引用 `run://tasks/task-group.json` 与 `run://tasks/`；`io.outputs` 为空数组（产物落到 targetDir 的源码）。
6. review.json 的 `io.inputs` 引用 `skill://atom-tasks/review/check-list.md`；`io.outputs` 引用 `run://review-report.md`；`prompt.instruction` 写明"以 sub-agent 形式跑 checklist"。
7. `review/check-list.md` 写一个占位的"代码 review 检查项"框架（5–8 条最常见的工程规范），后续可被用户替换。

## 产物
- 4 个 atom-task JSON + 1 个 check-list.md
