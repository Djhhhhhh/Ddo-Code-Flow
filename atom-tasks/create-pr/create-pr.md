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

# create-pr

> 推送特性分支，创建 draft PR，评论 PR 链接到 issue，更新 issue label 为 ddo:completed。

## 指令

1. 推送特性分支到远程：
   ```
   git push origin HEAD
   ```

2. 创建 draft PR：
   ```
   gh pr create \
     --draft \
     --title "feat: <spec.md 项目概述>" \
     --body "Closes #<issueNumber>\n\n## 执行摘要\n\n<delivery-doc.md 内容摘要>\n\n## 产物链接\n\n- Spec: docs/<type>/<dateDescription>/spec.md\n- Plan: docs/<type>/<dateDescription>/plan.md\n- Test Plan: docs/<type>/<dateDescription>/test-plan.md\n- Tasks: docs/<type>/<dateDescription>/tasks/\n\n## 验证结论\n\n<verification.log 摘要>" \
     --base <baseBranch>
   ```

3. 评论 PR 链接到 issue：
   ```
   gh issue comment <issueNumber> --body "✅ PR 已创建：$(gh pr view --json url --jq '.url')"
   ```

4. 更新 issue label：
   ```
   gh issue edit <issueNumber> --add-label "ddo:completed"
   gh issue edit <issueNumber> --remove-label "ddo:in-progress"
   ```

5. 输出 pr-info.md：
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
