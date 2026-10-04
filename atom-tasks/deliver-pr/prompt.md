# deliver-pr

> 推送特性分支并创建正式 PR，经用户合并确认门放行后续清理。单一职责：把已完成分支变成已合并 PR——不含任何 issue 逻辑（issue 关联由 link-issue 任务承担）。

**总约束**（两相位通用）：

- 本任务只做 推送 → 建正式 PR → 等待用户确认合并；不合并 PR、不清理 worktree、不关联 issue。
- 合并动作永远由用户在 GitHub（或宿主 shell）完成，本任务只确认结果。
- 任何 git/gh 失败（网络、权限、未认证）立即暂停报告，不得带错推进。
- 多仓库隔离 run（`state.git.multiRepo` 为 true）：本任务**逐仓库**执行——对 `state.git.repos` 每项依序完成推送与建 PR，任一仓库失败即暂停报告（不产出 pr-info.md、不进入确认门）。

<!-- @phase:01 -->
## 推送并创建 PR

1. 读 state（现读不缓存）：源分支 = `git.branch`（缺失时在生效工作目录 `git branch --show-current` 现读）；合并目标 base = `atomTasks["deliver-pr"].baseBranch`，未配置时回落 `git.mainBranch`；PR 标题引用 run 的 `title`；
2. 推送：`git push -u origin <源分支>`——失败则立即暂停报告，不继续后续步骤；
3. 创建正式 PR：`gh pr create --base <base> --head <源分支> --title <标题>`，**不得携带 draft 标志**；正文以 run 的 title 为纲概述本次交付，Context 中存在交付文档时以其为正文基础；
4. 创建成功后将 PR 编号、URL、源分支、base 分支（实际生效值）、状态（ready，非 draft）、创建时间写入 `pr-info.md`（按 Output Contract）；
5. 向用户展示 PR 链接与合并目标 base，提示在 GitHub 完成合并后回到本任务相位 02 的确认门。

**多仓库隔离 run 的逐仓库展开**（`state.git.multiRepo` 为 true 时替代上述单分支语义，单仓库行为不变）：

1. 对 `state.git.repos` 每项依序：在该仓库工作树（`repos[i].worktreePath`）内推送 `repos[i].branch`；base 缺省 = `repos[i].mainBranch`（`baseBranch` 旋钮显式配置时全局覆盖，pr-info 如实记录各仓库实际生效值）；PR 标题引用 run 的 `title`（可附仓库名消歧）；
2. 任一仓库推送或建 PR 失败 → 立即暂停报告（列出已完成与未完成仓库），不产出 pr-info.md、不进入确认门；
3. 全部成功后写 `pr-info.md`：`## PR 信息` 为逐仓库汇总（每仓库一行：仓库/编号/URL/源分支/base/状态），并可按仓库另设 `## PR 信息（<仓库名>）` 明细节（按 Output Contract）；
4. 向用户展示全部 PR 链接与各仓库 base，提示全部合并完成后回到相位 02 确认门。
<!-- /phase:01 -->
<!-- @phase:02 -->
## 合并确认门

<!-- @interact:required tool=ask-user -->
必须调用宿主提问工具（如 Claude Code 的 AskUserQuestion）向用户请求确认，不得以自由文本代替，未获得用户明确回复前不得调用任何推进命令。
<!-- /interact -->

向用户呈现 Context: PR 信息（pr-info.md）的摘要与 PR 链接（multi run 呈现全部仓库的 PR 状态；「已合并」须逐仓库全部合并）。

**门选项从统一呈现入口获取**：跑 `node tools/cli.js gate present --state <statePath>` 取交互 payload（本门全部选项的 name/desc/dispatch），把各选项原样呈现给用户（宿主提问工具），不得在 payload 之外自造选项。用户选择后按 dispatch 处理：
- 命令型（`next --decision 已合并`）→ agent 代跑 dispatch 命令；
- 相位内交互（`in-phase`，即「未合并」）→ 先 `gate interact --state <statePath> --option 未合并 [--note <摘要>]` 记录交互，再按下方行为定义处理；处理完成后**重新 `gate present` 送审**——未重新呈现前的决议会被结构拦截（重新询问由结构强制，不靠自觉）。

相位内交互行为定义：

- `未合并`：只读呈现 PR 当前状态（multi run 可对未合并仓库各执行一次 `gh pr view <PR编号> --json state` 供用户参考，**不轮询、不等待**），提示用户完成合并后再次呈现门选项；不改动 pr-info.md 既有字段，可在文末追加最近一次状态查询记录（追加内容仍受 Output Contract 约束）。
<!-- /phase:02 -->
