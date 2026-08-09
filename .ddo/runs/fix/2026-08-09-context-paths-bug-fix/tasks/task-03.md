# Task-03: 修改 git-worktree.md

## 标题

修改 git-worktree.md 明确 EnterWorktree 工具使用要求

## 关联验收点

- G4: EnterWorktree 工具说明 (AC-4, FR-4)

## 变更文件

- atom-tasks/git-worktree/git-worktree.md

## 变更内容

### 1. 修改步骤 10（第 44-48 行）

**当前内容**:
```
10. 切换 agent 工作目录：
    a. 确认 .state.json 中 projectRoot 已正确记录（目标 Git 仓库根目录绝对路径），且 skillRoot 指向只读的 skill 目录。
    b. 使用 agent 自带的工作目录切换机制将工作目录切换到 worktreePath。例如 Claude Code 使用 EnterWorktree 工具（path 参数指向已创建的 worktree）或 /cd 命令，Codex 使用 --cd 标志。
    c. 切换后用 `pwd` 验证当前目录正确。
```

**修改为**:
```
10. 切换 agent 工作目录：
    a. 确认 .state.json 中 projectRoot 已正确记录（目标 Git 仓库根目录绝对路径），且 skillRoot 指向只读的 skill 目录。
    b. **必须**使用 agent 自带的 EnterWorktree 工具将工作目录切换到 worktreePath。例如 Claude Code 使用 EnterWorktree 工具（path 参数指向已创建的 worktree），Codex 使用 --cd 标志。**不得**使用 Bash cd 命令切换工作目录。
    c. 切换后用 `pwd` 验证当前目录正确。
```

## 验收标准

- [ ] cmd: grep -q "EnterWorktree" atom-tasks/git-worktree/git-worktree.md
- [ ] cmd: grep -q "必须" atom-tasks/git-worktree/git-worktree.md
- [ ] cmd: grep -q "不得.*Bash cd" atom-tasks/git-worktree/git-worktree.md
