---
name: delivery-doc
version: "4.0.0"
enabled: true
timeoutSec: 0
concurrency:
  parallelizable: false
confirmation:
  rejectAction: regenerate-with-feedback
consumes:
  - role: spec
    required: true
  - role: plan
    required: true
  - role: test-plan
    required: false
  - role: verification-log
    required: false
produces:
  - role: delivery-doc
    kind: markdown
    primary: true
outputSchemaRef: "skill://atom-tasks/delivery-doc/delivery-doc.output.schema.json"
---

# delivery-doc

> 生成交付文档：需求回溯、变更清单、风险说明、验证结论。用于 PR 正文和 issue 评论。

## 指令

1. 读取 `{{inputs.spec}}`、`{{inputs.plan}}`、`{{inputs.test-plan}}`（如有）、`{{inputs.verification-log}}`（如有）
2. 生成 delivery-doc，按以下结构组织：

```markdown
# 交付文档

## 项目概述

<spec.md 中的项目概述>

## 需求回溯

### 原始需求

<spec.md 中的功能需求>

### 验收标准

<spec.md 中的验收标准>

### 验证结果

<verification.log 中的验证结果摘要>

## 变更清单

<本次变更涉及的文件和改动摘要>

## 风险说明

<plan.md 中的风险与权衡>

## 产物链接

- Spec: [spec.md](./spec.md)
- Plan: [plan.md](./plan.md)
- Test Plan: [test-plan.md](./test-plan.md)
- Tasks: [tasks/](./tasks/)
```

3. 输出 delivery-doc

## 约束

- 内容自包含，可在 PR 页面直接查看
- 不包含敏感信息（密钥、凭证）
- 复用既有归档模板机制
- 必须包含需求回溯和验证结论
