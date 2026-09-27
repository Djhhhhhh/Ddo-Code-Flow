# 用户需求

> 用户触发此流水线的原始需求描述。

## 原始需求

我现在有个新需求需要额外创建一个workflow用于执行git-push 到 创建指定合并到哪个分支的pr，到最后检查pr合并后，移除本地worktree，但保留远程分支。本次工作也需要创建worktree分支，可以参考 @../Ddo-Code-Flow-feat-worktree-creation-timing/ 的分支结构来创建

## 需求摘要

新增一条交付收尾 workflow 预设：推送特性分支、创建可指定合并目标分支的 PR、确认 PR 合并后移除本地 worktree 但保留远程分支。
