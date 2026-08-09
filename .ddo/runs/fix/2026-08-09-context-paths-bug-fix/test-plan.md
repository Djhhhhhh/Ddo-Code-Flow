# Test Plan

**来源**: spec.md
**Revision**: 1

## G1: contextPaths 文档澄清 (AC-1, FR-1)

- [ ] cmd: grep -q "项目级基线上下文" atom-tasks/context/context.md
- [ ] cmd: grep -q "跨需求稳定" atom-tasks/context/context.md
- [ ] cmd: grep -q "不适用于.*按需求变化" atom-tasks/context/context.md

**通过标准**: context.md 包含 contextPaths 定位说明，明确其为"项目级基线上下文"

## G2: --context 参数支持 (AC-2, FR-2)

- [ ] cmd: grep -q "\\-\\-context" SKILL.md
- [ ] cmd: grep -q "per-run" SKILL.md
- [ ] cmd: grep -q "append" SKILL.md

**通过标准**: SKILL.md Inputs 部分包含 `--context <path>` 参数说明

## G3: 配置 schema 修正 (AC-3, FR-3)

- [ ] cmd: cat .ddo/config.json | grep -q '"\\$schema"'
- [ ] cmd: cat .ddo/config.json | grep -q 'config.schema.json'

**通过标准**: `.ddo/config.json` 的 `$schema` 指向真实可访问的 schema 路径

## G4: EnterWorktree 工具说明 (AC-4, FR-4)

- [ ] cmd: grep -q "EnterWorktree" atom-tasks/git-worktree/git-worktree.md
- [ ] cmd: grep -q "必须" atom-tasks/git-worktree/git-worktree.md
- [ ] cmd: grep -q "不得.*Bash cd" atom-tasks/git-worktree/git-worktree.md

**通过标准**: git-worktree.md 包含明确说明，要求使用 EnterWorktree 工具进行工作目录切换

## G5: Step 1 不创建文件 (AC-5, FR-5)

- [ ] cmd: ! grep -q "Ensure.*exists.*create" SKILL.md
- [ ] cmd: ! grep -q "\.ddo/config.json.*create" SKILL.md
- [ ] cmd: grep -q "Read and validate" SKILL.md

**通过标准**: SKILL.md Step 1 不包含创建 .ddo/config.json 或 .ddo/runs/ 的指示

## G6: Runtime Locations 修正 (AC-6, FR-6)

- [ ] cmd: grep -q "never creates" SKILL.md
- [ ] cmd: grep -q "does not.*modify.*projectRoot" SKILL.md

**通过标准**: SKILL.md Runtime Locations 中 projectConfig 描述包含 runtime 不得修改 projectRoot 的说明

## G7: 约束补充 (AC-7, FR-7)

- [ ] cmd: grep -q "does not write to.*projectRoot" SKILL.md

**通过标准**: SKILL.md "What This Skill Does Not Do" 包含"不修改 projectRoot 中的文件"的约束

## G8: 端到端验证

- [ ] human: 启动流水线后，检查主分支上是否有未跟踪的 .ddo/ 目录
- [ ] human: 使用 --context 参数运行流水线，验证上下文被正确加载

**通过标准**: 流水线启动时不污染主分支，--context 参数正常工作
