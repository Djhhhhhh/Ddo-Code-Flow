# Test Plan

## G1: create-pr 流程重构 (FR-1)

- [ ] cmd: grep -q "git add -A" atom-tasks/create-pr/create-pr.md
- [ ] cmd: grep -q "git commit" atom-tasks/create-pr/create-pr.md
- [ ] cmd: grep -q "git push" atom-tasks/create-pr/create-pr.md
- [ ] cmd: grep -q "gh pr create" atom-tasks/create-pr/create-pr.md
- [ ] cmd: grep -q "用户确认\|确认后\|审阅" atom-tasks/create-pr/create-pr.md
- [ ] cmd: grep -q "done.*阶段\|done 阶段\|worktree.*清理" atom-tasks/create-pr/create-pr.md

**通过标准**: create-pr.md 包含 git-push 步骤（add/commit/push）、PR 创建、用户确认提示、worktree 清理声明。

## G2: --atom 参数支持 (FR-2)

- [ ] cmd: grep -q "\-\-atom" SKILL.md
- [ ] cmd: grep -q "Step 2.5\|--atom.*单任务\|atom.*执行路径" SKILL.md

**通过标准**: SKILL.md Inputs 列出 --atom 参数，且包含 Step 2.5 描述。

## G3: 流水线执行描述 (FR-3)

- [ ] cmd: grep -q "流水线执行描述\|执行摘要\|pipeline.*description" SKILL.md
- [ ] cmd: grep -q "Workflow.*名称\|workflow.*name\|阶段列表\|stages" SKILL.md

**通过标准**: SKILL.md Step 2 包含流水线描述输出步骤。

## G4: cleanup-worktree 原子任务 (FR-4)

- [ ] cmd: test -f atom-tasks/cleanup-worktree/cleanup-worktree.md
- [ ] cmd: grep -q "name: cleanup-worktree" atom-tasks/cleanup-worktree/cleanup-worktree.md
- [ ] cmd: grep -q "cleanup-worktree" workflows/issue-driven.json
- [ ] cmd: grep -q "git worktree remove\|worktree.*remove" atom-tasks/cleanup-worktree/cleanup-worktree.md
- [ ] cmd: grep -q "git branch -d\|branch.*delete\|branch.*-d" atom-tasks/cleanup-worktree/cleanup-worktree.md

**通过标准**: cleanup-worktree.md 存在且 frontmatter 正确，issue-driven.json done 阶段引用它。

## G5: create-pr output schema 更新 (FR-5)

- [ ] cmd: grep -q "git.*push\|git-push\|提交" atom-tasks/create-pr/create-pr.output.schema.json

**通过标准**: output schema rules 包含 git-push 相关约束。

## G6: 约束完整性

- [ ] cmd: grep -q "worktree.*清.*done\|done.*清.*worktree" atom-tasks/create-pr/create-pr.md
- [ ] cmd: grep -q "git-push.*必须.*PR\|push.*先于\|push.*before" atom-tasks/create-pr/create-pr.md

**通过标准**: create-pr.md 约束声明 worktree 清理由 done 阶段负责，git-push 必须在 PR 创建前完成。
