# 变更日志

**提交信息**: feat(init): 初始化 ddo-swe AI 编程流水线 skill 项目
**分支**: main
**日期**: 2026-05-23
**作者**: Djhhh

## 变更文件

### 根目录配置与文档
- `.gitignore` (added)
- `LINCES` (added)
- `README.md` (added)
- `SKILL.md` (added)
- `config.json` (added)
- `config.schema.json` (added)

### atom-tasks/ — 11 个原子任务 + schema
- `atom-tasks/_schema/atom-task.schema.json` (added)
- `atom-tasks/coding/coding.json` (added)
- `atom-tasks/context/context.json` (added)
- `atom-tasks/plan/plan.json` (added)
- `atom-tasks/plan/plan_template.md` (added)
- `atom-tasks/reflection/reflection-report_template.md` (added)
- `atom-tasks/reflection/reflection.json` (added)
- `atom-tasks/reporting/execution-report_template.md` (added)
- `atom-tasks/reporting/reporting.json` (added)
- `atom-tasks/requirement/requirement.json` (added)
- `atom-tasks/review/check-list.md` (added)
- `atom-tasks/review/review.json` (added)
- `atom-tasks/spec/spec.json` (added)
- `atom-tasks/spec/spec_template.md` (added)
- `atom-tasks/tasking/task_template.md` (added)
- `atom-tasks/tasking/tasking.json` (added)
- `atom-tasks/test-plan/test-plan.json` (added)
- `atom-tasks/test-plan/test-plan_template.md` (added)
- `atom-tasks/verification/verification.json` (added)
- `atom-tasks/verification/verification_template.md` (added)

### docs/ — 自举产物（spec / plan / tasks / reports）
- `docs/.state.json` (added)
- `docs/execution-report.md` (added)
- `docs/pipeline.png` (added)
- `docs/plan.md` (added)
- `docs/reflection-report.md` (added)
- `docs/requirement.md` (added)
- `docs/spec.md` (added)
- `docs/test-plan.md` (added)
- `docs/verification.log` (added)
- `docs/tasks/task-01.md` ~ `docs/tasks/task-17.md` (added, 17 个文件)
- `docs/tasks/task-group.json` (added)

### ui/ — 零依赖可视化页面
- `ui/app.js` (added)
- `ui/index.html` (added)
- `ui/styles.css` (added)

## 统计

- 新增文件: 56
- 修改文件: 0
- 删除文件: 0
- 代码行数: +5695 / -0

## 描述

首次提交，正式初始化 **ddo-swe**（可定制化 AI 编程流水线 skill）项目。本次提交包含项目从 0 到 1 自举得到的全部产物：

1. **流水线骨架**：`config.json` + `config.schema.json` 定义 12 阶段 DAG 编排，4 个确认门（specification / planning / test-planning / reflection），支持 `atomTaskOverrides` 覆盖层热开关。
2. **11 个内置原子任务**：覆盖 context / requirement / spec / plan / test-plan / tasking / coding / verification / review / reporting / reflection 全流程，每个 atom-task 一个子目录（JSON + 模板/check-list），遵循 `atom-tasks/_schema/atom-task.schema.json`。
3. **零依赖可视化 UI**：纯 HTML + CSS + 单文件 JS（`ui/app.js` 1155 行），三 Tab（Base / Pipeline / Atom-tasks）支持 DAG 拖拽编排、节点连线、合并审批、无环校验，通过 File System Access API 直接读写 `config.json`。
4. **自举开发文档**：`docs/` 下完整保留本项目用 ddo-swe 自己跑一遍流水线的产物——requirement / spec / plan / test-plan / 17 个 task / verification.log / execution-report / reflection-report，可作为后续项目参考。
5. **项目入口与说明**：`SKILL.md`（Cursor agent 执行循环说明）+ `README.md`（项目亮点 / 快速开始 / 配置说明 / 目录结构 / 贡献指引）+ `LINCES`（MIT 许可证）。
