# timeline — v2 内测 dogfooding（run 20260924-014319-025b）

> standard 全链 10 阶段 · 4 门决议 · 1 次中断重开 · 1 个阻断缺陷 + 2 个内审缺陷被发现并修复
> 时间为本地时间（Asia/Shanghai，UTC+8）。v2 内审修复（D-3）前 state 留痕为 UTC Z 格式，
> 下表已换算；`*.state.json` 归档原件保留当时的 UTC 值（历史事实不改档）。

## 事件时间线

| 本地时刻 | 事件 | 留痕 |
|---|---|---|
| 01:39 | 首次 run start（误启于 eval 根目录，runId 20260924-013956-1c9d） | index 注册 |
| 01:40–01:43 | requirement:01 完成并推进到 spec:01 | state.currentStage |
| ~01:43 | **用户中断**：「eval 目录结构需要设计…长期工作…可复用结构」 | 会话记录 |
| 01:43 | 首个 run 正规收束 `--status aborted`（残留沙箱删除）；eval/README 工作区规范定版（runs/ 沙箱 + showcases/ 归档 + 快速验证流程） | history jsonl 第 1 行 |
| 01:43 | 重开 run（沙箱 eval/runs/20260924-visualizer-v2beta，--dir-name main） | runId 20260924-014319-025b |
| 01:43 | requirement:01 → done（validate ✓ → next） | — |
| 01:44 | spec:01 产出 → validate ✓ → next 开门 | gate.openedAt 01:44:21 |
| ~01:44 | **BQ 相位内澄清**（AskUserQuestion）：BQ-1 仅运行中 run / BQ-2 静态 HTML → 写回 spec + 对齐变化摘要 | spec.md revision |
| 01:45 | **门 1/4 · spec:02 →「同意」** | decision+closedAt 01:45:32 |
| 01:46–01:48 | plan:01 产出 → **修正循环 1 次**（标题后缀被 validate 拦，改后过）→ 开门 → **门 2/4 · plan:02 →「同意」**（分层布局 + 虚拟节点链 + 诚实边界 + 零依赖） | plan.gate.decision |
| 01:48–01:52 | test-plan:01 产出 → validate **拦截（阻断缺陷 D-1）** → **修复**（契约占位符通配 + schema 归一 + 回归 2 例）→ validate ✓ → **门 3/4 · test-plan:02 →「同意」** | — |
| 01:52 | test-plan:03（tdd=false）→ exec 组装跳过语义 → next 完成 | — |
| 01:52–01:53 | tasking:01 → tasks/task-group.json + 3 任务文件 → validate ✓（**位置锁拦截 1 次**：tasking 抢跑，exit 1） | — |
| 01:53–01:57 | coding:01 按批次执行 task-01→03：布局算法**自检循环 2 轮**（第 1 轮通道路由被相交自检拦下 → 虚拟节点链重写 → 现实形态全 0 交叉，对抗用例 1 处如实计数）；visualize.js 完成；G1–G4 cmd 5/5 PASS；**一次未复现的空渲染瞬态** | layout.js / ddo-visual.html |
| 01:57–01:58 | verification:01 → human 项经 AskUserQuestion 用户确认 2/2 → ALL PASSED | verification.log |
| 01:58–01:59 | review:01 → 9 项复审：8 通过 + 1 不适用；捕获 plan/test-plan 的 exit 语义偏差并按「后批准者为准」裁决记录 | review-report.md |
| 01:59–02:00 | reporting:01 → execution-report.md ✓ | — |
| 02:00–02:03 | reflection:01 → 复盘（未完结 2 项 / 后续 3 条 / 经验 4 条）→ 开门 → **门 4/4 · reflection:02 →「同意」** → completed:true | closedGates 留痕 |
| 02:03 | **run finish --status done**：① state 归档 ~/.ddo/history/<runId>/ ② jsonl ③ index 移除 ④ currentStage 清空 | history jsonl 第 2 行 |
| 02:05–02:20 | **用户内审**：发现 D-3（时区）/ D-4（归档相对路径）/ 执行审计缺口 → 修复 + 回归（82/82） | 本文件 §内审 |

## 门决议汇总

| 门 | 选项集 | 决议 | 留痕 |
|---|---|---|---|
| spec:02 | 同意/驳回/修改/提问 | 同意（BQ-1/BQ-2 先行相位内澄清写回） | decision+closedAt ✓ |
| plan:02 | 同意/驳回/修改/提问/归档 | 同意 | decision+closedAt ✓ |
| test-plan:02 | 同意/驳回/修改/提问 | 同意 | decision+closedAt ✓ |
| reflection:02 | 同意/修改/提问 | 同意 | decision+closedAt ✓ |

## 机制触发记录（本 run 实际 exercise 的结构保证）

- 确认门拦截：4 门全部在无决议时拦下 `next`（exit 1 + 选项清单）
- BQ 写回循环：2 问 → spec 修订 + 对齐变化摘要 → 重新送审
- 修正循环：2 次（plan 标题 / test-plan 结构），错误信息可自定位
- 位置锁：1 次（tasking 抢跑被拦）
- validate 契约拦截：3 次（plan 标题、test-plan 占位符缺陷、结构预判）
- 中断重开：1 次（eval 结构定版；首个 run 走正规 aborted 收束——abort 路径同步验证）
- 自检循环（coding）：2 轮收敛（布局缺陷被相交自检当场捕获）
- 收尾归档：state 副本 + jsonl 双行（aborted + done）

## 用户内审发现（2026-09-24 02:05，run 结束后）

| # | 发现 | 根因 | 处置 |
|---|---|---|---|
| D-3 | runId（本地日期 0924）与 startedAt（UTC `2026-09-23T17:43Z`）**日期对不上**，`stages[k].at`/gate 时间戳全部 UTC——非上海时区，人工不可读 | `nowIso()` 用 `toISOString()`（恒 UTC），违反 02 §5.2.1「本地时间 + 带偏移 ISO」的设计意图 | 已修：本地时区偏移格式；回归 1 例（格式 + 与 runId 日期一致 + Date.parse 偏移语义） |
| D-4 | history jsonl 的 `statePath` 为**相对路径**（随执行 cwd 而变）——归档追溯指针不可解析，与 index 注册（绝对）形态不一致 | `runFinish` 把命令行 `--state` 参数原样写入 history | 已修：finish 统一 `path.resolve`；回归 1 例（跨 cwd 相对传参 → history 绝对 + realpath 等价 index） |
| A-1 | **执行审计：run2 的 spec:01 未执行 exec**——复用 aborted run 的组装结果，凭上下文记忆判断「与中断前一致」 | 同会话内 run 作废重开无协议指引；agent 侧无「跳过 exec」的结构拦截（07 O3 窗口绑定的变体） | 已修（协议层）：SKILL.md 逐相位循环补硬约束——当次 exec 当次消费，禁凭记忆替代；结构化拦截留 07 O3 |
| A-2 | run2 的 requirement:01 exec 输出被重定向丢弃，写产物凭记忆 | 同上 | 同上（同一条硬约束覆盖） |
| A-3 | coding prompt 要求「state 写任务完成标记」但无对应 CLI 命令 | 09-O2 已挂账的 prompt/命令面矛盾 | 维持挂账；本 run 批次串行未受影响 |

**执行审计结论（对用户三问的如实回答）**：状态推进 100% 经 CLI（含 4 门决议与 2 次收口）；门呈现与 BQ 澄清全部经宿主提问工具；但上下文组装存在 2 处捷径（A-1/A-2）——8/10 相位为真实 exec 消费，2 处凭记忆替代，均发生于中断重开场景。协议补丁已落，下轮 dogfooding 验证。
