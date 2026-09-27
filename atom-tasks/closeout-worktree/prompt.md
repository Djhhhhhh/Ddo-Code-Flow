# closeout-worktree

> 交付链专用收尾：把「产物入库 → run 收口 → 清理 worktree」按结构顺序一次做完。仅用于交付预设（pr-delivery / pr-delivery-issue）末段；开发链清理仍用 cleanup-worktree。

## 指令

前置：读 state 的 `git.worktreePath` 与 `git.branch`（statePath 从本次执行的组装上下文获得）；worktreePath 为空 → 记录「无 worktree 需要清理」，跳过步骤 ⑤⑥，其余步骤照常（完成与收口仍须执行）。另读 `state.ephemeral`：为 true（临时模式，运行材料居 `<home>/tmp/ddo` 项目外）→ 步骤 ①④ 跳过（无物可入库），步骤 ③ 改用临时语义收口，其余照常。

1. **产物入库（保底）**：将本 run 目录（`state.dirs.runDir`）内尚未提交的产物点名提交并推送（`git add <runDir 内产物路径>` → commit → push）——任何 git 失败立即暂停报告（`state.ephemeral` 为 true 时本步骤跳过）；
2. **推进完成**：`next --state <statePath>`——本相位耗尽即 run `completed:true`；**此步骤之后才允许收口**（顺序不变量之一）；
3. **免归档收口**：`run finish --state <statePath> --status done --no-archive`（交付链固定免归档；CLI 报未知旗标时提示用户更新 skill 版本后重试，**不得**改用无旗标收口）；临时模式 run（`state.ephemeral`）改跑 `run finish --state <statePath> --status done`——ephemeral 语义已含免归档并删除 `<home>/tmp/ddo` 下运行材料；
4. **终态入库**：收口已清空 currentStage——再次点名提交并推送 runDir 产物（捕获收口终态，含 .state.json）（`state.ephemeral` 为 true 时本步骤跳过：材料已随收口删除）；
5. **切回主检出**：使用宿主 worktree 切换工具（如 Claude Code 的 ExitWorktree，keep）离开待清理 worktree；**不得**用 `cd` 代替，**不得**在被清理目录内执行删除；
6. **移除 worktree**：在主检出执行 `git worktree remove <worktreePath>`（有未提交变更时先向用户确认是否强制）；本地分支默认保留——未合并分支不得删除，仅分支已合并且用户明确要求时 `git branch -d`；**远程分支永不删除**。

完成后向用户报告：收口结果（正常 `archived:false`；临时模式 `ephemeral:true, deleted:true`）、提交的提交号（临时模式无）、移除的 worktree、保留的本地/远程分支。

## 约束

- 不得删除主工作树；不得操作与本次 run 无关的 worktree。
- 本任务的动作横跨 run 完成边界（步骤 ② 前属 run 内、之后属收尾）——顺序即契约，测试对其有关键词与先后断言。
