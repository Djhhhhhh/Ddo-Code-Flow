# 变更日志

**提交信息**: refactor(artifacts): 重构产物目录结构，worktree 命名与产物子目录层级
**分支**: main
**日期**: 2026-06-24
**作者**: Djhhh

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
- 代码行数: +134 / -88

## 描述
重构产物目录结构：
- worktree 目录名改为 `{项目名}-{分支名(/→-})`（如 `Ddo-Code-Flow-feat-2026-06-24-xxx`）
- 产物子目录从 `docs/{type}/` 改为 `docs/{type}/{dateDescription}/`
- 新增 `dateDescription` 状态字段（分支名去掉前缀后的日期-描述部分）
- 更新 SKILL.md 路径解析规则、show_case.md 示例、README.md 目录树
