---
name: delivery-doc
version: "1.0.0"
stage: delivery
enabled: true
timeoutSec: 0
concurrency:
  parallelizable: false
confirmation:
  required: false
io:
  inputs:
    - ref: "run://docs/{type}/{dateDescription}/spec.md"
      required: true
    - ref: "run://docs/{type}/{dateDescription}/plan.md"
      required: true
    - ref: "run://docs/{type}/{dateDescription}/test-plan.md"
      required: false
    - ref: "run://docs/{type}/{dateDescription}/verification.log"
      required: false
  outputs:
    - ref: "run://docs/{type}/{dateDescription}/delivery-doc.md"
      kind: markdown
---

# delivery-doc

> 生成交付文档：需求回溯、变更清单、风险说明、验证结论。用于 PR 正文和 issue 评论。

## 指令

1. 读取 spec.md、plan.md、test-plan.md（如有）、verification.log（如有）
2. 生成 delivery-doc.md，按以下结构组织：

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

3. 输出 delivery-doc.md

## 约束

- 内容自包含，可在 PR 页面直接查看
- 不包含敏感信息（密钥、凭证）
- 复用既有归档模板机制
- 必须包含需求回溯和验证结论
