# Task 06: delivery-doc 原子任务

> 关联验收点：G4（交付与 PR 闭环）

## 目标

创建 `delivery-doc` 原子任务，生成需求回溯文档。

## 变更文件

- `atom-tasks/delivery-doc/delivery-doc.md`（新建）
- `atom-tasks/delivery-doc/delivery-doc.output.schema.json`（新建）

## 具体改动

### 1. 创建 delivery-doc.md

```yaml
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
```

指令部分实现：
1. 读取 spec.md、plan.md、test-plan.md、verification.log
2. 按归档模板汇总：
   - 需求回溯：issue → 功能需求 → 验收标准 → 验证结果
   - 变更清单：修改的文件列表
   - 风险说明：已知风险和缓解措施
3. 输出 delivery-doc.md

### 2. 创建 delivery-doc.output.schema.json

定义 delivery-doc.md 的输出格式：
- 项目概述
- 需求回溯
- 变更清单
- 风险说明
- 验证结论

## 约束

- 复用既有归档模板机制
- 内容自包含，可在 PR 页面直接查看
- 不包含敏感信息
