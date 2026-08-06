---
name: reporting
version: "4.0.0"
enabled: true
timeoutSec: 0
concurrency:
  parallelizable: false
confirmation:
  rejectAction: regenerate-with-feedback
consumes:
  - role: verification-log
    required: false
  - role: spec
    required: false
  - role: plan
    required: false
  - role: test-plan
    required: false
  - role: context-summary
    required: false
produces:
  - role: execution-report
    kind: markdown
    primary: true
outputSchemaRef: "skill://atom-tasks/reporting/execution-report.output.schema.json"
---

# reporting

> 汇总各阶段产物与验证结果，生成 execution-report，引用注入的核心文档与本次 run 的关键事件。

## 指令

参考 execution-report.output.schema.json 中的 sections 定义和 example 示例来组织输出格式，填充以下内容：(a) .state.json 中的 run 元数据（runId、createdAt、currentStage、history）；(b) .state.json.artifacts 与 stages 中登记的各阶段产物列表；(c) 从 `{{inputs.verification-log}}` 推导的验证摘要（通过/失败计数）；(d) `{{inputs.context-summary}}` 中的「上下文缺失」列表（如果存在）；(e) `{{inputs.spec}}`、`{{inputs.plan}}`、`{{inputs.test-plan}}` 的显式链接。

## 约束

- 不得编造 .state.json 中不存在的阶段。
- 在「决策日志」section 下原样引用 .state.json.history 条目。
- 如果 verification-log 缺失，在该 section 写「验证未执行」。
