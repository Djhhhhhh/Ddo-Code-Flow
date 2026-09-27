# deliver-pr

> 推送特性分支并创建正式 PR，经用户合并确认门放行后续清理。单一职责：把已完成分支变成已合并 PR——不含任何 issue 逻辑（issue 关联由 link-issue 任务承担）。

**总约束**（两相位通用）：

- 本任务只做 推送 → 建正式 PR → 等待用户确认合并；不合并 PR、不清理 worktree、不关联 issue。
- 合并动作永远由用户在 GitHub（或宿主 shell）完成，本任务只确认结果。
- 任何 git/gh 失败（网络、权限、未认证）立即暂停报告，不得带错推进。

<!-- @phase:01 -->
## 推送并创建 PR

1. 读 state（现读不缓存）：源分支 = `git.branch`（缺失时在生效工作目录 `git branch --show-current` 现读）；合并目标 base = `atomTasks["deliver-pr"].baseBranch`，未配置时回落 `git.mainBranch`；PR 标题引用 run 的 `title`；
2. 推送：`git push -u origin <源分支>`——失败则立即暂停报告，不继续后续步骤；
3. 创建正式 PR：`gh pr create --base <base> --head <源分支> --title <标题>`，**不得携带 draft 标志**；正文以 run 的 title 为纲概述本次交付，Context 中存在交付文档时以其为正文基础；
4. 创建成功后将 PR 编号、URL、源分支、base 分支（实际生效值）、状态（ready，非 draft）、创建时间写入 `pr-info.md`（按 Output Contract）；
5. 向用户展示 PR 链接与合并目标 base，提示在 GitHub 完成合并后回到本任务相位 02 的确认门。
<!-- /phase:01 -->

<!-- @phase:02 -->
## 合并确认门

<!-- @interact:required tool=ask-user -->
必须调用宿主提问工具（如 Claude Code 的 AskUserQuestion）向用户请求确认，不得以自由文本代替，未获得用户明确回复前不得调用任何推进命令。
<!-- /interact -->

向用户呈现 Context: PR 信息（pr-info.md）的摘要与 PR 链接。

**门选项从确认门数据呈现**：读 state 的 `stages["deliver-pr"].gate.options`（可经 `status` 获取），把每个选项的 name/desc 原样呈现给用户。用户选择后按 action 处理：
- 命令型（`next --decision 已合并`）→ agent 代跑该命令；
- 相位内交互（`in-phase`，即「未合并」）→ 按下方行为定义处理，不触任何推进命令。
不得在门数据之外自造推进/回滚选项。

相位内交互行为定义：

- `未合并`：只读呈现 PR 当前状态（可执行一次 `gh pr view <PR编号> --json state` 供用户参考，**不轮询、不等待**），提示用户完成合并后再次呈现门选项；不改动 pr-info.md 既有字段，可在文末追加最近一次状态查询记录（追加内容仍受 Output Contract 约束）。
<!-- /phase:02 -->
