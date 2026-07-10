# 变更日志

**提交信息**: docs: 重构 SKILL 流程并新增 show_case.md 端到端示例
**分支**: main
**日期**: 2026-06-24
**作者**: djhhh

## 变更文件
- SKILL.md (modified)
- atom-tasks/_schema/atom-task.schema.json (modified)
- atom-tasks/context/context.json (modified)
- atom-tasks/git-worktree/git-worktree.json (modified)
- atom-tasks/spec/spec.json (modified)
- atom-tasks/test-plan/test-plan.json (modified)
- atom-tasks/test-plan/test-plan_template.md (modified)
- atom-tasks/verification/verification.json (modified)
- config.json (modified)
- config.schema.json (modified)
- show_case.md (added)

## 统计
- 新增文件: 1
- 修改文件: 10
- 删除文件: 0
- 代码行数: +1140 / -85

## 描述
重构 SKILL.md 核心流程：Step 2 不再创建运行目录，由 git-worktree 原子任务统一创建；新增 context 产物延迟写入机制；更新所有原子任务 description 与实际逻辑对齐；明确 cmd:（自动化测试）与 human:（功能测试）的定义区分；新增 show_case.md 端到端执行全景示例。
