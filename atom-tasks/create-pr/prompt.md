# create-pr

> 推送特性分支、创建 draft PR、关联 issue，产出 pr-info.md。

## 指令

1. 读取 Context 中的交付文档；issue 信息从 Context 的 Issue Context（若有）或 run 配置（state.atomTasks.create-pr.issueNumber）获取；
2. 推送当前开发分支到远程（`git push -u origin <branch>`，网络/权限失败则暂停报告）；
3. 以交付文档为正文创建 PR（默认 draft，配置 draftPR=false 则正式 PR），标题引用 run 的 title；目标分支取配置 baseBranch（默认主分支）；
4. 存在关联 issue 时：在 issue 评论 PR 链接，并更新 issue label（如移除触发 label、添加进行中 label）；
5. 将 PR 编号、URL、分支、目标分支、关联 issue 写入 `pr-info.md`，向用户展示结果并提示确认合并时机。

TTY 需要的认证类命令（如 `gh auth login`）不得代跑——交用户以宿主 shell 前缀执行。
