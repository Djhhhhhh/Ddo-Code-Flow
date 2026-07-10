# Task 01: 修改 SKILL.md — 添加 projectRoot 和工作目录切换机制

> 关联验收点：G2, G3, G4

## 目标

修改 `.claude/skills/Ddo-Code-Flow/SKILL.md`，使流水线在 git-worktree 完成后能正确切换 agent 工作目录，并确保 skill 文件在 CWD 切换后仍可访问。

## 改动清单

### 改动 A — Step 3 初始化模板添加 projectRoot

在 Step 3 的 `.state.json` 初始化 JSON 模板中，添加 `projectRoot` 字段：

```json
{
  "runId": null,
  "projectRoot": "<项目根目录绝对路径>",
  "createdAt": "<ISO 8601>",
  "userRequirement": "<verbatim user prompt>",
  "currentStage": "context",
  "stages": {},
  "history": [{ "event": "created", "at": "<ISO 8601>" }]
}
```

在模板下方添加说明：`projectRoot` 在初始化时即写入（当前工作目录或 `git rev-parse --show-toplevel`），后续所有阶段通过该字段解析 `skill://` 路径。

### 改动 B — 更新 Path resolution rules 表格

将 `skill://` 行从：
```
| `skill://<path>` | Project root `/<path>` (read-only) | Always |
```
改为：
```
| `skill://<path>` | `<projectRoot>/<path>` (read-only) | Always. `projectRoot` 来自 `.state.json`，CWD 切换后仍有效。 |
```

### 改动 C — 插入 Working directory 说明

在 Path resolution rules 表格之后、Directory structure 之前，插入：

```markdown
**Working directory**: After the `git-worktree` atom-task creates the worktree, the agent MUST switch its working directory to `worktreePath` using the agent's native directory-switching mechanism (e.g., EnterWorktree for Claude Code, --cd for Codex). The `projectRoot` field in `.state.json` ensures `skill://` paths remain accessible regardless of the agent's current working directory.
```

## 验收

- grep -q "projectRoot" SKILL.md
- grep -q "EnterWorktree\|--cd\|/cd" SKILL.md
- grep -q "Working directory" SKILL.md
- grep -q '<projectRoot>' SKILL.md
