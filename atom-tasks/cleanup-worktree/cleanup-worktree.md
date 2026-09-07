---
name: cleanup-worktree
version: "5.0.0"
enabled: true
timeoutSec: 60
concurrency:
  parallelizable: false
confirmation:
  rejectAction: abort
consumes:
  - role: pr-info
    required: false
  - role: worktree-info
    required: true
produces: []
options:
  - key: forceCleanup
    type: boolean
    default: false
    label: "Force cleanup"
    description: "仅在策略明确批准后允许强制移除 dirty worktree 或未合并分支"
---

# cleanup-worktree

> 在 cleanup 阶段安全清理 worktree 和本地分支。成功或安全跳过后由 runtime 完成节点并进入 done。

## 指令

### 1. 读取只读上下文

- 从 runtime 注入值读取项目根目录：`{{runtime.projectRoot}}`。
- 从 `{{inputs.worktree-info}}` 读取 `branchName` 与 `worktreePath`。
- `{{inputs.pr-info}}` 仅用于判断 PR 是否已创建，不承担分支元数据职责。

### 2. 检查清理条件

- worktree 不存在时，记录 `cleanup-skipped`，原因是无需清理。
- branchName 缺失时跳过分支删除并记录原因。
- worktree 有未提交改动或分支尚未合并时，默认安全跳过。

### 3. 执行安全清理

先切换到 `{{runtime.projectRoot}}`，再执行：

```text
git worktree remove <worktreePath>
git branch -d <branchName>
```

默认禁止 `--force` 和 `git branch -D`。只有 `options.forceCleanup=true` 且用户或远端策略已明确批准时才允许强制操作。

### 4. 记录并完成

- 成功时调用 runtime `record-cleanup-result --status done`。
- dirty worktree、未合并分支或无需清理时调用 `record-cleanup-result --status skipped --reason <原因>`。
- 随后调用 `complete-node --node cleanup-worktree --stage cleanup`。
- 路径校验错误或 runtime 状态损坏时不得假装完成。

## 约束

- 不得删除 `projectRoot`。
- 不得在待删除 worktree 内执行清理。
- 分支删除前必须确认 PR 已创建或分支已合并。
- 安全跳过不阻断 run，但必须留下可审计记录。
- 不得修改项目源代码。
