# link-issue

> 将 PR 与显式指定的 issue 建立评论关联（仅出现在 pr-delivery-issue 变体链，位于合并确认门之后）。

## 指令

1. 从 Context: PR 信息（pr-info.md）读取 PR 编号与 URL；
2. 读取关联 issue 号：`atomTasks["link-issue"].issueNumber`（现读 state）；缺失时向用户显式索取，**禁止从分支名解析**；
3. 在 issue 侧评论关联：`gh issue comment <issue号> --body "已由 PR #<编号> 交付：<URL>"`（正文含 PR 链接与一句话交付说明；gh 失败立即暂停报告）；
4. 将 issue 号、PR 编号与 URL、issue 评论链接（以命令输出为准）写入 `issue-link.md`（按 Output Contract）；
5. 不自动关闭 issue、不修改 label；若 issue 仍开着，向用户提示可自行决定是否关闭。

## 约束

- 单一职责：仅建立 PR↔issue 关联，issue 的关闭与 label 属 issue-driven 开发流，不在本任务内。
