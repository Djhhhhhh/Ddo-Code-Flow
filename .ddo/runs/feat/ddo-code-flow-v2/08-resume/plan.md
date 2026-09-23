# 工作项 08 · resume — 设计方案

> 版本：**v1.0（2026-09-24 已定版并实现）**——D1–D5 需求定版后直接实现（单命令增量，无开放评审点）
> 需求依据：[requirement.md](./requirement.md)（D1–D5）
> 契约基线：[../02-index-structure/plan.md](../02-index-structure/plan.md) v1.2 §4/§7（index 指针协议与惰性校验）、[../07-exec-loop/plan.md](../07-exec-loop/plan.md) v1.4 §4.4（status 双清单视图）

## 1. 定位

`resume` 是**断点重续的发现层入口**：工作流状态天然自包含（state 物化后不回指预设、`currentStage` 精确到相位），缺的只是「新会话不知道 statePath 在哪」的加载指令。resume 读全局 index → 惰性校验 → 列运行中 run 概要 → `--run-id` 加载完整状态视图（与 status 同构）。**只定位与呈现**——续跑动作（exec / 门决议 / 收束）归既有命令集，不引入新语义。

与 status 的职责分界（D5）：

| | resume | status |
|---|---|---|
| 驱动源 | `~/.ddo/index.json`（发现层） | `--state <path>`（细节层） |
| 典型场景 | 新会话接手，不知道有哪些 run | 已知 statePath，要看当前位置 |
| 输出 | 概要清单（无参）/ 完整视图 + 元数据（--run-id） | 完整视图 |

## 2. 命令契约

```text
用法:   resume [--run-id <id>] [--project <path>] [--tasks-dir <path>]

无参（发现，D2 全局 + D3 一律先列清单）:
        读 DDO_HOME index 全部条目（--project 给出时按 statePath 前缀过滤）；
        逐条惰性加载（02 §7）：
          statePath 缺失 / JSON 非法 / assertState 不过 → stale（不展示，计 staleCount）
          currentStage 空 → 待收束（completable: true + note，仍展示——D4 细化）
        输出: { runs: [ { runId, title, projectRoot?, type?, startedAt,
                          currentStage: [ { stage, phase, phaseType?, gateOpen? } ],
                          completable?, note? } ],
                staleCount,
                hint }   ← 有 run：提示 --run-id 选定；无 run：引导 run start / history

--run-id <id>（加载）:
        index 命中 → 惰性校验 → 输出 statusView（07 双清单同构）+ projectRoot/type/startedAt/statePath；
        未命中 → exit 1（附运行中 runId 列表）；命中但 stale → exit 1（statePath 失效）
```

实现要点：

- `statusView(state, statePath, tasksDir)` 自 runStatus 抽出共享（status / resume --run-id 同构输出）；
- `runMetaFromPath`：从 statePath 推导 projectRoot 与 type（`<root>/.ddo/runs/<type>/<dir>/.state.json`，尾部段不匹配则省略元数据）；
- 概要的 `phaseType` 读取失败（任务目录变动）→ 省略该字段，不阻断发现（resume 是恢复工具，不该因环境破损崩掉）；
- 惰性校验只读不写（02 单写者原则：只有 runtime 写 index，resume 不清理 stale 条目）。

## 3. 与 02 基线的联动

1. **index 的第一个 CLI 读取消费方**（此前只有测试与设计预期）；
2. §7 惰性校验的**细化**：「无待继续阶段」不再一律视为失效不展示——结构合法 + currentStage 空 = **待收束**，展示并引导 `run finish --status done`（否则无法发现并收束一个跑完没收口的 run）；
3. 多项目并发发现（v2 主线）首次有了操作面：全局清单每条标注 projectRoot。

## 4. 测试（tools/tests/resume.test.js，4 例）

| 用例 | 断言 |
|---|---|
| 无参全局清单 | 3 run（开门位 gateOpen + 待收置 completable）+ 1 stale 淘汰计数；概要字段（title/projectRoot/type/位置） |
| --run-id 加载 | 输出与 status 同构（gateOptions 四选项 / availableCommands 命令型 + `--state` 补全）+ statePath 元数据；未知 runId → exit 1 |
| --project 过滤 / stale 选定 | 前缀过滤后仅剩目标；--run-id 指向 stale → exit 1「失效」 |
| 空 index | runs 空 + 引导提示（run start / history），exit 0 |

## 5. 开放问题

| # | 问题 | 状态 |
|---|---|---|
| O1 | `list history`（历史查询，04-D5 余项） | 后续轮 |
| O2 | resume 自动清理 stale index 条目（写回 index） | 不做（02 单写者原则，stale 由 finish/人工收敛） |

## 变更记录

| 版本 | 日期 | 说明 |
|---|---|---|
| v0.1 | 2026-09-24 | 初版：定位/契约/联动/测试计划 |
| **v1.0** | 2026-09-24 | **定版并实现完毕**：statusView 抽取共享；runMetaFromPath/tryLoadState/summaryPosition；cli 登记 `resume`（顶层动词）；resume.test.js 4 例；全套 64/64；E2E 冒烟（start → 模拟中断 → resume 清单 → --run-id 加载 → 续跑）通过；SKILL/README 同步；02 升 v1.3、04 D5 余项更新 |
