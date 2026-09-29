# timeline — v2-beta dashboard showcase（run 20260929-221955-b3cd）

> basic 全链 5 阶段 · 2 门决议 · 2 BQ 相位内问答 · WTT single 场景 · 无中断无回滚
> 时间为本地时间（Asia/Shanghai，UTC+8）；留痕列指 state/gate/归档中的对应证据。

## 事件时间线

| 本地时刻 | 事件 | 留痕 |
|---|---|---|
| ~22:18 | 冷启动引导：`guide` 三问（目标 freeText / 模式 basic / 类型 feat）+ WTT 场景选 single | 会话记录 |
| 22:20 | **WTT 前置动作**：title 提取分支名 `feat/ddo-index-dashboard` → `git branch`（基线 main@3a74e78）→ `git worktree add` → `run start --project <工作树绝对路径>` | worktree-info.json createdAt 22:20:27 |
| 22:19:55 | run 物化：runId `20260929-221955-b3cd`，state.git 自动捕获 branch/worktreePath；起点 requirement:01 | runId / state.git |
| 22:20:54 | requirement:01 → done（需求原文固化 requirement.md，validate ✓） | stages.requirement.at |
| 22:21–22:24 | spec:01 产出（5 FR / 3 AC / 2 BQ / 4 PD，validate ✓）→ next 开门 | spec.md |
| 22:24:12 | **门 1/2 · spec:02 开门**（批准/驳回/修改/提问 + 动态项 回答BQ-1、回答BQ-2） | gate.openedAt |
| 22:24:21 | 首次 `gate present`（payload 留痕） | gate.presentedAt |
| 22:26:07 | **BQ 相位内问答**：BQ-1 静态单文件 HTML / BQ-2 eval/runs/ 沙箱项目（两次 `gate interact` 留痕） | gate.interactions ×2 |
| 22:26:49 | 答案写回 spec（FR-DASH-1 修订、FR-DASH-4/AC-3 新增、对齐变化摘要）→ **重新呈现**（交互使旧呈现过期的结构性 re-ask） | gate.presentedAt（二次） |
| 22:27:08 | **门 1/2 · spec:02 →「同意」** | decision + closedAt |
| 22:27–22:30 | plan:01 仓库事实建立（index-registry 契约 / visualize.js 同机制先例 / state 结构 / 沙箱与归档约定 6 项 Repository Fact）→ 产出 plan.md revision 1（single 模式，validate ✓） | plan.md |
| 22:30:32 | **门 2/2 · plan:02 开门** → 22:30:38 呈现 | gate.openedAt/presentedAt |
| 22:41:38 | **门 2/2 · plan:02 →「同意」**（DEC-1 生成器内嵌快照 / DEC-2 列表视图 / 三级容错） | decision + closedAt |
| 22:41–22:44 | coding:01：沙箱 `eval/runs/20260929-ddo-dashboard/` — build.js（零依赖生成器）+ dashboard.html；自检 3 项全过（主路径自举：快照见本 run currentStage=coding:01 / 三级容错冒烟：空·降级·损坏 / 仓库测试 118 pass · 0 fail） | 代码变更 + stdout 摘要 |
| 22:44:53 | coding:01 → done（产物即代码变更，无声明产物 validate 通过） | stages.coding.at |
| 22:44–22:45 | reporting:01：execution-report.md（validate ✓）；**快照刷新**——dashboard 重生成，currentStage=reporting:01（最后一代有效自举快照） | dashboard.html 内嵌 JSON |
| ~22:45 | reporting → done，`next` 返回 completed:true（basic 全链收官） | currentStage=[] |
| 22:46:45 | `run finish --status done`：state 副本归档 `~/.ddo/history/20260929-221955-b3cd/.state.json`、runs.jsonl 追加终态行、index.json 注销为 `{}` | history 归档三件套 |
| 22:47+ | showcase 归档（用户定夺：新目录 `v2-beta-dashboard`）+ 分支提交与 PR（用户定夺：提交并建 PR） | 本目录 + PR |
