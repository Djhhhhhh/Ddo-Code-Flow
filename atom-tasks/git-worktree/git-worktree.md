---
name: git-worktree
version: "1.0.0"
stage: requirement
enabled: true
timeoutSec: 60
concurrency:
  parallelizable: false
confirmation:
  required: false
  rejectAction: abort
io:
  inputs:
    - ref: "skill://atom-tasks/git-worktree/branch-rules.json"
      required: true
    - ref: "skill://config.json"
      required: true
  outputs:
    - ref: "run://docs/{type}/{dateDescription}/worktree-info.json"
      kind: json
outputSchemaRef: "skill://atom-tasks/git-worktree/worktree-info.output.schema.json"
---

# git-worktree

> 基于用户需求创建 git 分支与工作树：从用户原始提示词提取关键词生成分支名，创建工作树目录（即本次 run 的运行目录），将后续流水线的工作目录切换到该工作树，并刷写 context 和 requirement 阶段的延迟产物到 worktree。

## 指令

1. 读取 skill://atom-tasks/git-worktree/branch-rules.json 获取分支命名模板和配置。
2. 读取 skill://config.json 获取 base.targetDir 设置。
3. 从用户原始提示词中提取描述性关键词（跳过激活关键词如「use ddo-code-flow」），转换为 kebab-case：小写、去除特殊字符、空格转连字符。截断到 50 字符。如果提取失败，使用 branch-rules.json 的 defaults.descriptionFallback。
4. 生成分支名：将模板中的占位符替换为实际值——{prefix} → defaults.prefix，{date} → 当天日期（YYYY-MM-DD），{description} → 提取的 slug。用 defaults.separator 连接。截断到 defaults.maxBranchNameLength。记录 {prefix} 值为「type」（如 feat、fix、chore、docs、refactor、test、perf、ci、build）。同时从分支名中派生两个值：
   - type = 第一个 / 之前的部分（如 feat/2026-06-24-add-dark-mode 中的 feat）
   - dateDescription = 第一个 / 之后的部分（如 2026-06-24-add-dark-mode）
5. 计算工作树目录名和路径：
   a. 获取项目名：项目根目录的 basename（如 Ddo-Code-Flow）。
   b. 工作树目录名 = <项目名>-<分支名（/ 替换为 -）>。示例：分支 feat/2026-06-24-add-dark-mode → 工作树目录 Ddo-Code-Flow-feat-2026-06-24-add-dark-mode。
   c. 工作树路径 = 相对于项目根目录解析 base.targetDir，然后追加工作树目录名。示例：targetDir='..' → '../Ddo-Code-Flow-feat-2026-06-24-add-dark-mode'（项目根目录的兄弟目录）。
   d. 记录 dateDescription（如 2026-06-24-add-dark-mode）——用于产物子目录。
6. 如果 reuseExisting 为 true，检查是否已存在该分支的工作树（通过 git worktree list）。如果找到，复用它——写入 worktree-info.json 并更新 .state.json。
7. 否则，创建分支和工作树：
   a. 从 baseRef 执行 git branch <branch-name>。如果分支已存在，追加 -2、-3 直到唯一。
   b. 执行 git worktree add <worktree-path> <branch-name>。
   c. 验证命令成功（exit code 0 且目录存在）。
8. 创建产物子目录：mkdir -p <worktree-path>/docs/<type>/<dateDescription>/。后续所有 MD 产物和 .state.json 都写入此目录。
9. 写入 worktree-info.json（见 output schema）。
10. 写入 .state.json：设置 worktreePath 为绝对路径，type 为分支前缀，dateDescription 为日期描述 slug，并设置 `artifactDir=<worktreePath>/docs/<type>/<dateDescription>`。同时刷写延迟产物：从 .state.json.pendingOutputs 读取所有条目，将每个 base64 解码后写入其对应的 outputRef 路径（已解析 run:// 前缀）。如果 pendingOutputs 为空（agent 内存中有未持久化的产物），则从内存中获取并写入。完成后删除 .state.json.pendingOutputs 字段。
11. 切换 agent 工作目录：
    a. 确认 .state.json 中 projectRoot 已正确记录（目标 Git 仓库根目录绝对路径），且 skillRoot 指向只读的 skill 目录。
    b. 使用 agent 自带的工作目录切换机制将工作目录切换到 worktreePath。例如 Claude Code 使用 EnterWorktree 工具（path 参数指向已创建的 worktree）或 /cd 命令，Codex 使用 --cd 标志。
    c. 切换后用 `pwd` 验证当前目录正确。

## 约束

- 不得修改主工作树中的任何文件；仅在新工作树上操作。
- 始终验证 git worktree add 成功（exit code 0）后再继续。
- 如果 git 命令失败（不是 git 仓库、dirty worktree 等），暂停并报告错误——不要继续流水线。
- worktreePath 必须是绝对路径。
- 工作树目录名必须是 <项目名>-<分支名>（斜杠替换为连字符），位于 targetDir 下作为项目根目录的兄弟目录。
- 产物子目录必须是 <worktreePath>/docs/<type>/<dateDescription>/。所有 .state.json、worktree-info.json 和 MD 产物都放在这里。
- 不得直接在 targetDir、worktreePath 或 worktreePath/docs/ 下写入产物。
- git-worktree 完成后，必须将 agent 的工作目录切换到 worktreePath（agent 级别切换，非 Bash cd）。
- .state.json 中必须记录 projectRoot（目标 Git 仓库根目录绝对路径）、skillRoot（skill 目录绝对路径）和 artifactDir。后续阶段通过 skill:// 前缀加载 atom-task 时，始终基于 skillRoot 解析；代码读写和项目命令始终基于 worktreePath。
- 不得在主工作树中执行任何文件修改操作。
