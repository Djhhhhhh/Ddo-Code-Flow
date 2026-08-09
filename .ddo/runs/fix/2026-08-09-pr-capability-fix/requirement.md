# 需求

## 来源
- Issue: https://github.com/Djhhhhhh/Ddo-Code-Flow/issues/32
- 追加需求: 用户消息

## 需求 1: PR 能力修复 (Issue #32)

参考 https://github.com/Djhhhhhh/Ddo-git-push-skill 的 gitpush 结构，设计一份新的 PR metadata 结构，create-pr 原子任务修改为如下流程：
1. 执行 git-push
2. 创建 PR
3. 等待用户确认，用户确认后移除本地 worktree 分支

## 需求 2: --atom 能力 (Issue #32)

skill 提供 `--atom` 能力，可以主动触发原子任务，不需要完全执行流水线。

## 需求 3: 流水线执行描述 bug 修复 (追加)

调用 skill 时支持参数读取，但没有看到流水线开始执行的文字描述。需要在参数解析后显示流水线执行摘要。
