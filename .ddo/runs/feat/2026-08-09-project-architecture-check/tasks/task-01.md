# Task 01: 架构解耦检查

## 目标

验证 atom-task、workflow、config 三层之间是否存在直接依赖关系。

## 关联验收点

G1. 架构解耦检查

## 检查步骤

1. 检查 atom-task frontmatter 是否直接引用 workflow 结构（如 stage 名、pipeline 定义）
2. 检查 atom-task 是否直接引用全局配置路径（如 config.default.json）
3. 检查 workflow JSON 是否引用 atom-task 内部实现细节
4. 检查 atom-task 是否直接读取 artifacts.json
5. 验证单层变更是否需要其他层配套修改

## 预期输出

检查报告，列出发现的直接依赖关系（如有），或确认无直接依赖。
