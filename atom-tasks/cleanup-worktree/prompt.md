# cleanup-worktree

> 在流水线结束阶段清理 worktree 与本地分支。仅在 worktree 存在时执行。

## 指令

1. 从 state 读取 `git.worktreePath`（worktree 绝对路径）与 `git.branch`（工作分支；旧形态缺该字段时以 worktree 目录内 `git branch --show-current` 现读）；worktreePath 为空或目录不存在 → 记录「无 worktree 需要清理」，任务完成；
2. 确认当前会话工作目录已不在该 worktree 内；若在，先离开——新拓扑下（worktreePath = projectRoot）run 与全部产物都在 worktree 内，须切回**主检出**（git 仓库根 / 主工作树目录，并非 runDir 的上溯 projectRoot）；**不得**在被清理目录内执行删除；
3. `git worktree remove <worktreePath>`（有未提交变更时先向用户确认是否强制）；
4. 分支合并/放弃由用户决定——默认保留本地分支；**未合并分支不得删除**：仅分支已合并且用户明确要求时 `git branch -d`；用户坚持删除未合并分支须改用 `-D`，并向用户复述该分支名将随删除永久丢弃；
5. 清理结果向用户报告（移除的 worktree、保留/删除的分支）。

## 约束

- 不得删除主工作树；不得操作与本次 run 无关的 worktree；任何 git 失败立即暂停报告。
