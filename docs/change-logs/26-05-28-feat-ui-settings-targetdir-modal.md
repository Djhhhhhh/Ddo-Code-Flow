# 变更日志

**提交信息**: feat(ui): 新增配置弹窗并修复默认显示问题
**分支**: main
**日期**: 2026-05-28 21:46:59 +0800
**作者**: Djhhh

## 变更文件
- ui/index.html (modified)
- ui/studio.js (modified)
- ui/styles.css (modified)

## 统计
- 新增文件: 0
- 修改文件: 3
- 删除文件: 0
- 代码行数: +117 / -0

## 描述
在右上角新增配置按钮与配置弹窗，支持编辑 `base.targetDir`。同时修复弹窗启动默认显示且无法关闭的问题，补充 `hidden` 状态样式以确保初始隐藏与关闭行为正常。
