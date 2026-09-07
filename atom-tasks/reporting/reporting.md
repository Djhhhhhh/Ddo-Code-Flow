---
name: reporting
version: "5.0.0"
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

参考 execution-report.output.schema.json 中的 sections 定义和 example 示例来组织输出格式。使用 `{{runtime.runId}}`、`{{runtime.runType}}`、`{{runtime.projectRoot}}`、`{{runtime.createdAt}}`、`{{runtime.stages}}`、`{{runtime.artifacts}}` 与 `{{runtime.history}}` 填充真实 run 元数据，并从 `{{inputs.verification-log}}`、`{{inputs.context-summary}}`、`{{inputs.spec}}`、`{{inputs.plan}}`、`{{inputs.test-plan}}` 得到摘要和链接。

## 约束

- 不得编造 runtime stages、artifacts 或 history 中不存在的阶段与事件。
- 在「决策日志」section 下原样引用 `{{runtime.history}}` 中的条目；没有可用条目时明确写“无”。
- 如果 verification-log 缺失，在该 section 写「验证未执行」。
