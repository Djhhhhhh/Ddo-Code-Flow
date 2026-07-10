# 变更日志

**提交信息**: fix(config): 修复三项配置语义问题——review override 矛盾、stage 命名不一致、延迟写入无持久化
**分支**: main
**日期**: 2026-06-25
**作者**: djhhh

## 变更文件
- README.md (modified)
- SKILL.md (modified)
- atom-tasks/_schema/atom-task-md.schema.json (modified)
- atom-tasks/git-worktree/git-worktree.md (modified)
- atom-tasks/reporting/execution-report.output.schema.json (modified)
- atom-tasks/spec/spec.md (modified)
- atom-tasks/test-plan/test-plan.md (modified)
- config.json (modified)
- config.schema.json (modified)
- show_case.md (modified)

## 统计
- 新增文件: 0
- 修改文件: 10
- 删除文件: 0
- 代码行数: +41 / -35

## 描述
1. review stage 的 atomTaskOverrides.enabled 从 true 改为 false，与 review.md 的 enabled: false 保持一致
2. stage 名统一为 atom-task 名：specification → spec，test-planning → test-plan（涉及 schema、config、atom-task 定义、文档）
3. 延迟写入机制从纯内存改为 pendingOutputs 持久化到 .state.json（base64 编码），resume 时自动 flush，防止会话中断丢失产物
