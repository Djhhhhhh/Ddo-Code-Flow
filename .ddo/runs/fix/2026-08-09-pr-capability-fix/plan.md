# Plan: PR 能力修复 + --atom 能力 + 流水线描述 bug

**Revision**: 1
**文档模式**: single
**日期**: 2026-08-09

## 需求范围

本次修改涉及 3 个独立需求，全部在 Ddo-Code-Flow skill 目录内完成。

## 非目标

- 不修改 state.schema.json、artifacts.json、config.default.json、config.schema.json
- 不修改 standard/guarded/lightweight workflow（无 create-pr 节点）

## 技术决策

### DEC-1: worktree 清理时机

**结论**: 在 done 阶段由独立 cleanup-worktree 原子任务执行。
**依据**: create-pr 完成后可能仍有后续阶段需要 worktree，延迟清理更安全。
**影响**: issue-driven.json 的 done 阶段需新增 cleanup-worktree 节点。

### DEC-2: --atom 执行路径

**结论**: 在 SKILL.md 中新增 Step 2.5，当 `--atom` 存在时跳过 Step 3-7。
**依据**: 最小侵入性，不修改 runtime 代码，仅修改 SKILL.md 指令文档。
**影响**: 仅 SKILL.md 变更。

### DEC-3: git-push 提交信息格式

**结论**: 采用 conventional commits 格式 `<type>(<scope>): <subject>`。
**依据**: 参考 Ddo-git-push-skill 的结构，保持一致性。

## 现有设计与复用基线

| 能力 | 文件 | 采用方式 |
|---|---|---|
| create-pr 流程 | atom-tasks/create-pr/create-pr.md | 重写 |
| create-pr output schema | atom-tasks/create-pr/create-pr.output.schema.json | 更新 |
| git-worktree 分支命名 | atom-tasks/git-worktree/branch-rules.json | 复用 |
| issue-driven workflow | workflows/issue-driven.json | 修改 done 阶段 |
| SKILL.md 参数文档 | SKILL.md | 扩展 |

## 详细设计

### 文件变更计划

#### 1. SKILL.md

**职责**: Skill 入口文档，定义参数、执行步骤和约束。

**变更**:
- Inputs 部分新增 `--atom <task-name>` 参数说明
- Step 2 末尾新增「显示流水线执行描述」子步骤
- 新增 Step 2.5 描述 `--atom` 单任务执行路径

**契约**:
- `--atom` 参数格式: `--atom <task-name>`，task-name 为 atom-tasks/ 下的目录名
- 流水线描述格式: workflow 名称、描述、run type、issue 编号、阶段列表

#### 2. atom-tasks/create-pr/create-pr.md

**职责**: PR 创建原子任务。

**变更**: 重写指令流程为 7 步:
1. 解析参数（保留）
2. 执行 git-push（新增：git add -A → diff --cached --stat → 生成提交信息 → commit → push）
3. 创建 PR（保留 gh pr create）
4. 评论 PR 链接到 issue（保留）
5. 更新 issue label（保留）
6. 输出 pr-info（保留）
7. 提示用户确认（新增：告知 worktree 将在 done 阶段清理）

**契约**:
- git-push 必须在 PR 创建前完成
- worktree 清理不在本任务中执行
- 提交信息格式: `<type>(<scope>): <subject>`

#### 3. atom-tasks/create-pr/create-pr.output.schema.json

**职责**: pr-info.md 输出规范。

**变更**: 更新 rules 以包含 git-push 步骤约束。

#### 4. atom-tasks/cleanup-worktree/cleanup-worktree.md [新增]

**职责**: done 阶段清理 worktree 和分支。

**frontmatter**:
```yaml
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
```

**指令**:
1. 从 .state.json 读取 worktreePath、projectRoot
2. 从 worktree-info artifact 读取 branchName
3. 切换到 projectRoot
4. git worktree remove <worktreePath>
5. git branch -d <branchName>
6. 记录清理结果到 history

#### 5. workflows/issue-driven.json

**职责**: Issue-driven 流水线定义。

**变更**: done 阶段从空 nodes 改为包含 cleanup-worktree 节点。

## Verification Anchors

- VA-1: SKILL.md 的 Inputs 部分包含 `--atom` 参数
- VA-2: SKILL.md Step 2 包含流水线描述子步骤
- VA-3: SKILL.md 包含 Step 2.5
- VA-4: create-pr.md 包含 git-push 步骤
- VA-5: create-pr.md 包含用户确认提示
- VA-6: cleanup-worktree.md 存在且 frontmatter 正确
- VA-7: issue-driven.json done 阶段包含 cleanup-worktree 节点
- VA-8: create-pr.output.schema.json rules 更新
