# deliver-pr

> 推送特性分支并创建正式 PR，经用户合并确认门放行后续清理。单一职责：把已完成分支变成已合并 PR——不执行 issue 侧操作（评论关联由 link-issue 任务承担）。

**总约束**（两相位通用）：

- 本任务只做 推送 → 建正式 PR → 等待用户确认合并；不合并 PR、不清理 worktree、不执行 issue 评论、关闭或标签操作；正文可陈述已知关联事项。
- 合并动作永远由用户在 GitHub（或宿主 shell）完成，本任务只确认结果。
- 任何 git/gh 失败（网络、权限、未认证）立即暂停报告，不得带错推进。
- 多仓库隔离 run（`state.git.multiRepo` 为 true）：本任务**逐仓库**执行——对 `state.git.repos` 每项依序完成推送与建 PR（PR 内容格式逐 PR 适用），任一仓库失败即暂停报告（不产出 pr-info.md、不进入确认门）。

<!-- @phase:01 -->
## 推送并创建 PR

1. 读 state（现读不缓存）：源分支 = `git.branch`（缺失时在生效工作目录 `git branch --show-current` 现读）；合并目标 base = `atomTasks["deliver-pr"].baseBranch`，未配置时回落 `git.mainBranch`；
2. 准备 PR 内容：以 run 的 `title` 为目的线索，结合源分支相对 base 的实际变更与 Context 中可选的交付文档，按下方「PR 内容格式」生成标题和正文。交付文档只是信息来源，不能覆盖格式规则；不得直接照搬 run title、提交信息或仓库默认模板。材料不足以说明实际变更时暂停索取，不猜测；
3. 创建前检查：标题符合格式，正文五栏目齐全且顺序正确，填充实际内容，不保留占位符或模板提示注释；检查结果不得虚构。将正文写入 `<runDir>/pr-body.md`（runDir 取 state.dirs.runDir），每次执行本相位都重新生成，不复用旧文件内容。该文件是正文工作材料，正式结果仍为 `pr-info.md`；
4. 推送：`git push -u origin <源分支>`——失败则立即暂停报告，不继续后续步骤；
5. 创建正式 PR：`gh pr create --base "<base>" --head "<源分支>" --title "<已格式化标题>" --body-file "<正文文件绝对路径>"`，**不得携带 draft 标志**；标题与路径须作为独立且正确引用的 shell 参数传递，不得使用 `--fill` 或默认模板替代显式内容；
6. 创建成功后将 PR 编号、URL、源分支、base 分支（实际生效值）、状态（ready，非 draft）、创建时间写入 `pr-info.md`（按 Output Contract）；
7. 向用户展示 PR 链接与合并目标 base，提示在 GitHub 完成合并后回到本任务相位 02 的确认门。

**多仓库隔离 run 的逐仓库展开**（`state.git.multiRepo` 为 true 时替代上述单分支语义，单仓库行为不变）：

1. 对 `state.git.repos` 每项依序：在该仓库工作树（`repos[i].worktreePath`）内推送 `repos[i].branch`；base 缺省 = `repos[i].mainBranch`（`baseBranch` 旋钮显式配置时全局覆盖，pr-info 如实记录各仓库实际生效值）；
2. PR 内容按「PR 内容格式」逐 PR 生成：标题 scope 附仓库名消歧（如 `【feat】(svc-api):…`）；每仓库正文写入 `<runDir>/pr-body-<仓库名>.md`，五栏目格式与检查要求不变；
3. 推送与建 PR 任一仓库失败 → 立即暂停报告（列出已完成与未完成仓库），不产出 pr-info.md、不进入确认门；
4. 全部成功后写 `pr-info.md`：`## PR 信息` 为逐仓库汇总（每仓库一行：仓库/编号/URL/源分支/base/状态），并可按仓库另设 `## PR 信息（<仓库名>）` 明细节（按 Output Contract）；
5. 向用户展示全部 PR 链接与各仓库 base，提示全部合并完成后回到相位 02 确认门。

### PR 内容格式

本节是 PR 流水线的统一格式定义，两条交付预设均使用本任务，不依赖目标项目是否存在 GitHub PR 模板。

**标题**：`【type】(scope):<中文摘要>`。

- type 取 `feat / fix / docs / refactor / test / chore / perf / build / ci / revert`，根据实际变更选择，不能机械使用交付 run 的 type。
- scope 可省略，省略时连同圆括号一起省略；有 scope 时表示本次影响的模块或范围。
- 使用全角方括号 `【】`、半角圆括号和半角冒号，冒号后不加空格；摘要用中文描述实际变化，代码标识保留原文，不以“交付某某 PR”替代变化本身。
- 示例：`【feat】(deliver-pr):统一 PR 标题与正文格式`、`【docs】:补充使用说明`。

**正文**：以中文叙述，代码标识保留原文；固定保留以下五个二级标题及顺序，逐项填充：

```markdown
## 变更摘要

<一句话说明本次 PR 的目的>

## 主要变更

- <本次实际交付的变化>

## 验证结果

- <真实执行的命令或检查及结果；未执行的明确写明未执行及原因>

## 风险与兼容性

<已知风险、破坏性变更或迁移要求；不适用时写“无已知风险或兼容性影响”>

## 关联事项

<明确提供的 issue、相关 PR 或工作项；无关联时写“无”>
```

- 验证结果必须区分已通过、失败与未执行；不得把计划执行写成已通过，也不得照搬交付文档中过期的结果。
- 不为填充栏目虚构风险、迁移要求或关联事项；尚未确认的影响如实说明，不将未知写成无风险。
- 关联事项只陈述已知信息，禁止从分支名猜测 issue，禁止生成 `Closes/Fixes/Resolves` 自动关闭指令；不代替后续 link-issue 的评论关联。
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
