# Ddo-Code-Flow Plan

> 基于已确认的 spec.md 做技术决策。

---

## 1. 决策原则

| # | 原则 | 落地体现 |
|---|------|----------|
| P-1 | 最小改动 | 仅修改 3 个文件，不引入新机制或配置项 |
| P-2 | agent 原生能力 | 使用 agent 自带的工作目录切换机制（EnterWorktree / --cd） |
| P-3 | skill 文件可访问 | `skill://` 路径始终通过 `projectRoot` 绝对路径解析，不依赖 agent CWD |
| P-4 | 防御性编程 | 增加验证约束，即使 agent 忘记切换也能在后续阶段被纠正 |

---

## 2. 整体架构

```
当前行为：
  git-worktree 创建 worktree → agent CWD 停留在项目根目录 → 后续阶段误操作

修复后：
  git-worktree 创建 worktree
    → .state.json 记录 projectRoot（项目根目录绝对路径）
    → agent 切换 CWD 到 worktreePath
    → run:// 路径基于 worktree 解析（代码/产物）
    → skill:// 路径基于 projectRoot 解析（atom-task 定义，始终可访问）
```

---

## 3. 核心改动

### 3.1 `.state.json` schema 变更

在初始化模板中新增 `projectRoot` 字段（Step 3）：

```json
{
  "runId": null,
  "projectRoot": "<项目根目录绝对路径，即 git 仓库根目录>",
  "createdAt": "<ISO 8601>",
  "userRequirement": "<verbatim user prompt>",
  "currentStage": "context",
  "stages": {},
  "history": [{ "event": "created", "at": "<ISO 8601>" }]
}
```

`projectRoot` 在初始化时即写入（由 Step 3 负责），后续所有阶段通过该字段解析 `skill://` 路径。

### 3.2 `.claude/skills/Ddo-Code-Flow/SKILL.md` 改动

**改动 A — Step 3 初始化模板**：

在现有初始化 JSON 模板中添加 `projectRoot` 字段。解析方式：`git rev-parse --show-toplevel` 或当前工作目录（项目根目录）。

**改动 B — Path resolution rules 表格更新**：

将 `skill://` 的解析规则从模糊的 "Project root" 改为明确基于 `projectRoot`：

| Prefix | Resolves to | When |
|---|---|---|
| `skill://<path>` | `<projectRoot>/<path>` (read-only) | Always. `projectRoot` 来自 `.state.json`，CWD 切换后仍有效。 |
| `run://<path>` | `<worktreePath>/<path>` | After git-worktree sets `worktreePath` |
| `run://docs/{type}/{dateDescription}/<path>` | `<worktreePath>/docs/<type>/<dateDescription>/<path>` | After git-worktree sets `worktreePath`, `type`, and `dateDescription` |
| `run://<path>` | Hold in memory (pending write) | Before `worktreePath` exists |
| `run://../<path>` | `<projectRoot>/<path>` | Always |

**改动 C — Working directory 说明**：

在 Path resolution rules 之后、Directory structure 之前，插入：

```markdown
**Working directory**: After the `git-worktree` atom-task creates the worktree, the agent MUST switch its working directory to `worktreePath` using the agent's native directory-switching mechanism (e.g., EnterWorktree for Claude Code, --cd for Codex). The `projectRoot` field in `.state.json` ensures `skill://` paths remain accessible regardless of the agent's current working directory.
```

### 3.3 `atom-tasks/git-worktree/git-worktree.md` 改动

**改动 D — 新增指令步骤 11**：

在当前第 10 步之后追加：

```markdown
11. 切换 agent 工作目录：
    a. 确认 .state.json 中 projectRoot 已正确记录（项目根目录绝对路径）。
    b. 使用 agent 自带的工作目录切换机制将工作目录切换到 worktreePath。例如 Claude Code 使用 EnterWorktree 工具（path 参数指向已创建的 worktree）或 /cd 命令，Codex 使用 --cd 标志。
    c. 切换后用 `pwd` 验证当前目录正确。
```

**改动 E — 新增约束**：

在约束列表末尾追加：

```markdown
- git-worktree 完成后，必须将 agent 的工作目录切换到 worktreePath（agent 级别切换，非 Bash cd）。
- .state.json 中必须记录 projectRoot（项目根目录绝对路径）。后续阶段通过 skill:// 前缀加载 atom-task 时，始终基于 projectRoot 解析。
- 不得在主工作树中执行任何文件修改操作。
```

---

## 4. 实施次序

1. 修改 `.claude/skills/Ddo-Code-Flow/SKILL.md`：
   - Step 3 初始化模板添加 `projectRoot` 字段
   - 更新 Path resolution rules 表格中 `skill://` 的解析规则
   - 插入 Working directory 说明
2. 修改 `atom-tasks/git-worktree/git-worktree.md`：
   - 新增步骤 11（projectRoot 验证 + CWD 切换）
   - 新增约束（projectRoot + CWD 切换要求）

---

## 5. 风险与权衡

| # | 风险 | 描述 | 处置 |
|---|---|------|------|
| R-1 | agent 忽略切换指令 | agent 可能不执行工作目录切换 | 通过约束和 skill 主文件双重提醒；EnterWorktree 工具调用比文字指令更可靠 |
| R-2 | projectRoot 路径错误 | .state.json 中的 projectRoot 记录了错误路径 | 在 git-worktree 指令中明确：projectRoot = `git rev-parse --show-toplevel` |
| R-3 | skill:// 解析不一致 | agent 可能用 CWD 而非 projectRoot 解析 skill:// | 在 skill 主文件中明确 skill:// 的解析基准为 projectRoot |

---

## 6. 与 spec 的开放问题对应表

| spec Open Question | plan 中的落地 |
|---|---|
| Q-1: 工作目录切换方式？ | 采用 agent 原生切换 + projectRoot 记录方案 |
| Q-2: CWD 切换后 skill 文件访问？ | projectRoot 写入 .state.json，skill:// 始终基于 projectRoot 解析 |

---

## 7. 用户确认

请确认以下任一选项：

- ✅ **同意**：本 plan 符合预期，可进入 **Test-Planning** 阶段生成 `test-plan.md`。
- ❌ **修改**：请在下方/对话中列出需要调整的章节与意见，AI 将基于反馈重新生成本文档。
