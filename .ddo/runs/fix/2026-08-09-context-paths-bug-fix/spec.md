# Alignment Spec: contextPaths 无法承载按需求变化的上下文 + 流水线启动时修改 main 分支

## 对齐摘要

用户报告了 issue #30，描述 `contextPaths` 配置无法按需求变化的上下文问题。当前 `contextPaths` 是项目级基线上下文，对项目内每一次 run 都加载同一份内容，没有 per-run 或 per-requirement 的上下文注入通道。

用户补充要求：
1. 在 git-worktree atom-task 中明确说明需要使用 EnterWorktree 工具进行工作树切换，而不是使用 Bash cd 命令。
2. 修复流水线启动时修改 main 分支的问题：SKILL.md Step 1 指示 runtime 在 projectRoot（main 分支）创建 .ddo/ 目录结构，污染了主分支。

## 用户目标

### 目标 1: 修复 contextPaths 问题

修复 `contextPaths` 无法承载按需求变化的上下文的问题，使用户能够：
1. 为不同需求加载不同的上下文路径
2. 不修改项目配置即可临时追加上下文
3. 明确区分项目级基线上下文和按需求变化的上下文

### 目标 2: 修复 main 分支污染问题

修复流水线启动时修改 main 分支的问题，使流水线：
1. 启动时不在 projectRoot（main 分支）创建任何文件
2. 所有 .ddo/ 目录结构的创建完全在 worktree 中完成
3. 明确 runtime 不得修改 projectRoot 中的文件

## 范围与非目标

### 范围

**contextPaths 问题修复**:
1. **文档层面**: 在 context.md / SKILL.md 明确 `contextPaths` 的定位为"跨需求稳定基线"
2. **能力层面**: 为 run 参数增加 per-run 上下文覆盖能力（如 `--context <path>`）
3. **配置校验**: 修正 `.ddo/config.json` 的 `$schema` 指向真实 schema
4. **worktree 工具**: 明确使用 EnterWorktree 工具进行工作树切换

**main 分支污染问题修复**:
5. **Step 1 修改**: SKILL.md Step 1 改为只读取和验证，不创建任何文件
6. **Runtime Locations 修改**: projectConfig 描述改为指向 worktree 路径，明确 runtime 不得修改 projectRoot
7. **约束补充**: SKILL.md "What This Skill Does Not Do" 增加不修改 projectRoot 中的文件

### 非目标

1. 不修改 `contextPaths` 的核心语义（仍为项目级基线）
2. 不删除或废弃 `contextPaths` 配置项
3. 不修改 `issue-context` 角色的现有行为
4. 不修改 git-worktree 已有的 worktree 初始化职责

## 需求对齐

### FR-1: 文档澄清 contextPaths 定位

**用户要求**: 在 context.md / SKILL.md 明确 `contextPaths` 的定位为"跨需求稳定基线"

**来源**: 用户明确要求（issue #30 建议修复方向 1）

**解释**: 更新文档说明 `contextPaths` 适用于项目架构文档、AGENTS.md 等跨需求稳定的参考资料，不适用于按需求变化的上下文。

### FR-2: 添加 per-run 上下文覆盖能力

**用户要求**: 为 run 参数增加 per-run 上下文覆盖能力（如 `--context <path>`）

**来源**: 用户明确要求（issue #30 建议修复方向 2）

**解释**: 添加 `--context <path>` 运行参数，允许临时追加本次 run 的上下文路径（不修改项目配置）。可以重复使用以追加多个路径。

### FR-3: 修正 .ddo/config.json 的 $schema

**用户要求**: 修正 `.ddo/config.json` 的 `$schema` 指向真实 schema

**来源**: 用户明确要求（issue #30 建议修复方向 3）

**解释**: 将 `.ddo/config.json` 的 `$schema` 从占位假 URL 修改为真实可访问的 schema 路径。

### FR-4: 明确 worktree 阶段使用 EnterWorktree 工具

**用户要求**: 在 git-worktree atom-task 中明确补充需要使用 EnterWorktree 工具来进行工作树切换

**来源**: 用户明确要求（本次需求补充）

**解释**: 在 git-worktree atom-task 的指令中明确说明，必须使用 agent 自带的 EnterWorktree 工具（如 Claude Code 的 EnterWorktree 工具）将工作目录切换到 worktreePath，而不是使用 Bash cd 命令。

### FR-5: Step 1 改为只读取和验证

**用户要求**: SKILL.md Step 1 应改为只读取和验证，不创建任何文件。.ddo/ 的创建完全交给 git-worktree 在 worktree 中完成。

**来源**: 用户明确要求（本次需求补充 - main 分支污染问题）

**解释**: 修改 SKILL.md Step 1，移除创建 .ddo/config.json 和 .ddo/runs/ 的指示，改为只读取和验证配置。所有文件创建操作完全由 git-worktree atom-task 在 worktree 中完成。

### FR-6: Runtime Locations 描述修正

**用户要求**: Runtime Locations 的 projectConfig 描述应改为指向 worktree 路径，并明确标注 runtime 不得修改 projectRoot。

**来源**: 用户明确要求（本次需求补充 - main 分支污染问题）

**解释**: 修改 SKILL.md Runtime Locations 部分，将 projectConfig 的描述从指向 projectRoot 改为指向 worktree 路径，并明确说明 runtime 不得修改 projectRoot 中的文件。

### FR-7: 补充 "What This Skill Does Not Do" 约束

**用户要求**: SKILL.md "What This Skill Does Not Do" 可增加一条：不修改 projectRoot 中的文件。

**来源**: 用户明确要求（本次需求补充 - main 分支污染问题）

**解释**: 在 SKILL.md "What This Skill Does Not Do" 部分新增一条约束，明确说明该 skill 不修改 projectRoot 中的文件，所有文件修改只在 worktree 中进行。

## 成功结果

### AC-1: 文档更新

**验证**: context.md 和 SKILL.md 中包含 `contextPaths` 定位说明，明确其为"项目级基线上下文"

**验证的 FR**: FR-1

### AC-2: per-run 参数支持

**验证**: SKILL.md Inputs 部分包含 `--context <path>` 参数说明

**验证的 FR**: FR-2

### AC-3: 配置 schema 修正

**验证**: `.ddo/config.json` 的 `$schema` 指向真实可访问的 schema 路径

**验证的 FR**: FR-3

### AC-4: worktree 工具明确说明

**验证**: git-worktree.md 中包含明确说明，要求使用 EnterWorktree 工具进行工作目录切换

**验证的 FR**: FR-4

### AC-5: Step 1 不创建文件

**验证**: SKILL.md Step 1 不包含创建 .ddo/config.json 或 .ddo/runs/ 的指示

**验证的 FR**: FR-5

### AC-6: Runtime Locations 描述修正

**验证**: SKILL.md Runtime Locations 中 projectConfig 描述指向 worktree 路径，并包含 runtime 不得修改 projectRoot 的说明

**验证的 FR**: FR-6

### AC-7: 约束补充

**验证**: SKILL.md "What This Skill Does Not Do" 包含"不修改 projectRoot 中的文件"的约束

**验证的 FR**: FR-7

## 约束与保留术语

### 约束

1. 不得修改 `contextPaths` 的核心语义
2. 不得破坏现有工作流的兼容性
3. 不得引入新的必需配置项

### 保留术语

1. `contextPaths` - 项目级基线上下文路径
2. `issue-context` - issue 驱动的工作流的上下文角色
3. `--context` - per-run 上下文追加参数

## 解释与假设

### 解释

1. **contextPaths 定位**: `contextPaths` 设计为项目级基线上下文，适用于跨需求稳定的参考资料
2. **per-run 上下文**: 通过 `--context` 参数临时追加的上下文仅对本次 run 有效，不修改项目配置

### 假设

1. **用户理解**: 用户能够区分项目级基线上下文和按需求变化的上下文
2. **参数优先级**: `--context` 参数追加的路径在 `contextPaths` 之后加载

## 需要用户确认

无

## 留给 Planning

1. `--context` 参数的具体实现方式（追加 vs 替换）
2. context atom-task 如何处理 `--context` 参数
3. 配置合并的具体规则
4. git-worktree atom-task 中 EnterWorktree 工具的具体说明文案
5. Step 1 修改后的具体验证逻辑
6. Runtime Locations 中 projectConfig 描述的具体文案
7. "What This Skill Does Not Do" 中新增约束的具体文案

## 对齐变化摘要

### 修订 1 (2026-08-09)

**新增内容**:
- FR-4: 明确 worktree 阶段使用 EnterWorktree 工具
- AC-4: worktree 工具明确说明

**修改内容**:
- 对齐摘要：补充用户新增需求说明
- 留给 Planning：新增第 4 项关于 EnterWorktree 工具说明文案

### 修订 2 (2026-08-09)

**新增内容**:
- FR-5: Step 1 改为只读取和验证
- FR-6: Runtime Locations 描述修正
- FR-7: 补充 "What This Skill Does Not Do" 约束
- AC-5: Step 1 不创建文件
- AC-6: Runtime Locations 描述修正
- AC-7: 约束补充
- 目标 2: 修复 main 分支污染问题
- 范围：新增 main 分支污染问题修复的 5、6、7 项
- 非目标：新增第 4 项
- 留给 Planning：新增第 5、6、7 项

**修改内容**:
- 标题：补充"流水线启动时修改 main 分支"
- 对齐摘要：补充 main 分支污染问题说明
- 用户目标：新增目标 2

## 用户确认

当前状态：不存在未解决 BQ

可用动作：
- `同意`: 批准当前 spec，进入 Planning
- `修改:<反馈>`: 提供反馈以修改 spec
- `提问:<问题>`: 提出问题以澄清 spec
