---
name: cleanup-worktree
version: "4.0.0"
enabled: true
timeoutSec: 60
concurrency:
  parallelizable: false
consumes:
  - role: pr-info
    required: false
produces: []
---

# cleanup-worktree

> 在流水线 done 阶段清理 worktree 和本地分支。仅在 worktree 存在时执行清理操作。

## 指令

### 1. 读取状态

从 `.state.json` 读取：
- `worktreePath`: worktree 的绝对路径
- `projectRoot`: 项目根目录（主工作树）
- `runId`: 运行标识

从 `{{inputs.pr-info}}` 或 `.state.json.artifacts.worktree-info` 读取：
- `branchName`: 分支名称

### 2. 检查清理条件

- 如果 `worktreePath` 为 null 或目录不存在，跳过清理并记录「无 worktree 需要清理」。
- 如果 `branchName` 无法获取，跳过分支清理。

### 3. 执行清理

a. 切换到 projectRoot（主工作树）：
   ```
   cd <projectRoot>
   ```

b. 移除 worktree：
   ```
   git worktree remove <worktreePath>
   ```
   如果 worktree 有未提交更改，使用 `--force` 标志。

c. 删除本地分支：
   ```
   git branch -d <branchName>
   ```
   如果分支未合并，使用 `-D` 标志。

### 4. 记录结果

将清理结果写入 `.state.json.history`：
```json
{
  "event": "cleanup-done",
  "at": "<ISO 8601>",
  "note": "worktree=<worktreePath>, branch=<branchName>, status=removed"
}
```

如果清理失败（worktree 不存在、分支已删除等），记录警告但不中断流水线：
```json
{
  "event": "cleanup-skipped",
  "at": "<ISO 8601>",
  "note": "reason=<错误原因>"
}
```

## 约束

- 仅在 worktreePath 和 branchName 都有效时执行清理
- 清理失败不阻断流水线完成（warn 策略）
- 不得修改项目源代码，仅执行 git 清理命令
- 不得在 worktree 内部执行清理（需先切换到 projectRoot）
