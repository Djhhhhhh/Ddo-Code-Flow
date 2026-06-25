---
name: requirement
version: "1.0.0"
stage: requirement
enabled: true
timeoutSec: 0
concurrency:
  parallelizable: false
confirmation:
  required: false
  rejectAction: regenerate-with-feedback
io:
  inputs: []
  outputs:
    - ref: "run://docs/{type}/{dateDescription}/requirement.md"
      kind: markdown
outputSchemaRef: "skill://atom-tasks/requirement/requirement.output.schema.json"
---

# requirement

> 验证用户需求已明确：检查用户触发 skill 的提示词是否包含足够清晰的需求描述，缺失则暂停流水线并向用户索取。

## 指令

检查用户最近一次触发此 skill 的提示词是否包含清晰、可执行的需求。如果提示词为空、过于模糊、或仅包含 skill 激活短语（如「use ddo-code-flow」），则暂停流水线，要求用户提供具体需求后再继续。否则，将用户需求原文写入 requirement.md 文件，然后进入下一个任务。

## 约束

- 不得改写或总结用户的需求。
- 如果需求不清晰，暂停并询问——不要猜测或继续执行。
