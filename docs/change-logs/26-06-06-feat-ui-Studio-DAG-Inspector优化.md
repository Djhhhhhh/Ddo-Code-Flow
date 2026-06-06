# 变更日志

**提交信息**: feat(ui): 优化 Studio DAG 配置与 Inspector 体验
**分支**: main
**日期**: 2026-06-06
**作者**: Djhhh

## 变更文件
- atom-tasks/_schema/atom-task.schema.json (modified)
- config.json (modified)
- ui/index.html (modified)
- ui/studio.js (modified)
- ui/styles.css (modified)

## 统计
- 新增文件: 0
- 修改文件: 5
- 删除文件: 0
- 代码行数: +568 / -180

## 描述
重构 Studio 工作流 DAG 配置体验：Inspector 内配置上下游连接、原子任务全局唯一注入；targetDir 移至 Pipeline 工具栏；移除并行确认相关 UI；修复左侧 atom 卡片点击样式，注册表 Inspector 不再显示启用开关。
