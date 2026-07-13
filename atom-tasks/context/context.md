---
name: context
version: "1.0.0"
stage: context
enabled: true
timeoutSec: 0
concurrency:
  parallelizable: false
confirmation:
  required: false
  rejectAction: regenerate-with-feedback
io:
  inputs:
    - ref: "run://../AGENTS.md"
      required: false
  outputs:
    - ref: "run://docs/{type}/{dateDescription}/context-summary.md"
      kind: markdown
outputSchemaRef: "skill://atom-tasks/context/context.output.schema.json"
---

# context

> 读取项目基础上下文（AGENTS.md + config.base.contextPaths 中的用户自定义路径）并汇总为 context-summary.md。
> 缺失项不阻断流水线，但记录到执行报告中。产物暂存内存，等 git-worktree 创建运行目录后统一刷写到 worktree。

## 指令

读取 AGENTS.md（默认输入）以及 config.base.contextPaths 中用户配置的额外路径。对于每个缺失的输入（required=false），将其记录到「上下文缺失」列表中。生成 context-summary.md，包含两个 section：「已加载来源」（文件路径 + 一行摘要）和「上下文缺失」（声明了但实际不存在的文件列表）。contextPaths 中的路径相对于本次目标项目的 `projectRoot` 解析；不得相对于工作树父目录 targetDir 解析。

## 约束

- 不得编造不存在的文件内容。
- 当输入是目录而非文件时，递归遍历 depth-3，仅包含 .md/.txt 文件。
- 不要大段复制文件内容；每个来源摘要不超过 8 行。
