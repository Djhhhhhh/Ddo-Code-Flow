# 工作项 11 · artifact-lifecycle — 产物生命周期与目录语义定版

> 状态：**已实现（D1–D5 定版，2026-09-24；plan v1.1 实现完成，77 用例全绿）**

关联：
- [../04-cli-commands/plan.md](../04-cli-commands/plan.md) §2.2 —— rollback `_del` 归档契约已定（数据来源 05 就位，本轮激活）
- [../02-index-structure/plan.md](../02-index-structure/plan.md) v1.4 —— state schema（本轮扩展 dirs）与 `~/.ddo/history` 布局（本轮增 runId 归档目录）
- [../10-bootstrap/requirement.md](../10-bootstrap/requirement.md) O3 —— 预留概念本轮落地（state 归档；「自定义链频次 → 预设自我进化」仍留后续）
- 并行线 [../09-coding-worktree/](../09-coding-worktree/) —— 代码工作目录判定（worktreePath || projectRoot）在那条线定义，本轮术语与之对齐

## 需求输入（2026-09-24，用户）

1. **`.state.json` 生命周期**：随工作流执行产生于工作目录；工作流结束后 **copy 一份到根目录 `.ddo/history/[runId]/` 目录下**，原文件随项目版控逻辑走。
2. **中间产物**（spec、plan 等文档）：默认随项目版控逻辑走（留在原地，不搬不移）。
3. **失效/回滚产物**：plan、spec 中被标记失效或被回滚掉的文件，落到对应工作目录的 `[runId]/_del` 目录下。
4. **目录语义缺口**：没有定义好什么叫做「工作目录」、什么叫做「流水线产物目录」——需要定版，**如有需要补充进 `.state.json`**，保证产物不会落到错误的目录、不会修改错误的目录。
5. **流程纪律**：本轮必须先出 plan 供 review，不得跳过 plan 门直接开发。

## 现状盘点（诊断）

| 对象 | 现状 | 缺口 |
|---|---|---|
| 目录语义 | run 目录（`.ddo/runs/<type>/<dirName>/`）同时承载 .state.json 与文档产物；代码改动发生在 projectRoot/worktree——但两套「目录」从未命名定版 | 术语缺位：任务/hook/文档各说各话，「产物落错目录」无结构防线 |
| `.state.json` 结束去向 | 原文件留在 run 目录（随项目 VCS）；`~/.ddo/history/runs.jsonl` 仅追加一行摘要 | 无 per-run 归档副本（自我进化的数据地基缺失） |
| 中间产物 | 留在 run 目录随项目 VCS | 符合需求 2，无需改 |
| 回滚产物 | `rollback` 只重置状态，**文档留在原位**（04 契约的 `_del` 归档未激活） | 重做时旧文档与新生文档混放，失效内容无隔离 |
| 产物落点防线 | validate/exec 以 `dirname(statePath)` 为锚；output 声明无路径逃逸校验 | 恶意/失误的 `../` 声明可让校验/产物触达 run 目录之外 |

## 候选机制映射（方向，细节随 plan 评审）

| 需求 | 机制候选 |
|---|---|
| 1 state 归档 | `run finish` 结束迁移扩展：copy state 到 `~/.ddo/history/<runId>/.state.json`（原文件不动） |
| 3 失效产物隔离 | 激活 04 §2.2 `_del` 契约：rollback 重置阶段的 output 声明文件移动到 `<runDir>/_del/rollback-<n>/` |
| 4 目录定版 | 术语定版 + state 增 `dirs` 字段（projectRoot / runDir 显式化）+ output 声明防逃逸校验 |

## 已确认决策（2026-09-24 plan 门评审）

| # | 决策 | 依据 |
|---|---|---|
| D1 | 归档位置 = **`~/.ddo`（DDO_HOME）**：`~/.ddo/history/<runId>/.state.json`，与 runs.jsonl 同址，多项目全局可分析（自我进化数据地基） | 用户定版（P1） |
| D2 | `_del` 归档 = **移动**（原位消失，重做生成新文件，新旧不混放） | 用户定版（P2） |
| D3 | 目录定版 = **同址 + `dirs` 字段**（run 工作目录即产物目录，不另设 artifacts/） | 用户定版（P3） |
| D4 | rollback 归档范围 = **重置集合**（一次 rollback 汇总同一 rollback-n/） | 用户定版（P4） |
| D5 | 「BQ 改写」等相位内更新不进 _del（原地改写保稳定 ID）；_del 只收整阶段作废的产物 | plan 定稿 |

## 变更记录

| 版本 | 日期 | 说明 |
|---|---|---|
| v0.1 | 2026-09-24 | 立项：录入需求输入（含 plan 门纪律）、现状诊断、候选机制与 Q1–Q4 |
| v1.0 | 2026-09-24 | 定版（D1–D5）并实现完成：目录术语 + dirs 字段 + state 结束归档 + _del 移动归档 + 防逃逸防线；细节见 [plan.md](./plan.md) v1.1 |
