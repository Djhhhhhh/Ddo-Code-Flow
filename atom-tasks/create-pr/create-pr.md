---
name: create-pr
version: "4.0.0"
enabled: true
timeoutSec: 300
concurrency:
  parallelizable: false
confirmation:
  rejectAction: abort
consumes:
  - role: delivery-doc
    required: true
  - role: issue-context
    required: false
produces:
  - role: pr-info
    kind: markdown
    primary: true
outputSchemaRef: "skill://atom-tasks/create-pr/create-pr.output.schema.json"
options:
  - key: issueNumber
    type: integer
    default: 0
    label: "Issue number"
    description: "关联 issue 编号（空=从 .state.json.issueContext.issueNumber 读取）"
  - key: repo
    type: string
    default: ""
    label: "Repository"
    description: "目标仓库 (owner/repo)，空=从 .state.json.issueContext.repo 或当前仓库读取"
  - key: baseBranch
    type: string
    default: "main"
    label: "Base branch"
    description: "目标分支"
  - key: draftPR
    type: boolean
    default: true
    label: "Draft PR"
    description: "是否创建 draft PR"
---

# create-pr

> 推送特性分支，创建 draft PR，评论 PR 链接到 issue，更新 issue label 为 ddo:completed。

## 指令

### 0. 解析参数

- **issueNumber**: If `options.issueNumber` is set, use it. Else read `.state.json.issueContext.issueNumber`. If neither exists, abort.
- **repo**: If `options.repo` is set, use it. Else read `.state.json.issueContext.repo`. If neither, use current repo.
- **repoFlag**: `--repo <repo>` if repo is resolved, else `""`.

1. 推送特性分支到远程：
   ```
   git push origin HEAD
   ```

2. 创建 draft PR：
   ```
   gh pr create \
     --draft \
     --title "feat: <项目概述>" \
     --body "Closes #<issueNumber>\n\n## 执行摘要\n\n<delivery-doc 内容摘要>\n\n## 产物链接\n\n- 产物目录: .ddo/runs/<type>/<dateDescription>/\n\n## 验证结论\n\n<verification 摘要>" \
     --base <baseBranch>
   ```

3. 评论 PR 链接到 issue：
   ```
   gh issue comment <issueNumber> --body "✅ PR 已创建：$(gh pr view --json url --jq '.url')" <repoFlag>
   ```

4. 更新 issue label：
   ```
   gh issue edit <issueNumber> --add-label "ddo:completed" <repoFlag>
   gh issue edit <issueNumber> --remove-label "ddo:in-progress" <repoFlag>
   ```

5. 输出 pr-info：
   ```markdown
   # PR 信息

   - PR 编号: #<prNumber>
   - PR URL: <prUrl>
   - 关联 Issue: #<issueNumber>
   - 分支: <currentBranch> → <baseBranch>
   - 类型: Draft PR
   - 创建时间: <ISO 8601>
   ```

## 约束

- 合并永远由人执行（draft PR + 人工合并是最后安全阀）
- PR 正文必须包含关闭 issue 的引用（Closes #N）
- 必须评论 PR 链接到 issue
- 必须更新 issue label 为 ddo:completed
- 必须移除 ddo:in-progress label
