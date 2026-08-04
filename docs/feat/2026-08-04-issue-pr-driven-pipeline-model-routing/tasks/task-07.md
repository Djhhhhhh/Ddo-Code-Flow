# Task 07: create-pr 原子任务

> 关联验收点：G4（交付与 PR 闭环）

## 目标

创建 `create-pr` 原子任务，实现推送分支 + 创建 draft PR + 评论 issue + 更新 label。

## 变更文件

- `atom-tasks/create-pr/create-pr.md`（新建）
- `atom-tasks/create-pr/create-pr.output.schema.json`（新建）

## 具体改动

### 1. 创建 create-pr.md

```yaml
---
name: create-pr
version: "1.0.0"
stage: delivery
enabled: true
timeoutSec: 300
concurrency:
  parallelizable: false
confirmation:
  required: false
io:
  inputs:
    - ref: "run://docs/{type}/{dateDescription}/delivery-doc.md"
      required: true
    - ref: "run://docs/{type}/{dateDescription}/.state.json"
      required: true
  outputs:
    - ref: "run://docs/{type}/{dateDescription}/pr-info.md"
      kind: markdown
options:
  - name: issueNumber
    type: integer
    required: true
    description: "关联 issue 编号"
  - name: baseBranch
    type: string
    default: "main"
    description: "目标分支"
  - name: draftPR
    type: boolean
    default: true
    description: "是否创建 draft PR"
---
```

指令部分实现：
1. 推送特性分支到远程
2. 创建 draft PR：
   - 正文包含 Closes #issueNumber
   - 执行摘要
   - 产物链接
   - 验证结论
3. 评论 PR 链接到 issue
4. 添加 ddo:completed label 到 issue
5. 输出 pr-info.md

### 2. 创建 create-pr.output.schema.json

定义 pr-info.md 的输出格式：
- PR 编号和 URL
- 关联 issue 编号
- 分支信息
- 创建时间

## 约束

- 合并永远由人执行（draft PR + 人工合并是最后安全阀）
- PR 正文必须包含关闭 issue 的引用
- 必须评论 PR 链接到 issue
- 必须更新 issue label 为 ddo:completed
