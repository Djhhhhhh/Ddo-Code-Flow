# Alignment Spec

## 对齐摘要

本次修复包含 3 个独立需求：(1) 重构 create-pr 原子任务的 PR 创建流程，参考 Ddo-git-push-skill 的 git-push 结构；(2) 为 skill 添加 `--atom` 参数支持单任务执行；(3) 修复流水线启动时缺少执行描述文字的 bug。

## 用户目标

1. PR 创建流程应遵循 git-push → 创建 PR → 用户确认的顺序，worktree 清理延迟到 done 阶段
2. 能够通过 `--atom <task-name>` 参数跳过完整流水线，直接执行单个原子任务
3. 调用 skill 时应显示流水线执行摘要（workflow 名称、run type、阶段列表等）

## 范围与非目标

**范围内:**
- 修改 `atom-tasks/create-pr/create-pr.md` 的流程指令
- 修改 `SKILL.md` 添加 `--atom` 参数解析和流水线描述步骤
- 新增 `atom-tasks/cleanup-worktree/cleanup-worktree.md` 原子任务
- 修改 `workflows/issue-driven.json` 的 done 阶段
- 更新 `atom-tasks/create-pr/create-pr.output.schema.json`

**非目标:**
- 不修改 `state.schema.json`（prInfo 字段已存在）
- 不修改 `atom-tasks/artifacts.json`（cleanup 通过 history 记录）
- 不修改 `config.default.json` 或 `config.schema.json`
- 不修改 standard/guarded/lightweight workflow（它们无 create-pr 节点）

## 需求对齐

### FR-1: create-pr 流程重构 [Explicit]

create-pr 原子任务的流程修改为：
1. 解析参数（保留现有逻辑）
2. 执行 git-push（参考 Ddo-git-push-skill：git add -A → 生成提交信息 → git commit → git push）
3. 创建 PR（gh pr create --draft）
4. 评论 PR 链接到 issue
5. 更新 issue label
6. 输出 pr-info
7. 提示用户确认（不阻塞，告知 worktree 将在 done 阶段清理）

**验证 AC:**
- AC-1.1: create-pr.md 指令包含 git-push 步骤（git add, commit, push）
- AC-1.2: create-pr.md 指令在 PR 创建后提示用户确认
- AC-1.3: create-pr.md 约束中声明 worktree 清理由 done 阶段负责

### FR-2: --atom 单任务执行 [Explicit]

SKILL.md 支持 `--atom <task-name>` 参数：
- 当指定时，跳过完整流水线（Step 3-7）
- 加载指定 atom-task 的 frontmatter 和指令
- 从 `.state.json.artifacts` 解析 consumes 输入
- 执行指令并注册 produces

**验证 AC:**
- AC-2.1: SKILL.md Inputs 部分列出 `--atom` 参数
- AC-2.2: SKILL.md 包含 Step 2.5 描述 `--atom` 执行路径

### FR-3: 流水线执行描述 [Explicit]

参数解析后（Step 2 完成后），输出流水线执行摘要：
- Workflow 名称和描述
- Run type (feat/fix)
- Issue 编号（如有）
- 阶段列表
- `--atom` 模式时显示单任务信息

**验证 AC:**
- AC-3.1: SKILL.md Step 2 包含「显示流水线执行描述」子步骤
- AC-3.2: 描述格式包含 workflow、run type、stages 信息

### FR-4: cleanup-worktree 原子任务 [Explicit]

新增 `atom-tasks/cleanup-worktree/cleanup-worktree.md`：
- 在 done 阶段执行
- 从 `.state.json` 读取 worktreePath 和分支名
- 执行 `git worktree remove` 和 `git branch -d`
- 仅在有 worktree 需要清理时执行

**验证 AC:**
- AC-4.1: cleanup-worktree.md 存在且 frontmatter 正确
- AC-4.2: issue-driven.json 的 done 阶段包含 cleanup-worktree 节点

### FR-5: create-pr output schema 更新 [Interpretation]

更新 `create-pr.output.schema.json` 以反映新流程（包含 git-push 步骤）。

**验证 AC:**
- AC-5.1: output schema 的 rules 包含 git-push 相关约束

## 成功结果

- SC-1: 修改后的 create-pr.md 包含完整的 git-push → PR → 确认流程
- SC-2: SKILL.md 的 Inputs 部分列出 `--atom` 参数
- SC-3: SKILL.md Step 2 包含流水线执行描述步骤
- SC-4: cleanup-worktree.md 存在且被 issue-driven.json 引用
- SC-5: 所有修改后的文件 frontmatter/schema 验证通过

## 留给 Planning

- git-push 的提交信息生成策略（conventional commits vs 自定义格式）
- cleanup-worktree 是否需要处理 worktree 不存在的边界情况
- `--atom` 模式下是否需要校验 state 文件存在性
