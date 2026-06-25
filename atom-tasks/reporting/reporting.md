---
name: reporting
version: "1.0.0"
stage: reporting
enabled: true
timeoutSec: 0
concurrency:
  parallelizable: false
confirmation:
  required: false
  rejectAction: regenerate-with-feedback
io:
  inputs:
    - ref: "run://docs/{type}/{dateDescription}/.state.json"
      required: true
    - ref: "run://docs/{type}/{dateDescription}/verification.log"
      required: false
    - ref: "run://docs/{type}/{dateDescription}/spec.md"
      required: false
    - ref: "run://docs/{type}/{dateDescription}/plan.md"
      required: false
    - ref: "run://docs/{type}/{dateDescription}/test-plan.md"
      required: false
  outputs:
    - ref: "run://docs/{type}/{dateDescription}/execution-report.md"
      kind: markdown
outputSchemaRef: "skill://atom-tasks/reporting/execution-report.output.schema.json"
---

# reporting

> 汇总各阶段产物与 Verification 结果，生成 execution-report.md，引用 spec / plan / test-plan 三份核心文档与本次 run 的关键事件。

## 指令

参考 execution-report.output.schema.json 中的 sections 定义和 example 示例来组织输出格式，填充以下内容：(a) .state.json 中的 run 元数据（runId、createdAt、currentStage、history）；(b) .state.json.stages[*].outputs 中的各阶段产物列表；(c) 从 verification.log 推导的验证摘要（通过/失败计数）；(d) context-summary.md 中的「上下文缺失」列表（如果存在）；(e) spec.md、plan.md、test-plan.md 的显式链接。

## 约束

- 不得编造 .state.json 中不存在的阶段。
- 在「决策日志」section 下原样引用 .state.json.history 条目。
- 如果 verification.log 缺失，在该 section 写「验证未执行」。
