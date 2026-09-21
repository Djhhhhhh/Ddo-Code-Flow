# 工作项 04 · cli-commands — 基本执行命令集设计

> 版本：**v1.0（2026-09-22 已定版）**——本轮登记集合为 `run finish` + `rollback`（状态回滚部分）；`exec` 契约随下一轮原子任务改造落地。变更需升级版本号并记录于 §8。
> 需求依据：[requirement.md](./requirement.md)（D1–D11）
> 数据契约：[../02-index-structure/plan.md](../02-index-structure/plan.md) v1.0

## 1. 命令集总览

| 命令 | 形态 | 职责 | 本轮状态 |
|---|---|---|---|
| `run finish` | 两段式（run 域） | 结束迁移：清 currentStage → history 追加 → index 移除 | 定义并登记 |
| `rollback` | 顶层动词 | 回滚：每次回滚指定的一个阶段（DAG 路径重置 + `_del` 归档） | 状态部分定义并登记；文档归档随产物机制落地 |
| `exec` | 顶层动词 | 执行原子任务，输出组装好的 prompt（裸文本） | 契约定义；实现随下一轮原子任务改造 |
| `run start` | 两段式（run 域） | run 诞生（预设组装 → stages 生成） | **移交预设组装轮** |
| `next` | 顶层动词 | 推进 | **移交原子任务改造轮**（推进语义与原子任务执行模型强耦合，本轮无法拍板） |

命名依据 [03 plan §3.4 命名空间政策](../03-tools/plan.md#34-命名空间政策2026-09-22-定版)（P1 已定稿）。顶层动词所需的框架分发扩展随本轮 rollback 登记一并落地。

## 2. 命令契约

通用约定（继承 03 框架）：位置式子命令；`--flag value` 传参；stdout 仅 JSON；stderr 人话；exit `0·1·2`；`.state.json` 现读不缓存；所有写入原子落盘。

**测试**（`tools/tests/cli.test.js`，`node --test tools/tests/` 运行）：行为级测试走 CLI 子进程（四通道断言）。**隔离约定**：每个用例在 `os.tmpdir()` 下 `mkdtemp` 独立沙箱，`DDO_HOME` 指向沙箱内目录、state 只写沙箱内，用例结束 `finally` 递归删除——不残留中间文件、不触碰真实 `~/.ddo`。新命令登记时同步补测试。

### 2.1 `run finish`

```text
用法:   run finish --state <path> --status <done|aborted|failed>
前置:   .state.json 存在且结构合法（不要求 currentStage 为空—— aborted/failed 常态是中途结束）
逻辑:   ① state.currentStage = []（原子写）
        ② history/runs.jsonl 追加一行（信息取自 state：runId/title/git/startedAt，
           补 endedAt 与 finalStatus）
        ③ index.json 移除该 runId（持锁+原子写）
输出:   { "finished": "<runId>", "finalStatus": "done|aborted|failed" }
错误:   exit 1 —— state 不存在/结构非法；exit 2 —— 参数缺失、--status 非法
幂等:   重复 finish：currentStage 已空 → 跳过①；history 重复行由读取方容忍；index 移除天然幂等
```

迁移顺序 = 02 基线 §7（先 history 后 index，崩溃可被惰性校验兜住）。

### 2.2 `rollback`

```text
用法:   rollback --state <path> --stage <stageId> [--reason <text>]
前置:   --stage 必须存在于 stages；且位于「从初始到当前执行位置」的有效回滚范围内
语义:   每次执行回滚【指定的一个阶段】。回滚按 DAG 逻辑进行：

        重置集合 = 目标 stage ∪ 「目标 stage → currentStage 各项」的全部 DAG 路径节点
                  （即：目标的子孙中，位于通往当前执行位置路径上的那些——含当前执行位置
                   自身（路径终点）——加上目标自身）

        对重置集合：status → pending，at 刷新；
        currentStage → ["<目标stage>:01"]；
        不在路径上的并行分支保持原状（P4 定稿：只回滚图中路径上的节点）。

归档:   回滚需要清理的文档归档到 run 产物目录下 `_del/`（保留历史，不直接删除）：
          .ddo/runs/<type>/<dateDescription>/_del/rollback-<n>/<原文件名>
        n = 该 run `_del/` 下现有 rollback-* 编号最大值 + 1（扫描目录推导，不加 state 字段）
        —— 每次回滚独立子目录，天然隔离多次回滚（P4 补充逻辑）。
输出:   { "rolledBack": [ {"stage": "spec", "from": "done", "to": "pending"} ],
          "pathReset": ["plan", "coding"],
          "currentStage": ["spec:01"],
          "archivedTo": "_del/rollback-3" }
错误:   exit 1 —— stage 不存在、不在可回滚范围（如为 pending）；exit 2 —— 参数缺失
约束:   文档归档的「哪些文档属于被回滚阶段」依赖产物登记机制（尚未设计）——
        本轮登记状态回滚部分，归档逻辑随产物机制落地；届时仅补归档实现，本契约不变。
```

### 2.3 `exec`

```text
用法:   exec --state <path> --task <atom-task-name>
前置:   --task 指向存在的原子任务（atom-tasks/<name>/<name>.md）
本轮:   契约先行，实现随下一轮原子任务改造——本轮若被调用，exit 1 并输出
        「exec 将随原子任务改造支持：产出组装好的 prompt」
终态契约（下一轮落地）:
        读取 state 的执行位置 + 原子任务的上下文声明（届时定义），
        组装「恰好必需」的 prompt，以【裸文本】输出到 stdout（P2 定稿——四通道契约
        的唯一例外，理由：消费者是 AI 会话本身，少一层解包），供动态喂给 AI。
        渐进式加载：上下文选择权在流水线，不在 agent。
错误:   exit 1 —— 任务不存在、状态不满足执行条件；exit 2 —— 参数缺失
```

## 3. 状态转换归属

```text
  pending → running → done          归属：next（已移交原子任务改造轮）/ 门语义命令（执行循环轮）
  任意有效态 → pending（路径重置）   归属：rollback（本轮）
  生命周期结束                        归属：run finish（本轮）
```

`skipped` / `rework` / `waiting-*` 的进入路径不在本轮（开放问题 O1/O2）。

## 4. 与 02 基线的一致性检查

- 所有写入仅触 `.state.json` / `index.json` / `history/runs.jsonl`，字段集不越界（未新增 state 字段）；
- `run finish` 迁移顺序与基线 §7 一致；
- `rollback` 只改既有字段值（status/at/currentStage）；`_del/` 是产物目录下的新子目录，不是 state 字段。

## 5. 依赖与移交

| 依赖 | 状态 |
|---|---|
| `run start` ← workflow 预设格式 + 动态组装逻辑 | 移交「预设组装」设计轮 |
| `next` ← 原子任务执行模型（推进语义无法先于它拍板） | 移交「原子任务改造」轮 |
| `exec` prompt 组装 ← 原子任务改造（上下文声明、组装规则） | 移交「原子任务改造」轮 |
| `rollback` 文档归档 ← 产物登记机制（阶段↔文档关联） | 契约已定，实现随产物机制 |
| 门/相位转换 ← 执行循环设计 | 移交执行循环轮 |

## 6. 开放问题

| # | 问题 | 状态 |
|---|---|---|
| O1 | 相位数与相位推进的数据来源（`spec:01→:02` 靠什么驱动） | 倾向预设轮 |
| O2 | `waiting-human` 等状态的进入/离开归属（next 扩展 or 门语义命令） | 移交执行循环轮 |
| O3 | `stages ↔ 原子任务` 映射（next/exec 需要「该阶段执行哪个任务」） | 倾向预设轮随 stages 生成 |
| O4 | `_del` 归档位置已具体化为 run 产物目录下（对「项目工作目录」的解释）；若你指项目根目录，调整一行契约 | 待确认（默认 run 产物目录） |

## 7. 评审要点（全部已处理）

| # | 结论 |
|---|---|
| P1 | ✅ 定稿：顶层动词形态，政策沉淀于 03 plan §3.4 |
| P2 | ✅ 定稿：exec 终态输出裸 prompt 文本（四通道唯一例外） |
| P3 | ✅ 调整：`next` 移交原子任务改造轮，本轮不做 |
| P4 | ✅ 定稿：每次回滚一个指定阶段；只重置 DAG 路径节点；文档归档 `_del/rollback-<n>/` 隔离 |
| P5 | ✅ 定稿：`run finish` 保留基本集 |

## 变更记录

| 版本 | 日期 | 说明 |
|---|---|---|
| v0.1 | 2026-09-22 | 初版：run finish / next / rollback / exec 四命令契约；run start 移交预设组装轮 |
| v0.1.1 | 2026-09-22 | P1 定稿：顶层动词形态确认；命名空间政策沉淀于 03 plan §3.4 |
| v0.2 | 2026-09-22 | P2–P5 评审定稿：exec 裸文本输出；next 移交原子任务轮；rollback 重定义（单阶段/DAG 路径重置/_del 隔离归档）；finish 保留。本轮登记集合 = run finish + rollback（状态部分） |
| **v1.0** | 2026-09-22 | **定版**：实现说明——rollback 本轮输出的 `archivedTo` 字段随文档归档落地后出现（当前无产物机制，省略该字段） |
| v1.1 | 2026-09-22 | 新增 `tools/tests/cli.test.js`（11 用例全过）：框架行为 + rollback 路径语义 + finish 迁移/幂等；固化沙箱隔离约定（mkdtemp + finally 递归删除 + DDO_HOME 指向沙箱） |
