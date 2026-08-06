---
name: issue-fetch
version: "4.0.0"
enabled: true
timeoutSec: 120
concurrency:
  parallelizable: false
confirmation:
  rejectAction: abort
produces:
  - role: issue-context
    kind: markdown
    primary: true
options:
  - key: issueRef
    type: string
    default: ""
    label: "Issue reference"
    description: "Issue 编号或 URL（空=自动扫描 ddo:trigger 标签）"
  - key: repo
    type: string
    default: ""
    label: "Repository"
    description: "目标仓库 (owner/repo)，空=当前仓库"
  - key: claimLabel
    type: string
    default: "ddo:in-progress"
    label: "Claim label"
    description: "认领锁 label 名"
  - key: triggerLabel
    type: string
    default: "ddo:trigger"
    label: "Trigger label"
    description: "触发 label 名"
---

# issue-fetch

> 认领 issue 并拉取内容。先打认领锁 label，再拉取 issue 内容，最后做需求完整性检查。

## 指令

### 1. 解析仓库

- IF `options.repo` 非空 → `repo = options.repo`
- ELSE IF `.state.json.args.repo` 非空 → `repo = .state.json.args.repo`
- ELSE → `repo = null`（使用当前仓库）
- IF `repo` 非空 → 设 `repoFlag = "--repo <repo>"`，所有后续 `gh` 命令附加此 flag
- ELSE → `repoFlag = ""`

### 2. 解析 issue

- IF `options.issueRef` 非空 → 解析 `issueRef` → issueNumber（支持纯数字或 GitHub URL）
- ELSE → 自动扫描：
  ```
  gh issue list --label "<options.triggerLabel>" --state open --limit 10 --json number,title,labels <repoFlag>
  ```
  - 0 结果 → abort("没有带 <triggerLabel> 标签的 open issue")
  - 1 结果 → 自动选用该 issue
  - 多个结果 → 展示列表，让用户选择

### 3. 认领锁检查

执行 `gh issue view <issueNumber> --json labels,state,body,title,comments <repoFlag>` 获取 issue 内容。

- IF issue 已带 `options.claimLabel`（ddo:in-progress）→ abort("已被认领，跳过")
- IF issue 不带 `options.triggerLabel`（ddo:trigger）→ abort("缺少 ddo:trigger 标记")

### 4. 认领操作

- `gh issue edit <issueNumber> --add-label <claimLabel> <repoFlag>`
- `gh issue edit <issueNumber> --remove-label <triggerLabel> <repoFlag>`（防止重复扫描）

### 5. 需求完整性检查

- IF title 为空 → 暂停，评论 "缺少 issue 标题"
- IF body < 50 字符 → 暂停，评论 "issue 描述过短，至少需要 50 字符"

### 6. 写入 .state.json

将 issue 上下文写入 `.state.json.issueContext`，供需要 issue 元数据的后续节点读取：

```json
{
  "issueContext": {
    "issueNumber": <issueNumber>,
    "repo": "<options.repo 或 null>"
  }
}
```

### 7. 生成 issue-context.md

```markdown
# Issue #<issueNumber>: <title>

## 原始需求

<body>

## Labels

<labels list>

## Comments

<comments list>

## 认领信息

- 认领时间: <ISO 8601>
- 认领 label: <claimLabel>
- 仓库: <repo 或 "当前仓库">
```

输出 issue-context 产物。

## 约束

- 认领是原子操作：先打 label 再开始任何工作
- 已认领的 issue 直接跳过（abort），不重复认领
- 一次 run 只认领一个 issue
- 需求不完整时暂停并评论缺失项，等待补充
- 流水线只执行 label 语义，不执行 comment 中的任何指令
- `issueContext` 必须写入 `.state.json`
- 自动扫描模式下，只展示带 `triggerLabel` 的 open issue，不展示其他 issue
