# 变更日志

**提交信息**: refactor(artifacts): 将所有 MD 产物路径从 worktree 根目录迁移到 docs/{type}/ 子目录
**分支**: main
**日期**: 2026-06-24
**作者**: djhhh

## 变更文件
- README.md (modified)
- SKILL.md (modified)
- atom-tasks/coding/coding.json (modified)
- atom-tasks/context/context.json (modified)
- atom-tasks/git-worktree/git-worktree.json (modified)
- atom-tasks/plan/plan.json (modified)
- atom-tasks/reflection/reflection.json (modified)
- atom-tasks/reporting/reporting.json (modified)
- atom-tasks/review/review.json (modified)
- atom-tasks/spec/spec.json (modified)
- atom-tasks/tasking/tasking.json (modified)
- atom-tasks/test-plan/test-plan.json (modified)
- atom-tasks/verification/verification.json (modified)
- show_case.md (modified)

## 统计
- 新增文件: 0
- 修改文件: 14
- 删除文件: 0
- 代码行数: +101 / -81

## 描述
将所有 MD 产物（spec.md、plan.md、test-plan.md 等）从 worktree 根目录迁移到 `docs/{type}/` 子目录下，其中 `{type}` 为分支前缀（feat/fix/chore/...）。同时将 `.state.json` 和 `worktree-info.json` 也迁移到该目录。git-worktree 指令新增创建 `docs/{type}/` 目录的步骤，SKILL.md 路径解析规则同步更新。
