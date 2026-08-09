---
name: git-worktree
version: "4.0.0"
enabled: true
timeoutSec: 60
concurrency:
  parallelizable: false
confirmation:
  rejectAction: abort
consumes:
  - role: requirement
    required: true
produces:
  - role: worktree-info
    kind: json
    primary: true
outputSchemaRef: "skill://atom-tasks/git-worktree/worktree-info.output.schema.json"
---

# git-worktree

> 基于 requirement 产物创建 git 分支与工作树：从需求文本提取关键词生成分支名，创建工作树目录，将后续流水线的工作目录切换到该工作树，并触发 runtime 刷写延迟产物。

## 指令

1. 使用 runtime 注入的有效配置和内置分支规则生成分支命名参数。
2. 从 `{{inputs.requirement}}` 提取描述性关键词（跳过激活关键词如「use ddo-code-flow」），转换为 kebab-case：小写、去除特殊字符、空格转连字符。截断到 50 字符。如果提取失败，使用分支规则中的 descriptionFallback。
3. 根据 run 参数决定前缀：`--feature` 使用 feat，`--bugfix` 使用 fix；均未指定时使用有效配置中的 defaultRunType。生成分支名并记录 type 与 dateDescription：
   - type = 第一个 / 之前的部分（如 feat/2026-06-24-add-dark-mode 中的 feat）
   - dateDescription = 第一个 / 之后的部分（如 2026-06-24-add-dark-mode）
4. 计算工作树目录名和路径：
   a. 获取项目名：项目根目录的 basename（如 Ddo-Code-Flow）。
   b. 工作树目录名 = <项目名>-<分支名（/ 替换为 -）>。示例：分支 feat/2026-06-24-add-dark-mode → 工作树目录 Ddo-Code-Flow-feat-2026-06-24-add-dark-mode。
   c. 工作树路径 = 有效配置的 worktreeDir（空值表示项目父目录）追加工作树目录名。
   d. runId = 工作树目录名；记录 dateDescription（如 2026-06-24-add-dark-mode）——用于产物子目录。
5. 如果 reuseExisting 为 true，检查是否已存在该分支的工作树（通过 git worktree list）。如果找到，复用它——写入 worktree-info 产物并更新 .state.json。
6. 否则，创建分支和工作树：
   a. 从 baseRef 执行 git branch <branch-name>。如果分支已存在，追加 -2、-3 直到唯一。
   b. 执行 git worktree add <worktree-path> <branch-name>。
   c. 验证命令成功（exit code 0 且目录存在）。
7. 在 worktree 中创建 `.ddo/runs/<type>/<dateDescription>/` 产物目录，并确保项目级 `.ddo/config.json` 与 `.ddo/runs/` 已被引导创建；不得覆盖用户已有配置。
8. 写入 worktree-info 产物（见 output schema），其中必须包含 runId、branchName、worktreePath、worktreeDir、type、dateDescription、baseRef、createdAt。
9. 写入 .state.json：设置 `runId=<项目名>-<分支名（/ 替换为 -）>`、worktreePath 为绝对路径、type 为分支前缀、dateDescription 为日期描述 slug，并设置 `artifactDir=<worktreePath>/.ddo/runs/<type>/<dateDescription>`。同时请求 runtime 刷写 delayed outputs 与 artifact blackboard。
10. 切换 agent 工作目录：
    a. 确认 .state.json 中 projectRoot 已正确记录（目标 Git 仓库根目录绝对路径），且 skillRoot 指向只读的 skill 目录。
    b. **必须**使用 agent 自带的 EnterWorktree 工具将工作目录切换到 worktreePath。例如 Claude Code 使用 EnterWorktree 工具（path 参数指向已创建的 worktree），Codex 使用 --cd 标志。**不得**使用 Bash cd 命令切换工作目录。
    c. 切换后用 `pwd` 验证当前目录正确。

## 约束

- 不得修改主工作树中的任何文件；仅在新工作树上操作。
- 始终验证 git worktree add 成功（exit code 0）后再继续。
- 如果 git 命令失败（不是 git 仓库、dirty worktree 等），暂停并报告错误——不要继续流水线。
- worktreePath 必须是绝对路径。
- runId 必须在 git-worktree 完成时从项目名和最终分支名确定；不得保持 null。
- 工作树目录名必须是 <项目名>-<分支名>（斜杠替换为连字符），位于 worktreeDir 目标目录下；未配置 worktreeDir 时与项目根目录同级。
- 产物子目录必须是 <worktreePath>/.ddo/runs/<type>/<dateDescription>/。`.state.json`、`worktree-info.json` 和所有已登记产物都放在这里。
- 不得直接在 worktreeDir、worktreePath 或 worktreePath/.ddo/ 下写入未登记产物。
- git-worktree 完成后，必须将 agent 的工作目录切换到 worktreePath（agent 级别切换，非 Bash cd）。
- .state.json 中必须记录 projectRoot 与 worktreePath 两个绝对锚点，记录 skillName/skillVersion，并将 skillRoot 作为 hint。后续阶段按 skillName 重新解析 skill 位置；代码读写和项目命令始终基于 worktreePath。
- 不得在主工作树中执行任何文件修改操作。
