# 变更日志

**提交信息**: fix(config): 修复 targetDir 路径，确保 worktree 创建在项目同级目录
**分支**: main
**日期**: 2026-06-24
**作者**: djhhh

## 变更文件
- config.json (modified)

## 统计
- 新增文件: 0
- 修改文件: 1
- 删除文件: 0
- 代码行数: +1 / -1

## 描述
将 targetDir 从 "docs\\feat"（项目内部子目录）修改为 ".."（项目父目录），确保 git worktree 在项目目录同级创建，而非在项目内部的 docs/feat 目录下。
