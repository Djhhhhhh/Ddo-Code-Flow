# Task 02: 全局描述一致性检查

## 目标

检查项目中跨文件的描述是否一致。

## 关联验收点

G2. 全局描述一致性检查

## 检查步骤

1. 对比 config.default.json 和 config.schema.json 中的 description 字段
2. 检查各 workflow JSON 的 name/description 是否与 config 中的 workflow index 一致
3. 检查各 atom-task frontmatter 的 name/version 是否与目录名一致
4. 检查 README.md 中的描述是否与实际配置一致

## 预期输出

检查报告，列出跨文件描述不一致的具体位置（如有），或确认描述一致。
