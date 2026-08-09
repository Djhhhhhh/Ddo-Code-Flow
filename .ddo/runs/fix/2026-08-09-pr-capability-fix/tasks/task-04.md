# Task-04: 新增 cleanup-worktree 原子任务

## 标题
创建 cleanup-worktree.md

## 关联验收点
- G4: cleanup-worktree 原子任务

## 变更文件
- atom-tasks/cleanup-worktree/cleanup-worktree.md [新增]

## 具体改动
1. 创建 frontmatter（name, version, enabled, timeoutSec, consumes, produces）
2. 编写指令：读取 state → 切换到 projectRoot → git worktree remove → git branch -d → 记录 history
3. 编写约束
