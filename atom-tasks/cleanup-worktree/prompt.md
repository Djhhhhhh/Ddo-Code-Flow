# cleanup-worktree

> 在流水线结束阶段清理 worktree 与本地分支。仅在 worktree 存在时执行。

## 指令

1. 从 state 读取 `git.worktreePath`（worktree 绝对路径）与 `git.branch`（工作分支；旧形态缺该字段时以 worktree 目录内 `git branch --show-current` 现读）；worktreePath 为空或目录不存在 → 记录「无 worktree 需要清理」，任务完成；
2. 确认当前会话工作目录已不在该 worktree 内；若在，先离开——新拓扑下（worktreePath = projectRoot）run 与全部产物都在 worktree 内，须切回**主检出**（git 仓库根 / 主工作树目录，并非 runDir 的上溯 projectRoot）；**不得**在被清理目录内执行删除；
3. `git worktree remove <worktreePath>`（有未提交变更时先向用户确认是否强制）；
4. 分支合并/放弃由用户决定——默认保留本地分支；**未合并分支不得删除**：仅分支已合并且用户明确要求时 `git branch -d`；用户坚持删除未合并分支须改用 `-D`，并向用户复述该分支名将随删除永久丢弃；
5. 清理结果向用户报告（移除的 worktree、保留/删除的分支）。

## 多仓库形态（`state.git.multiRepo` 为 true 时）

1. 会话仍在任一 worktree 内时，先以宿主 worktree 切换工具（如 ExitWorktree，keep）离开，回到主仓库主检出；**不得**用 `cd` 代替，**不得**在任何待清理目录内执行删除；
2. 按 `state.git.repos` 顺序逐仓库：`git -C <repos[i].repoPath> worktree remove <repos[i].worktreePath>`（任一仓库有未提交变更时先向用户确认是否强制）；分支规则逐仓库同上（默认保留本地分支；未合并分支不得删除；远程分支永不删除）；
3. 全部移除后向用户询问容器处置：**保留容器目录**（缺省——`.ddo` 产物留存磁盘）或删除整个容器（材料丢弃，须用户明确确认）；
4. 清理结果向用户报告（逐仓库移除结果、保留/删除的分支、容器处置结果）。

## 约束

- 不得删除任何仓库的主检出（主工作树）；不得操作与本次 run 无关的 worktree；任何 git 失败立即暂停报告。
