# 变更日志

**提交信息**: feat(atom-tasks): 2.0 MD 化改造——atom-task 定义从 JSON 迁移为 .md 文件
**分支**: main
**日期**: 2026-06-24
**作者**: djhhh

## 变更文件

### 新增
- atom-tasks/_schema/atom-task-md.schema.json (added)
- atom-tasks/_schema/output-schema.schema.json (added)
- atom-tasks/coding/coding.md (added)
- atom-tasks/context/context.md (added)
- atom-tasks/context/context.output.schema.json (added)
- atom-tasks/git-worktree/git-worktree.md (added)
- atom-tasks/git-worktree/worktree-info.output.schema.json (added)
- atom-tasks/plan/plan.md (added)
- atom-tasks/plan/plan.output.schema.json (added)
- atom-tasks/reflection/reflection-report.output.schema.json (added)
- atom-tasks/reflection/reflection.md (added)
- atom-tasks/reporting/execution-report.output.schema.json (added)
- atom-tasks/reporting/reporting.md (added)
- atom-tasks/requirement/requirement.md (added)
- atom-tasks/requirement/requirement.output.schema.json (added)
- atom-tasks/review/review-report.output.schema.json (added)
- atom-tasks/review/review.md (added)
- atom-tasks/spec/spec.md (added)
- atom-tasks/spec/spec.output.schema.json (added)
- atom-tasks/tasking/task-group.output.schema.json (added)
- atom-tasks/tasking/tasking.md (added)
- atom-tasks/test-plan/test-plan.md (added)
- atom-tasks/test-plan/test-plan.output.schema.json (added)
- atom-tasks/verification/verification.md (added)
- atom-tasks/verification/verification.output.schema.json (added)

### 删除
- atom-tasks/_schema/atom-task.schema.json (deleted)
- atom-tasks/coding/coding.json (deleted)
- atom-tasks/context/context.json (deleted)
- atom-tasks/git-worktree/git-worktree.json (deleted)
- atom-tasks/plan/plan.json (deleted)
- atom-tasks/plan/plan_template.md (deleted)
- atom-tasks/reflection/reflection-report_template.md (deleted)
- atom-tasks/reflection/reflection.json (deleted)
- atom-tasks/reporting/execution-report_template.md (deleted)
- atom-tasks/reporting/reporting.json (deleted)
- atom-tasks/requirement/requirement.json (deleted)
- atom-tasks/review/review.json (deleted)
- atom-tasks/spec/spec.json (deleted)
- atom-tasks/spec/spec_template.md (deleted)
- atom-tasks/tasking/task_template.md (deleted)
- atom-tasks/tasking/tasking.json (deleted)
- atom-tasks/test-plan/test-plan.json (deleted)
- atom-tasks/test-plan/test-plan_template.md (deleted)
- atom-tasks/verification/verification.json (deleted)
- atom-tasks/verification/verification_template.md (deleted)

### 修改
- README.md (modified) — 更新为 2.0 版本文档
- SKILL.md (modified) — loader 逻辑改为解析 .md frontmatter
- config.json (modified) — version 升级为 2.0.0
- ui/index.html (modified) — 移除输出目录按钮和插入阶段按钮
- ui/studio.js (modified) — 新增 YAML frontmatter 解析器，适配 MD 格式

## 统计

- 新增文件: 25
- 修改文件: 5
- 删除文件: 20
- 代码行数: +2241 / -1220

## 描述

2.0 版本核心改造：

1. **atom-task 定义 MD 化**：12 个原子任务定义从 JSON 迁移为 `.md` 文件（YAML frontmatter + markdown body），agent 输入更友好
2. **产物规范标准化**：新增 `.output.schema.json`（sections / rules / example / fieldDocs），定义输出 MD 的结构与校验规则，取代旧的 `_template.md`
3. **UI 适配**：Studio 解析 YAML frontmatter 展示 atom-task 信息，配置弹窗改为只读查看，开关修改保留
4. **精简清理**：删除旧 JSON 定义文件、模板文件，`_schema` 仅保留 `atom-task-md.schema.json` + `output-schema.schema.json`
5. **context 输入简化**：默认仅读取 AGENTS.md，额外路径通过 config.base.contextPaths 配置
