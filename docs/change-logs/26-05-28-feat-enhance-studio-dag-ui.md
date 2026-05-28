# 变更日志

**提交信息**: feat(ui): 优化 Studio DAG 配置体验
**分支**: main
**日期**: 2026-05-28 21:28:46
**作者**: Djhhh <1161015498@qq.com>

## 变更文件
- .gitignore (modified)
- config.json (modified)
- config.schema.json (modified)
- ui/index.html (modified)
- ui/studio.js (added)
- ui/styles.css (modified)

## 统计
- 新增文件: 1
- 修改文件: 5
- 删除文件: 0
- 代码行数: +1865 / -92

## 描述
优化 Ddo-SWE Studio 的 DAG 配置体验：移除 atom-task 创建与预设能力，按 stage 分组展示 atom-task，改进 DAG 阶段分区、节点禁用毛玻璃、显式 config 连线渲染、右侧节点 Inspector 与并行确认配置，并补齐 config 主流程 next 链路。
