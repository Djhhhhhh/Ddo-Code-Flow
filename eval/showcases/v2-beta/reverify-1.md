# 复验记录 1 — v2-beta 同版本重跑（F5 专项轮）

> 依据：[verify/v2-beta.md](../../verify/v2-beta.md)（冻结 playbook）§3 全步执行 + §6 首跑基线对照。
> 本轮定位：首跑因 A-1/A-2 漏出「exec 硬约束」场景（playbook §6 注明"后续轮次此步不可省"），本轮为该专项的首轮复验；同版本重跑，按 §5 追加本记录至现有 showcase。
> 结论先行：**通过**——§3 全部断言成立 + §4 形态一致；未触发 D-N 记账（无断言失败）；新观察项 4 条见文末（均为非阻断，建议随版本决策）。

## 基础信息（playbook §5 必备，缺项 = 报告不合格）

| 项 | 值 |
|---|---|
| 执行主体（agent） | **ZCode CLI 会话，模型 GLM-5.3-Flash**（account:bigmodel-start-plan/GLM-5.3-Flash） |
| 决议主体 | 4 门决议 + 2 BQ 回答：**playbook §2.3 既定决议脚本**（用户预先授权的固定输入，保证跨轮可比）；human 验收 2 项：**真人用户**（经宿主提问工具 AskUserQuestion 实答，2/2 通过） |
| 被测工具版本 | ddo-code-flow **v2-beta**（SKILL `version: 2.0.0`） |
| 代码基线 | git HEAD `8dcaac3`（feat/ddo-code-flow-v2）+ 运行中未提交变更：仅未跟踪文件 `.zcodeignore`（本轮前已存在，与被测工具无关） |
| CLI | `node tools/cli.js`（零依赖 Node 内核） |
| Node | v22.23.1 |
| OS | macOS 27.0（Darwin 27.0.0, arm64） |
| DDO_HOME | 真实 `~/.ddo`（非隔离——顺带验证全局索引/发现层多项目行为） |
| 执行窗口 | 本地 02:24–02:48（净约 24 分钟，含 2 次人工提问等待与 1 次 reflection 重做） |
| 测试基线 | 82/82 用例全绿（step 0，02:24:16） |

## 输入（与首跑一致，保证可比）

- 沙箱：`eval/runs/20260924-visualizer-v2beta-r2`（新建，run 目录 `feat/main` + `feat/main2`）
- 任务输入：playbook §2.2 固定示例（可视化工具），逐字一致
- 预设：`standard`（10 阶段 4 门）；`test-plan.tdd=false`（state 预填，未调整）

## 断言对照（playbook §3 → 本轮结果）

| 步 | 断言 | 结果 |
|---|---|---|
| 0 | 82/82 全绿 | ✅ |
| 1 | workflows 含 basic+standard；tasks 17 全含 desc | ✅ |
| 2 | run start exit 0；currentStage=requirement:01；**F6** startedAt 本地时区 +08:00 非 Z、日期=runId 日期；dirs 三绝对路径、runDir⊂projectRoot | ✅（run `20260924-022442-ccde`，startedAt `2026-09-24T02:24:42.569+08:00`） |
| 3 | requirement：exec 组装含 Output Contract；validate true；next 激活 spec | ✅ |
| 4 | spec:01 → 门开；无决议 next 拦截 exit 1 + 选项清单（**F1**） | ✅（选项 = 同意/驳回/修改/提问） |
| 5 | **F2** BQ-1=仅运行中 run、BQ-2=静态 HTML 写回 + 对齐变化摘要 + 重新送审；**F8** 驳回 → rollback：spec.md 移入 `_del/rollback-1/`、原位消失、archivedTo 告知、门清除；重做（重新 exec）后「同意」 | ✅ |
| 6 | plan：exec → validate 一次过（占位符标题按模板语义匹配，D-1 修复生效）→ 门「同意」 | ✅ |
| 7 | **F5 专项**：`run finish --status aborted` → history 行 statePath 绝对（**F7**）→ 重开 run `20260924-023150-94cb` → requirement/spec 两相位重新 exec 并当次完整消费 | ✅（含一次自纠：spec exec 输出曾用 `tail` 截断展示，判定为 A-2 同型风险，立即重跑完整消费——过程记录见「执行审计」） |
| 8 | test-plan：真实组名 `## G1. 运行发现` 等过 validate（**D-1 复验点**）→ 门「同意」 | ✅（附修正循环 1 次：示例与 schema 不一致，见观察 O-1） |
| 9 | **F4** tasking 就绪前抢跑 `exec --task coding` → exit 1「执行位置不符」；tasking 产物（task-group.json + task-01..03.md）validate 过 | ✅ |
| 10 | coding：按 task-01→03 串行批次实现 visualize.js（零依赖 296 行）；自检循环 2 轮内收敛（真实数据 + 空索引 + 损坏 state + 全阶段带门对抗样例，crossings: 0）；代码全部落沙箱内 | ✅ |
| 11 | verification：cmd 5/5 exit 0；**human 2/2 经宿主提问工具由真人确认**（未代答）；ALL PASSED；validate 过 | ✅ |
| 12 | review 9 条全遍历（8 通过 + 1 不适用）；execution-report 含决策留痕引用 | ✅ |
| 13 | reflection：validate 修正循环 1 次（空 structured-list 盲区，见观察 O-2）→ 门「同意」 → completed:true | ✅ |
| 14 | **F7** history jsonl statePath 绝对；**F6** startedAt/endedAt 本地时区且日期=runId 日期；**F9** `~/.ddo/history/<runId>/.state.json` 存在、runId/title/4 门留痕一致、保留收束前 currentStage；index 清空 | ✅（endedAt `2026-09-24T02:47:31.169+08:00`） |
| 15 | **F10** resume：全局清单含本 run（位置概要 coding:01）；`resume --run-id` 返回双清单（gateOptions + availableCommands） | ✅（step 11 前插执行） |

## §4 形态核对

| 对象 | 期望 | 实际 |
|---|---|---|
| run 目录文件 | 全套产物齐全 | ✅ requirement/spec/plan/test-plan.md、tasks/{task-group.json,task-01..03.md}、verification.log、review-report.md、execution-report.md、reflection-report.md |
| `_del` 归档 | 驳回/重做产物移动归档 | ✅ `feat/main/_del/rollback-1/spec.md`（run1 驳回）、`feat/main2/_del/rollback-1/reflection-report.md`（reflection 重做）；原位均无同名残留 |
| state 留痕 | 4 门 decision+closedAt、本地时区 | ✅ 同意×4，全部 `+08:00` |
| history jsonl | 本轮 1 行 aborted + 1 行 done，statePath 绝对 | ✅（已拷贝至 [state-archive/reverify-1-runs.jsonl](state-archive/reverify-1-runs.jsonl)） |
| 归档副本 | 与原文件一致、保留收束前位置 | ✅（[state-archive/reverify-1-done.state.json](state-archive/reverify-1-done.state.json)，currentStage=[]（completed 后收束，忠实保留）） |
| agent 行为（F5） | 每相位当次 exec 记录；中断重开后无凭记忆直写 | ✅ run2 全部 5 个 exec 相位（requirement/spec/plan/test-plan/tasking/coding/verification/review/reporting/reflection 中所有相位）均当次 exec；重开后 requirement/spec 重新 exec 消费 |

## 机制触发记录（本轮实际 exercise）

- 确认门拦截：4 门全开全关；无决议 `next` 拦截 1 次（spec:02，exit 1 + 选项清单）
- BQ 写回循环：2 问 → spec 修订 + 对齐变化摘要 → 重新送审（run1）；重开 run 以已决议证据直接生成（run2）
- rollback `_del`：2 次（run1 spec 驳回；run2 reflection 协议完整性重做）——**done 阶段亦可回滚**（本次实测 reflection done→pending）
- 修正循环：2 次（test-plan 示例/schema 不一致；reflection 空 structured-list），错误信息均可自定位
- 位置锁：1 次（tasking 抢跑 coding，exit 1）
- 中断重开：1 次（F5 专项，aborted 正规收束 + 重开）
- resume 发现层：1 次（运行中插桩，双清单完整）
- 自检循环（coding）：对抗样例（全 10 阶段带门）crossings: 0 一次收敛
- 收尾归档：done 四步迁移全验证（归档/jsonl/index/清空）

## 执行审计（如实）

- **状态推进 100% 经 CLI**：run start ×2 / exec / validate / next（含 4 门 `--decision`）/ rollback / run finish ×2；未手改 state。
- **F5 硬约束执行情况**：中断重开后全部相位重新 exec 并消费；过程中出现 1 次「exec 输出经 `tail` 截断后即动手」的倾向（与 A-2 同型），**当轮自查发现并立即重跑完整消费**——硬约束协议有效，但依赖 agent 自律（呼应观察 O-4）。
- **1 次纪律失误已自纠**：reflection 相位 validate 失败（exit 1）后同批次 `next` 仍被执行、门被决议——发现后以 rollback 重做恢复协议完整性（validate 通过后再过门）。此事件暴露「不带错推进」无结构拦截（观察 O-3）。
- coding「state 写任务完成标记」无命令面（09-O2 挂账）：本轮与首跑一致，串行批次未受影响，未手改 state。

## 本轮观察项（无断言失败，未启用 D-N 记账；建议随版本决策）

| # | 观察 | 影响 | 建议去向 |
|---|---|---|---|
| O-1 | test-plan 组装 prompt 的「完整示例」为扁平格式（`通过标准：…` 直接跟条目），与 Output Contract 的 `### Checklist` / `### 通过标准` 子节结构**不一致**——照示例写必被 validate 拦 | 低：修正循环 1 次，stderr 可自定位；但示例即权威误导 | atom-tasks/test-plan 示例与 schema 对齐 |
| O-2 | reflection「未完结项（Open items）」零命中时无合规表达：structured-list 仅在 body 非空时免检，而 `---` 分隔风格使空 section body 恒为 `---`（非空）——**空集场景不可满足** | 低：以真实预留项（plan 预留路由 + 自检用例缺口）填充后通过；但纯零标记任务将被迫虚构条目或接受修正循环 | schema 定义空集语义（如 body 为空或仅分隔线时跳过 ID 检查） |
| O-3 | **validate 失败不拦截 next/门关闭**：「不带错推进」目前仅是 SKILL 协议约束，实测同批次 validate exit 1 后 next 仍开门并被 `--decision` 关闭 | 中：依赖 agent 纪律；与 07-O3（窗口绑定）同族的结构缺口 | 评估在 next 中加入「当前相位 validate 未过」拦截或门开启前置校验 |
| O-4 | reporting prompt 要求「决策日志原样引用 `.state.json.history` 条目」，但 v2 state 无 `history` 字段（留痕在 `stages[k].gate` 与 `at`）——prompt 与 state 结构脱节 | 低：agent 按实际字段如实处理并注明；但严格照 prompt 执行会「编造」或空转 | atom-tasks/reporting prompt 与 v2 state 结构对齐 |

## 与首跑基线对照（§6）

- 首跑 8/10 相位真实 exec（2 处 A-1/A-2 捷径）→ 本轮 **10/10 相位当次 exec 消费**（1 次 A-2 同型倾向当轮自纠）——SKILL 硬约束（内审 A-1/A-2 处置）有效
- 首跑未注入「驳回」（F8 由单测与 rollback 观察替代）→ 本轮完成**驳回注入**：F8 三要素（archivedTo/原位消失/重做新文件）全验证
- 首跑未做中断重开复验 → 本轮完成（含 F7 在 aborted 行上的断言）
- 首跑 D-1 在 test-plan 相位真实拦截 → 本轮 D-1 修复复验通过（真实组名过 validate）
- 首跑门决议/ BQ / human 全部真人实时输入 → 本轮门/BQ 为既定决议脚本驱动，human 仍为真人实答——跨轮可比性与协议合规的折中，如实记录
