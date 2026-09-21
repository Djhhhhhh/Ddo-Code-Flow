# cleanup-worktree

> 在流水线结束阶段清理 worktree 与本地分支。仅在 worktree 存在时执行。

## 指令

1. 从 state 读取 `git.worktreePath`（worktree 绝对路径）与分支信息（git.developmentBranch）；worktreePath 为空或目录不存在 → 记录「无 worktree 需要清理」，任务完成；
2. 确认当前会话工作目录已不在该 worktree 内；若在，先切回项目根（主工作树），**不得**在被清理目录内执行删除；
3. `git worktree remove <worktreePath>`（有未提交变更时先向用户确认是否强制）；
4. 分支合并/放弃由用户决定——默认保留本地分支，仅在用户明确要求时 `git branch -d`；
5. 清理结果向用户报告（移除的 worktree、保留的分支）。

## 约束

- 不得删除主工作树；不得操作与本次 run 无关的 worktree；任何 git 失败立即暂停报告。
