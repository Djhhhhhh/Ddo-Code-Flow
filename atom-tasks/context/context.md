---
name: context
version: "4.0.0"
enabled: true
timeoutSec: 0
concurrency:
  parallelizable: false
confirmation:
  rejectAction: regenerate-with-feedback
produces:
  - role: context-summary
    kind: markdown
    primary: true
outputSchemaRef: "skill://atom-tasks/context/context.output.schema.json"
---

# context

> 读取项目基础上下文（AGENTS.md + 有效配置中的 contextPaths）并汇总为 context-summary 角色。
> 缺失项不阻断流水线，但记录到执行报告中。产物在 worktree 建立前交由 runtime 延迟登记。

## 指令

读取项目根目录的 AGENTS.md（若存在）以及 runtime 注入的 contextPaths。对于每个缺失的输入，将其记录到「上下文缺失」列表中。生成 context-summary 产物，包含两个 section：「已加载来源」（文件路径 + 一行摘要）和「上下文缺失」（声明了但实际不存在的文件列表）。contextPaths 中的路径相对于本次目标项目的 `projectRoot` 解析；不得相对于 worktree 目标目录解析。

## 约束

- 不得编造不存在的文件内容。
- 当输入是目录而非文件时，递归遍历 depth-3，仅包含 .md/.txt 文件。
- 不要大段复制文件内容；每个来源摘要不超过 8 行。
