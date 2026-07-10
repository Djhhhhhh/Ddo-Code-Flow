# 变更日志

**提交信息**: fix(worktree): 修复产物路径，确保写入 targetDir 下的 worktree 目录
**分支**: main
**日期**: 2026-06-24
**作者**: djhhh

## 变更文件
- atom-tasks/git-worktree/git-worktree.json (modified)
- atom-tasks/coding/coding.json (modified)

## 统计
- 新增文件: 0
- 修改文件: 2
- 删除文件: 0
- 代码行数: +4 / -3

## 描述
修复 worktree 路径计算逻辑，从 config.json 读取 targetDir 配置，确保 worktree 创建在 targetDir 下而非项目根的兄弟目录。同时修复 coding atom-task 的输出路径，从 `run://../` 改为 `run://`，与其他 atom-task 保持一致。
