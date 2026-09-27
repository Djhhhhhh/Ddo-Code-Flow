# 用户需求

> 用户触发此流水线的原始需求描述（来源：GitHub Issue #51）。

## 原始需求

触发输入：`/Ddo-Code-Flow https://github.com/Djhhhhhh/Ddo-Code-Flow/issues/51`

Issue #51（状态 OPEN，标签 enhancement）：

**标题**：【Feature】文件归档能力增强

**正文**：

ddo finish 后将当前任务的 runId目录通过 进行压缩成zip，然后保留到用户根目录的history中保留

## 需求摘要

run finish 时将当前 run 的 runId 目录整体压缩为 zip 归档保留到用户级 history（~/.ddo/history）。
