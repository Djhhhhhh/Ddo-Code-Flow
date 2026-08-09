# Task 02: issue-fetch 原子任务

> 关联验收点：G1（Issue 触发与认领）

## 目标

创建 `issue-fetch` 原子任务，实现认领锁 + 拉取 issue 内容 + 完整性检查。

## 变更文件

- `atom-tasks/issue-fetch/issue-fetch.md`（新建）
- `atom-tasks/issue-fetch/issue-fetch.output.schema.json`（新建）

## 具体改动

### 1. 创建 issue-fetch.md

```yaml
---
name: issue-fetch
version: "1.0.0"
stage: requirement
enabled: true
timeoutSec: 120
concurrency:
  parallelizable: false
confirmation:
  required: false
io:
  inputs: []
  outputs:
    - ref: "run://docs/{type}/{dateDescription}/issue-context.md"
      kind: markdown
options:
  - name: issueRef
    type: string
    required: true
    description: "Issue 编号或 URL"
  - name: claimLabel
    type: string
    default: "ddo:in-progress"
    description: "认领锁 label 名"
  - name: triggerLabel
    type: string
    default: "ddo:trigger"
    description: "触发 label 名"
---
```

指令部分实现：
1. 解析 issueRef → issueNumber
2. gh issue view 获取 issue 内容
3. 检查 ddo:in-progress 不存在（未被认领）
4. 检查 ddo:trigger 存在（有触发标记）
5. 添加 ddo:in-progress（认领锁）
6. 移除 ddo:trigger（防止重复扫描）
7. 提取 issue 内容 → issue-context.md
8. 需求完整性检查：title 非空 + body ≥ 50 字符

### 2. 创建 issue-fetch.output.schema.json

定义 issue-context.md 的输出格式：
- Issue 编号、标题、正文
- Labels 列表
- Comments 列表
- 认领时间

## 约束

- 认领是原子操作：先打 label 再开始工作
- 已认领的 issue 直接跳过（abort）
- 一次 run 只认领一个 issue
- 需求不完整时暂停并评论缺失项
