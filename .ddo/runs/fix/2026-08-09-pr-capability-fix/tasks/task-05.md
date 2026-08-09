# Task-05: 修改 issue-driven.json done 阶段

## 标题
issue-driven workflow done 阶段添加 cleanup-worktree

## 关联验收点
- G4: cleanup-worktree 原子任务

## 变更文件
- workflows/issue-driven.json

## 依赖
- task-04 (cleanup-worktree.md 必须先存在)

## 具体改动
1. done 阶段的 entry 从 [] 改为 ["cleanup-worktree"]
2. done 阶段的 nodes 添加 cleanup-worktree 节点
