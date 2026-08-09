# Implementation Plan

**文档模式**: single
**Revision**: 1
**来源 Spec**: spec.md

## 执行摘要

本次修复包含两个问题：
1. `contextPaths` 无法承载按需求变化的上下文（issue #30）
2. 流水线启动时修改 main 分支（运行时发现）

修复策略：纯文档修改，不涉及代码逻辑变更。

## 需求范围

### 范围内

- FR-1: 文档澄清 contextPaths 定位
- FR-2: 添加 per-run 上下文覆盖能力
- FR-3: 修正 .ddo/config.json 的 $schema
- FR-4: 明确 worktree 阶段使用 EnterWorktree 工具
- FR-5: Step 1 改为只读取和验证
- FR-6: Runtime Locations 描述修正
- FR-7: 补充 "What This Skill Does Not Do" 约束

### 非目标

- 不修改 contextPaths 的核心语义
- 不删除或废弃 contextPaths 配置项
- 不修改 issue-context 角色的现有行为
- 不修改 git-worktree 已有的 worktree 初始化职责

## 现有设计与复用基线

| 能力 | 文件路径 | 证据类型 | 采用方式 | 适用边界 |
|------|----------|----------|----------|----------|
| SKILL.md 主文档 | `SKILL.md` | Repository Fact | 修改现有 | 所有 FR 均涉及此文件 |
| context atom-task | `atom-tasks/context/context.md` | Repository Fact | 修改现有 | FR-1 涉及 |
| git-worktree atom-task | `atom-tasks/git-worktree/git-worktree.md` | Repository Fact | 修改现有 | FR-4 涉及 |
| config.schema.json | `config.schema.json` | Repository Fact | 不适用 | FR-3 涉及，但 schema 本身不需要修改 |
| .ddo/config.json | `.ddo/config.json` (worktree) | Repository Fact | 修改现有 | FR-3 涉及 |

## 技术决策

### DEC-1: --context 参数实现方式

**结论**: 追加模式（append）

**依据**:
- 用户明确要求"临时追加"而非"替换"
- 与 contextPaths 的数组语义一致
- 不破坏现有配置

**权衡**:
- 追加模式可能导致路径重复，但可通过去重处理
- 替换模式会丢失项目基线上下文，不符合需求

**影响范围**: SKILL.md Inputs、Step 1

### DEC-2: Step 1 修改策略

**结论**: 移除创建 .ddo/ 的指示，改为只读取和验证

**依据**:
- git-worktree atom-task 已承担在 worktree 中初始化 .ddo/ 的职责
- 避免在 projectRoot（main 分支）创建文件

**权衡**:
- 需要确保 git-worktree 正确处理 .ddo/ 初始化
- 需要更新 Runtime Locations 描述以反映新的职责边界

**影响范围**: SKILL.md Step 1、Runtime Locations

### DEC-3: projectConfig 描述修正

**结论**: 指向 worktree 路径，明确 runtime 不得修改 projectRoot

**依据**:
- 避免用户误解 projectConfig 的创建时机和位置
- 明确职责边界

**影响范围**: SKILL.md Runtime Locations

## 详细设计

### 1. SKILL.md 修改

#### 1.1 Runtime Locations 修改

**修改位置**: 第 28-29 行

**当前内容**:
```
- `projectConfig`: `<projectRoot>/.ddo/config.json`. It is the only project-owned
  configuration file and is created on first run when absent.
```

**修改为**:
```
- `projectConfig`: `<projectRoot>/.ddo/config.json`. It is the only project-owned
  configuration file. Runtime reads and validates it when present but never creates
  or modifies it. All .ddo/ directory initialization happens in the worktree via
  git-worktree.
```

#### 1.2 Inputs 修改

**修改位置**: 第 40-43 行

**当前内容**:
```
- Minimal run arguments:
  - `--model <workflow-id>` selects a workflow explicitly.
  - `--feature` marks the run type as `feat`.
  - `--bugfix` marks the run type as `fix`.
```

**修改为**:
```
- Minimal run arguments:
  - `--model <workflow-id>` selects a workflow explicitly.
  - `--feature` marks the run type as `feat`.
  - `--bugfix` marks the run type as `fix`.
  - `--context <path>` appends a context path for this run only (does not modify
    project config). Can be repeated. Useful for per-requirement context that
    should not persist across runs.
```

#### 1.3 Step 1 修改

**修改位置**: 第 104-107 行

**当前内容**:
```
3. Ensure `<projectRoot>/.ddo/` exists. If missing, create:
   - `.ddo/config.json` with a minimal project config object.
   - `.ddo/runs/`.
   Do not modify `.gitignore`, git exclude, or any other git visibility setting.
```

**修改为**:
```
3. Read and validate `<projectRoot>/.ddo/config.json` when it exists. Do not
   create or modify any files in projectRoot. All .ddo/ directory initialization
   happens in the worktree via git-worktree (see Step 5).
```

#### 1.4 Step 1 第 5 条修改

**修改位置**: 第 109-112 行

**当前内容**:
```
5. Compose effective config in memory only:
   `config.default.json <- .ddo/config.json <- run arguments`.
   Objects merge recursively, arrays replace as a whole, scalars replace.
   Never write an effective config file to disk.
```

**修改为**:
```
5. Compose effective config in memory only:
   `config.default.json <- .ddo/config.json <- run arguments`.
   Objects merge recursively, arrays replace as a whole, scalars replace.
   For `contextPaths`, run arguments (`--context`) **append** to the merged
   project/base array rather than replacing it. This allows per-run context
   without modifying project config.
   Never write an effective config file to disk.
```

#### 1.5 What This Skill Does Not Do 修改

**修改位置**: 第 279-284 行

**当前内容**:
```
## What This Skill Does Not Do

- It does not write to `skillRoot` during a run.
- It does not manage `.gitignore` or git exclude.
- It does not place worktrees inside `.ddo/runs/`.
- It does not add metrics stages or per-atom token attribution.
- It does not keep v2/v3 compatibility logic.
```

**修改为**:
```
## What This Skill Does Not Do

- It does not write to `skillRoot` during a run.
- It does not write to `projectRoot` during a run. All file modifications
  happen in the worktree.
- It does not manage `.gitignore` or git exclude.
- It does not place worktrees inside `.ddo/runs/`.
- It does not add metrics stages or per-atom token attribution.
- It does not keep v2/v3 compatibility logic.
```

### 2. context.md 修改

**修改位置**: 第 19-24 行之后

**当前内容**:
```
> 读取项目基础上下文（AGENTS.md + 有效配置中的 contextPaths）并汇总为 context-summary 角色。
> 缺失项不阻断流水线，但记录到执行报告中。产物在 worktree 建立前交由 runtime 延迟登记。
```

**新增内容**（在约束之前）:
```
## contextPaths 定位说明

`contextPaths` 是**项目级基线上下文**，对项目内每一次 run 都加载同一份内容。它适用于：
- 项目架构文档、AGENTS.md 等跨需求稳定的参考资料
- 团队规范、代码风格指南等项目级约束

**不适用于**按需求变化的上下文（如某次需求的调研报告、issue 正文等）。按需求变化的上下文应通过以下通道注入：
- `issue-context` 角色（由 `issue-fetch` atom-task 产出）：用于 issue 驱动的工作流
- `--context <path>` 运行参数：用于临时追加本次 run 的上下文路径（不修改项目配置）
```

### 3. git-worktree.md 修改

**修改位置**: 第 44-48 行

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

## 验证锚点

| 契约 | 验证方式 | 验证文件 |
|------|----------|----------|
| AC-1: contextPaths 定位说明 | 检查 context.md 包含"项目级基线上下文" | atom-tasks/context/context.md |
| AC-2: --context 参数说明 | 检查 SKILL.md Inputs 包含 "--context" | SKILL.md |
| AC-3: 配置 schema 修正 | 检查 .ddo/config.json 的 $schema | .ddo/config.json |
| AC-4: EnterWorktree 工具说明 | 检查 git-worktree.md 包含"EnterWorktree" | atom-tasks/git-worktree/git-worktree.md |
| AC-5: Step 1 不创建文件 | 检查 SKILL.md Step 1 不包含"create" | SKILL.md |
| AC-6: Runtime Locations 修正 | 检查 SKILL.md Runtime Locations 包含"never creates" | SKILL.md |
| AC-7: 约束补充 | 检查 SKILL.md 包含"does not write to projectRoot" | SKILL.md |

## 文件变更计划

| 文件 | 变更类型 | 职责 |
|------|----------|------|
| SKILL.md | 修改 | 添加 --context 参数、修改 Step 1、修改 Runtime Locations、添加约束 |
| atom-tasks/context/context.md | 修改 | 添加 contextPaths 定位说明 |
| atom-tasks/git-worktree/git-worktree.md | 修改 | 明确 EnterWorktree 工具使用要求 |

## 用户确认

**当前状态**: Revision 1，等待用户确认

**可用动作**:
- `同意`: 批准当前 plan，进入 Test-Planning
- `修改:<反馈>`: 提供反馈以修改 plan
- `提问:<问题>`: 提出问题以澄清 plan
