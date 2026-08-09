# 用户需求

> 用户触发此流水线的原始需求描述。

## 原始需求

【Bugfix】git worktree执行后需要agent工具切换到对应的工作目录，防止误修改

## 需求摘要

修复 git-worktree atom-task 执行后 agent 未切换工作目录的 bug，防止后续阶段误修改主工作树文件。
