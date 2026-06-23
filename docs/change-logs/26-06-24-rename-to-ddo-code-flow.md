# 变更日志

**提交信息**: refactor: rename project from ddo-swe to ddo-code-flow
**分支**: main
**日期**: 2026-06-24
**作者**: Djhhhhhh

## 变更说明

将项目从 `ddo-swe` 重命名为 `ddo-code-flow`，以避免与 SWE-bench 评测集混淆，并更准确地描述项目本质（代码流程流水线）。

## 变更文件

- README.md (modified) - 更新项目名称和所有引用
- SKILL.md (modified) - 更新 skill 名称和所有路径引用
- config.schema.json (modified) - 更新 $id 和 title
- atom-tasks/_schema/atom-task.schema.json (modified) - 更新 $id 和 title
- atom-tasks/requirement/requirement.json (modified) - 更新 instruction 中的引用
- atom-tasks/git-worktree/git-worktree.json (modified) - 更新 instruction 中的引用
- ui/index.html (modified) - 更新页面标题和顶部标题
- ui/app.js (modified) - 更新注释中的引用

## 命名规范

- **GitHub 仓库名**: `Ddo-Code-Flow` (PascalCase)
- **Skill 名称**: `ddo-code-flow` (kebab-case)
- **Studio 名称**: `Ddo-Code-Flow Studio`

## 统计

- 修改文件: 8
- 新增文件: 0
- 删除文件: 0

## 原因

1. **避免混淆**: "SWE" 在 AI/ML 领域通常指 SWE-bench 评测集
2. **更准确的描述**: "code-flow" 更准确地描述了项目的代码流水线特性
3. **更好的可搜索性**: 避免搜索时与 SWE-bench 相关结果混淆
4. **品牌一致性**: 保持 "ddo" 品牌前缀的一致性