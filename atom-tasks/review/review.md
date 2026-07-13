---
name: review
version: "1.0.0"
stage: review
enabled: false
timeoutSec: 0
concurrency:
  parallelizable: false
confirmation:
  required: false
  rejectAction: regenerate-with-feedback
io:
  inputs:
    - ref: "skill://atom-tasks/review/check-list.md"
      required: true
    - ref: "run://docs/{type}/{dateDescription}/execution-report.md"
      required: false
    - ref: "run://docs/{type}/{dateDescription}/tasks/"
      required: false
  outputs:
    - ref: "run://docs/{type}/{dateDescription}/review-report.md"
      kind: markdown
outputSchemaRef: "skill://atom-tasks/review/review-report.output.schema.json"
---

# review

> 占位的代码/文档复审 atom-task。默认 enabled=false；启用后会以 sub-agent 的方式逐条核对 check-list.md，并产出 review-report.md。

## 指令

生成一个 sub-agent（或将自己视为 sub-agent），逐条遍历 check-list.md。对每个条目，对照产出物（`.state.json.worktreePath` 中的代码和 artifactDir 中的文档）进行评估。将 review-report.md 写入磁盘，每个 checklist 条目一个 section：`## <条目>` 后跟结论（通过/不通过/不适用）和备注。

## 约束

- 不得在此阶段编辑源代码；仅做 review。
- 要具体：引用文件路径和行号来锚定发现。
- 如果 checklist 为空或所有条目都是不适用，写「无适用条目」并继续。
