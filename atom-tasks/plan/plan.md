---
name: plan
version: "1.0.0"
stage: planning
enabled: true
timeoutSec: 0
concurrency:
  parallelizable: false
confirmation:
  required: true
  rejectAction: regenerate-with-feedback
io:
  inputs:
    - ref: "run://docs/{type}/{dateDescription}/spec.md"
      required: true
    - ref: "run://docs/{type}/{dateDescription}/context-summary.md"
      required: false
  outputs:
    - ref: "run://docs/{type}/{dateDescription}/plan.md"
      kind: markdown
outputSchemaRef: "skill://atom-tasks/plan/plan.output.schema.json"
---

# plan

> 读取已确认的 spec.md，参考 plan.output.schema.json 做技术决策，生成 plan.md。
> 必须给出 spec 中每个 Open Question 一个唯一确定答案；用户确认后方可进入 Test-Planning。

## 指令

读取 spec.md，将每个功能需求转化为技术决策：架构形态、核心 schema、通信机制、文件布局、库选型、风险+缓解。参考 plan.output.schema.json 中的 sections 定义和 example 示例来组织输出格式，每个 section 必须用具体答案填充。末尾追加「Spec 开放问题对应表」，列出 spec 中的每个 Q-N 及其在本 plan 中的解决位置。

## 约束

- spec 中的每个开放问题必须在本 plan 中有且仅有一个确定答案。
- 对每个重大决策，简要写出其权衡，以便未来读者理解选择原因。
- 不得写可执行代码；仅描述 schema、接口和算法。
- 引用 spec 的 FR ID 原文，说明该决策实现了什么。
