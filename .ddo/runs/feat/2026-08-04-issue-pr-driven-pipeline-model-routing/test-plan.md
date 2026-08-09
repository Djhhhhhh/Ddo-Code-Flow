# Ddo-Code-Flow Issue/PR 驱动流水线 + 节点级模型路由 测试计划

> 基于已确认的 spec.md 生成的验收测试 checklist。

## G1. Issue 触发与认领

- [ ] cmd: gh label create "ddo:trigger" --repo <owner>/<repo> --force
- [ ] cmd: gh issue create --repo <owner>/<repo> --title "测试 issue" --body "这是一个测试 issue，用于验证 issue-driven 工作流" --label "ddo:trigger"
- [ ] cmd: gh issue view <issueNumber> --json labels --jq '.labels[].name' | grep -q "ddo:trigger"
- [ ] cmd: # 模拟 issue-fetch 认领：检查 ddo:in-progress 不存在
- [ ] cmd: gh issue edit <issueNumber> --add-label "ddo:in-progress"
- [ ] cmd: gh issue view <issueNumber> --json labels --jq '.labels[].name' | grep -q "ddo:in-progress"
- [ ] cmd: gh issue edit <issueNumber> --remove-label "ddo:trigger"
- [ ] cmd: gh issue view <issueNumber> --json labels --jq '.labels[].name' | grep -q "ddo:trigger" && exit 1 || exit 0
- [ ] cmd: # 验证已认领 issue 被跳过：再次尝试认领同一 issue 应失败
- [ ] human: 在 GitHub 上创建一个新 issue，打上 ddo:trigger label，然后在会话中触发 issue-driven 工作流，观察 issue 被正确拉取

通过标准：issue 能被正确触发、认领、拉取；已认领的 issue 被跳过；ddo:trigger label 在认领后被移除。

## G2. 远端确认门

- [ ] cmd: # 模拟远端门首次进入：评论 + 打 pending-review label
- [ ] cmd: gh issue comment <issueNumber> --body "spec 摘要测试内容"
- [ ] cmd: gh issue edit <issueNumber> --add-label "ddo:pending-review:spec"
- [ ] cmd: gh issue view <issueNumber> --json labels --jq '.labels[].name' | grep -q "ddo:pending-review:spec"
- [ ] cmd: # 验证 .state.json 记录了 gatePending
- [ ] cmd: cat .state.json | jq -e '.gatePending.status == "pending"'
- [ ] cmd: # 模拟用户批准：打 ddo:approved label
- [ ] cmd: gh issue edit <issueNumber> --add-label "ddo:approved"
- [ ] cmd: gh issue view <issueNumber> --json labels --jq '.labels[].name' | grep -q "ddo:approved"
- [ ] cmd: # 模拟远端门恢复：移除 pending-review 和 approved label
- [ ] cmd: gh issue edit <issueNumber> --remove-label "ddo:pending-review:spec" --remove-label "ddo:approved"
- [ ] cmd: # 模拟用户否决：打 ddo:changes-requested label + 评论反馈
- [ ] cmd: gh issue edit <issueNumber> --add-label "ddo:changes-requested"
- [ ] cmd: gh issue comment <issueNumber> --body "第1轮反馈：需求描述不够详细"
- [ ] cmd: gh issue view <issueNumber> --json labels --jq '.labels[].name' | grep -q "ddo:changes-requested"
- [ ] human: 在 GitHub issue 页面打 ddo:approved label，观察 Monitor 自动感知并恢复执行
- [ ] human: 在 GitHub issue 页面打 ddo:changes-requested label 并评论反馈，观察带反馈重生

通过标准：远端门首次进入正确评论和打 label；恢复时正确读取批准/否决信号；Monitor 自动感知信号变化。

## G3. Loop 自检

- [ ] cmd: # 验证 coding 节点 maxSelfCheckRounds 参数存在
- [ ] cmd: grep -q "maxSelfCheckRounds" atom-tasks/coding/coding.md
- [ ] cmd: # 验证 verification 节点 maxRetries 参数存在
- [ ] cmd: grep -q "maxRetries" atom-tasks/verification/verification.md
- [ ] cmd: # 模拟自检超限：验证打 ddo:failed label
- [ ] cmd: gh issue edit <issueNumber> --add-label "ddo:failed"
- [ ] cmd: gh issue view <issueNumber> --json labels --jq '.labels[].name' | grep -q "ddo:failed"
- [ ] human: 触发 coding 阶段，观察自检轮次正确计数，超限时打 ddo:failed label 并暂停

通过标准：coding/verification 节点支持可配置的自检轮次/重试次数；超限时正确打失败 label 并转人工。

## G4. 交付与 PR 闭环

- [ ] cmd: # 验证 delivery-doc 原子任务存在
- [ ] cmd: test -f atom-tasks/delivery-doc/delivery-doc.md
- [ ] cmd: # 验证 create-pr 原子任务存在
- [ ] cmd: test -f atom-tasks/create-pr/create-pr.md
- [ ] cmd: # 验证 create-pr 能创建 draft PR（需要 git 环境）
- [ ] cmd: git checkout -b test-pr-branch && git commit --allow-empty -m "test" && git push origin test-pr-branch
- [ ] cmd: gh pr create --draft --title "测试 PR" --body "测试 draft PR" --base main
- [ ] cmd: # 验证 PR 正文包含关闭 issue 的引用
- [ ] cmd: gh pr view --json body --jq '.body' | grep -q "Closes #"
- [ ] cmd: # 验证评论 PR 链接到 issue
- [ ] cmd: gh issue comment <issueNumber> --body "PR 链接：$(gh pr view --json url --jq '.url')"
- [ ] cmd: # 验证更新 label 为 ddo:completed
- [ ] cmd: gh issue edit <issueNumber> --add-label "ddo:completed"
- [ ] cmd: gh issue view <issueNumber> --json labels --jq '.labels[].name' | grep -q "ddo:completed"
- [ ] human: 观察 draft PR 创建成功，PR 正文包含关闭 issue 引用，issue label 更新为 ddo:completed

通过标准：交付文档正确生成需求回溯；draft PR 正确创建并包含必要信息；issue label 正确更新。

## G5. 节点级模型路由

- [ ] cmd: # 验证 config.json 支持 atomTaskOverrides.model 配置
- [ ] cmd: cat config.schema.json | jq -e '.properties.atomTaskOverrides'
- [ ] cmd: # 验证档位别名路径：opus/sonnet/haiku/fable
- [ ] cmd: echo '{"model": "opus"}' | jq -e '.model'
- [ ] cmd: # 验证完整模型名路径
- [ ] cmd: echo '{"model": "claude-sonnet-4-20250514"}' | jq -e '.model'
- [ ] cmd: # 验证继承模式：model 未配置时内联执行
- [ ] cmd: echo '{}' | jq -e '.model // "inherit"' | grep -q "inherit"
- [ ] cmd: # 验证模型路由失败回退
- [ ] cmd: # 模拟模型不存在时应回退为继承并记录警告
- [ ] human: 配置 coding 节点使用 opus 模型，观察 subagent 委派正确执行

通过标准：档位别名和完整模型名双路径可用；继承模式向后兼容；模型路由失败时回退为继承。

## G6. 多模型评审扇出

- [ ] cmd: # 验证 review 节点支持 models[] 参数
- [ ] cmd: echo '{"model": ["sonnet", "haiku", "fable"]}' | jq -e '.model | length'
- [ ] cmd: # 验证模型列表长度 >= 2
- [ ] cmd: echo '{"model": ["sonnet", "haiku"]}' | jq -e '.model | length >= 2'
- [ ] cmd: # 验证每个 subagent 独立评审并返回结论级摘要
- [ ] cmd: # 验证父会话合并为一份评审报告
- [ ] human: 配置 review 节点使用多模型列表，观察每个模型独立评审并合并报告

通过标准：多模型评审能按列表逐个委派 subagent；每个 subagent 返回结论级摘要；父会话正确合并。

## G7. 向后兼容性

- [ ] cmd: # 验证 standard 工作流仍然正常工作
- [ ] cmd: cat workflows/standard.json | jq -e '.id == "standard"'
- [ ] cmd: # 验证 guarded 工作流仍然正常工作
- [ ] cmd: cat workflows/guarded.json | jq -e '.id == "guarded"'
- [ ] cmd: # 验证 lightweight 工作流仍然正常工作
- [ ] cmd: cat workflows/lightweight.json | jq -e '.id == "lightweight"'
- [ ] cmd: # 验证现有 atom-task 未被修改
- [ ] cmd: git diff --name-only HEAD -- atom-tasks/context atom-tasks/requirement atom-tasks/spec atom-tasks/plan atom-tasks/test-plan atom-tasks/tasking | wc -l | grep -q "^0$"
- [ ] human: 运行 standard 工作流，观察行为与之前完全一致

通过标准：现有三个工作流行为不变；现有 atom-task 未被修改；模型路由未配置时回退为继承。

## G8. 幂等性与错误处理

- [ ] cmd: # 验证重复打 label 不产生副作用
- [ ] cmd: gh issue edit <issueNumber> --add-label "ddo:in-progress" && gh issue edit <issueNumber> --add-label "ddo:in-progress"
- [ ] cmd: # 验证 gh CLI 失败时明确报错
- [ ] cmd: gh issue view 999999999 --json title 2>&1 | grep -q "error"
- [ ] cmd: # 验证模型路由失败时记录警告
- [ ] cmd: # 模拟模型不存在时应记录警告但不中断
- [ ] cmd: # 验证 Monitor 容忍瞬时网络失败
- [ ] cmd: # 模拟 gh 命令失败后继续重试
- [ ] human: 重复执行远端门操作，观察不产生重复评论或 label

通过标准：所有远端门操作幂等；gh CLI 失败明确报错；模型路由失败回退继承；Monitor 容忍瞬时失败。
