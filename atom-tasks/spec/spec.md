---
name: spec
version: "1.0.0"
stage: specification
enabled: true
timeoutSec: 0
concurrency:
  parallelizable: false
confirmation:
  required: true
  rejectAction: regenerate-with-feedback
io:
  inputs:
    - ref: "run://docs/{type}/{dateDescription}/context-summary.md"
      required: false
  outputs:
    - ref: "run://docs/{type}/{dateDescription}/spec.md"
      kind: markdown
outputSchemaRef: "skill://atom-tasks/spec/spec.output.schema.json"
---

# spec

> 读取用户原始需求与 context-summary.md，参考 spec.output.schema.json 生成 spec.md。
> spec.md 只描述 What / Why 与验收，不写技术方案；用户确认后方可进入 Planning。

## 指令

参考 spec.output.schema.json 中的 sections 定义和 example 示例来组织输出格式，内容来源于用户的原始需求（触发此 skill 的提示词，在会话上下文中可用）和 context-summary.md（支撑证据）。为每个功能需求编号（如 FR-CTX-1、FR-SPEC-1），使其可被后续阶段（plan / test-plan / tasks）引用。末尾追加标准的「用户确认」section。

当用户提供反馈、选择选项或请求修改 spec 时：
1. 你必须将用户的决定更新到 spec.md 中——将选定的选项合并为单一明确描述，删除被拒绝的替代方案，并纳入所有反馈。
2. 更新后，展示修订后的 spec.md 摘要，并明确要求再次确认（同意/修改）。
3. 不得进入下一阶段，直到用户明确同意（说「同意」、批准或同等明确肯定）。在选项中选择不等于隐式批准——这是需要先更新文档、再获得单独明确批准的反馈。

## 约束

- 不得包含任何实现选择——没有库名、没有框架、没有源代码内部的文件路径。这些属于 plan.md。
- 每个功能需求必须有唯一稳定的 ID。
- 开放问题 section 是必须的；将所有未解决的决策推迟到 plan.md 中回答。
- 保留用户提供的术语原样；不要意译领域术语。
- 关键：向用户展示多个选项/方案时，你必须等待用户选择一个，然后更新 spec.md 反映该选择，然后要求明确批准。永远不要跳过 spec.md 更新步骤。
- 关键：用户在选项中选择是反馈（rejectAction: regenerate-with-feedback），不是隐式批准。始终更新文档并重新确认。
