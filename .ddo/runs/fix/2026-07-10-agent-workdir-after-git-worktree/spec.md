# 用户需求

> 用户触发此流水线的原始需求描述。

## 原始需求

【Bugfix】git worktree执行后需要agent工具切换到对应的工作目录，防止误修改

## 需求摘要

修复 git-worktree atom-task 执行后 agent 未切换工作目录的 bug，防止后续阶段误修改主工作树文件。

---

# 功能规格

## 背景

Ddo-Code-Flow 流水线在 requirement 阶段通过 `git-worktree` atom-task 创建一个隔离的 git worktree 目录，后续所有产物（spec.md、plan.md、代码修改等）都应在此 worktree 中进行。

当前实现中，`git-worktree.md` 的指令完成了以下工作：
1. 创建 git 分支和 worktree 目录
2. 创建产物子目录 `docs/<type>/<dateDescription>/`
3. 写入 worktree-info.json 和 .state.json
4. 刷写延迟产物

**但缺少关键一步**：没有指示 agent 将工作目录切换到 worktree 路径。这导致：
- 后续阶段的 `Bash` 命令默认在项目根目录执行
- `coding` 阶段可能意外修改主工作树中的源文件
- `verification` 阶段的测试命令可能在错误的目录运行

## 功能需求

### FR-GW-1: git-worktree 执行后切换工作目录

`git-worktree.md` 的指令中必须增加一个明确步骤，在所有产物写入完成后，指示 agent 将后续操作的工作目录切换到 `worktreePath`。

**具体行为**：
- 在指令末尾（当前第 10 步之后）新增第 11 步
- 该步骤明确告知 agent：使用 agent 自带的工作目录切换机制（如 Claude Code 的 EnterWorktree、Codex 的 --cd）将工作目录切换到 `worktreePath`
- 切换发生在 agent 层面，影响所有工具（Read/Write/Edit/Bash）的路径解析

### FR-GW-2: 增加工作目录验证约束

在 `git-worktree.md` 的约束中增加一条：后续阶段开始时应验证当前工作目录是否在 worktree 内，防止误操作。

### FR-GW-3: skill 主文件增加工作目录提醒

在 `.claude/skills/Ddo-Code-Flow/SKILL.md` 的流水线执行段落中，增加关于工作目录切换的说明，确保 agent 在 git-worktree 完成后意识到需要切换目录。

### FR-GW-4: skill 文件在 CWD 切换后仍可访问

切换工作目录到 worktree 后，agent 的 CWD 变为 worktree 目录。但 `.gitignore` 排除了 `.claude/`、`.agent/` 等目录，worktree 中没有这些文件。流水线采用渐进式加载（进入 node 时才读取 `atom-tasks/<name>/<name>.md`），如果 skill 文件不可访问，后续阶段将无法执行。

**解决方案**：
- 在 `.state.json` 中记录 `projectRoot`（项目根目录绝对路径，即 git 仓库根目录）
- `skill://` 前缀的路径始终基于 `projectRoot` 解析，不依赖 agent 的当前工作目录
- `run://` 前缀的路径基于 `worktreePath` 解析（不变）

## 验收标准

- [ ] AC-GW-1: git-worktree.md 指令包含明确的工作目录切换步骤
- [ ] AC-GW-2: git-worktree.md 约束包含工作目录验证要求
- [ ] AC-GW-3: SKILL.md 在流水线执行段落提及工作目录切换
- [ ] AC-GW-4: 修改后的指令清晰、无歧义，agent 可直接遵循
- [ ] AC-GW-5: .state.json 中记录 projectRoot，skill:// 路径基于 projectRoot 解析
- [ ] AC-GW-6: Ddo-Code-Flow.md 的 Path resolution rules 明确 skill:// 的解析基准为 projectRoot

## 开放问题

- Q-1: 工作目录切换应该通过 Bash `cd`、agent 原生切换机制、还是绝对路径？→ 采用 agent 原生切换机制（EnterWorktree / --cd），影响所有工具的路径解析，最彻底。
- Q-2: CWD 切换后如何保证 skill 文件（atom-tasks、config 等）仍可访问？→ 在 .state.json 中记录 projectRoot 绝对路径，skill:// 始终基于 projectRoot 解析。
