# 变更日志

**提交信息**: feat(workflow): 支持配置驱动的多工作流选择、预览与渐进式加载
**分支**: feat/2026-07-10-multi-workflow-config-driven
**日期**: 2026-07-10
**作者**: djhhh

## 变更文件
- config.json (modified) — v2→v3 索引结构
- config.schema.json (modified) — 新增 workflows/workflowDefinition schema
- SKILL.md (modified) — workflow 解析与渐进式加载说明
- ui/index.html (modified) — panel__head 新增 workflow 切换下拉
- ui/studio.js (modified) — workflow 加载/切换/保存逻辑
- ui/styles.css (modified) — workflow-select 样式
- workflows/standard.json (added) — 标准模式 12 阶段
- workflows/lightweight.json (added) — 轻量模式跳过 test-plan/tasking
- workflows/guarded.json (added) — 加强模式启用 review
- docs/feat/... (added) — 流水线产物（spec/plan/test-plan/tasks 等）

## 统计
- 新增文件: 15
- 修改文件: 6
- 删除文件: 1
- 代码行数: +2047 / -269

## 描述
将 ddo-code-flow 从单一流水线改造为配置驱动的多工作流体系。config.json 升级为 v3 索引结构，workflow 定义外置到 workflows/*.json，支持 standard/lightweight/guarded 三种模式。Studio UI 新增 workflow 切换下拉控件，SKILL.md 描述 workflow 解析、规则匹配和渐进式加载逻辑。
