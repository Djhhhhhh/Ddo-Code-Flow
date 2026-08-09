# Task 02: 修改 git-worktree.md — 添加 CWD 切换步骤和约束

> 关联验收点：G1, G4

## 目标

修改 `atom-tasks/git-worktree/git-worktree.md`，在 worktree 创建完成后指示 agent 切换工作目录，并增加相关约束。

## 改动清单

### 改动 D — 新增指令步骤 11

在当前第 10 步之后追加：

```markdown
11. 切换 agent 工作目录：
    a. 确认 .state.json 中 projectRoot 已正确记录（项目根目录绝对路径）。
    b. 使用 agent 自带的工作目录切换机制将工作目录切换到 worktreePath。例如 Claude Code 使用 EnterWorktree 工具（path 参数指向已创建的 worktree）或 /cd 命令，Codex 使用 --cd 标志。
    c. 切换后用 `pwd` 验证当前目录正确。
```

### 改动 E — 新增约束

在约束列表末尾追加：

```markdown
- git-worktree 完成后，必须将 agent 的工作目录切换到 worktreePath（agent 级别切换，非 Bash cd）。
- .state.json 中必须记录 projectRoot（项目根目录绝对路径）。后续阶段通过 skill:// 前缀加载 atom-task 时，始终基于 projectRoot 解析。
- 不得在主工作树中执行任何文件修改操作。
```

## 验收

- grep -q "切换 agent 工作目录" git-worktree.md
- grep -q "projectRoot" git-worktree.md
- grep -q "EnterWorktree\|--cd\|/cd" git-worktree.md
- grep -q "不得在主工作树中执行任何文件修改操作" git-worktree.md
