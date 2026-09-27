# Run Finish Zip 归档 Spec

> 本文档用于确认 agent 是否正确理解用户关于「run finish 后将 runId 目录压缩 zip 归档到用户级 history」的需求（Issue #51）。

---

## 对齐摘要

- 用户目标：run finish 收口时，把本次 run 的 runId 目录整体压缩为 zip 归档，长期保留在用户级 history。
- 期望交付：`run finish` 具备将 runId 目录打包为单个 zip 并写入用户级 history 的能力。
- 关键边界：zip 取代 state 目录副本（history 只留单 zip）；项目内原 runId 目录不动（仍随版控走）。
- 当前状态：BQ-1 已由用户裁定（答案 A：zip 替代目录副本）并写回，spec 可批准。

---

## 用户目标

- run finish 后，当前任务的 runId 目录被压缩成 zip，保留到用户根目录的 history 中（用户术语：runId目录、zip、用户根目录的history）。

---

## 范围与非目标

### In Scope

- `run finish` 执行时将本次 run 的 runId 目录（runDir 全部内容）压缩为单个 zip 归档。
- zip 归档保留到用户级 history（`~/.ddo/history`）。
- zip 取代现有 state 目录副本归档：finish 后 history 中不再新增 `history/<runId>/` 目录，state 副本以 zip 内形式保留。
- 该归档行为受既有 `--no-archive` 开关控制（开关跳过用户级 history 归档时，zip 一并跳过）。

### Non-goals

- 不删除、不移动项目内原 runId 目录（现有「随项目版控走」的生命周期不变）。
- 不做 history 的清理、过期、配额策略。
- 不做从 zip 恢复 / 解压重建 run 的能力。
- 不改变 rollback 的 `_del/` 归档行为。

---

## 需求对齐

| ID | Agent 对需求的理解 | 来源 | 成功结果 |
|---|---|---|---|
| FR-ARCH-1 | `run finish` 执行时，将本次 run 的 runId 目录（全部内容，含 .state.json 与各阶段产物）压缩为单个 zip 归档。 | 用户原始要求 | AC-1、AC-3 |
| FR-ARCH-2 | zip 归档写入用户级 history（`~/.ddo/history`）长期保留。 | 用户原始要求 + agent 解释（落点解释见「解释与假设」） | AC-1 |
| FR-ARCH-3 | 收口带 `--no-archive` 时，不执行 zip 归档（不写任何用户级 history 内容）。 | agent 解释（基于项目事实：`--no-archive` 语义为跳过用户级 history 归档） | AC-2 |
| FR-ARCH-4 | zip 归档取代现有 `.state.json` 目录副本归档：finish 后 `~/.ddo/history` 中不新增 `history/<runId>/` 目录，`.state.json` 副本以 zip 内形式保留。 | 用户修订（BQ-1 答案 A） | AC-4 |

---

## 约束与保留术语

- 保留用户术语：`runId目录`（= runDir，`<projectRoot>/.ddo/runs/<type>/<dirName>/`）、`zip`、`用户根目录的history`。
- 项目事实约束：`.state.json` 为唯一事实源，归档动作不得改动它；运行期不写 skillRoot。
- 项目事实约束：现有 `run finish` 已将 `.state.json` 副本归档到 `~/.ddo/history/<runId>/.state.json`，`--no-archive` 可跳过（PR #55）。

---

## 解释与假设

| 类型 | 内容 | 依据或原因 | 若错误的影响 |
|---|---|---|---|
| Interpretation | 「用户根目录的history」指用户级 history `~/.ddo/history`（DDO_HOME 缺省布局），而非用户主目录下新建的 `~/history`。 | 项目既有「用户级 history」术语与 `~/.ddo/history/<runId>/` 布局（SKILL.md 索引结构）。 | 若用户另有所指，zip 落点位置不同。 |
| Interpretation | 「压缩成zip」= 整个 runId 目录打包为单个 zip 文件；具体压缩工具与算法是实现细节。 | 对「将 runId目录…压缩成zip」的最小等价解释。 | 若用户想要分文件或分卷，打包形态不同。 |
| Interpretation | zip 归档受 `--no-archive` 控制（开关的语义是「不入用户级 history」，zip 属于用户级 history 写入）。 | `--no-archive` 既有语义（跳过用户级 history 归档）的等价外推。 | 若用户希望开关只管 state 副本不管 zip，FR-ARCH-3 撤销，AC-2 随之调整。 |
| Assumption | zip 归档后项目内原 runId 目录原样保留（不删不移）。 | 用户只说「保留到 history」，未要求清理原目录；现有生命周期约定「随项目版控走」。 | 若用户意在腾空间（搬走语义），需改为移动并删除原目录，范围扩大。 |

---

## 对齐变化摘要

| 变更类型 | ID | 修改前 | 修改后 | 依据 |
|---|---|---|---|---|
| 已解决 | BQ-1 | 待确认：zip 与 state 目录副本的关系 | 答案 A：zip 替代目录副本 | 用户回答（2026-09-27 spec:02 门） |
| 新增 | FR-ARCH-4 | —（原由 BQ-1 悬置） | zip 取代 `history/<runId>/.state.json` 目录副本，state 副本在 zip 内 | BQ-1 答案 A 写回 |
| 新增 | AC-4 | — | finish 后 history 无 `<runId>/` 目录副本，仅 zip | 随 FR-ARCH-4 |
| 修改 | In Scope | 未含取代语义 | 增「zip 取代 state 目录副本」条目 | BQ-1 答案 A 写回 |

---

## 留给 Planning

- **PD-1**：zip 生成方式（系统 `zip` 命令 / Node 归档库 / 纯 Node 实现）与压缩级别、是否包含隐藏文件的处理。
- **PD-2**：zip 在 history 中的具体文件名与目录布局（如 `history/<runId>.zip` 平铺，或 `history/<runId>/<runId>.zip`）。
- **PD-3**：zip 归档失败时的错误处理策略（阻断 finish 报错退出 vs 警告后继续收口）。
- **PD-4**：归档动作与现有 state 副本归档、`history/runs.jsonl` 历史写入的执行顺序。

---

## 成功结果

| ID | 用户可观察的结果 | Validates | 来源 |
|---|---|---|---|
| AC-1 | 对一个正常完成的 run 执行 `run finish --status done` 后，用户级 history 中出现一个 zip，解压后与该 runId 目录内容一致（含 .state.json 与全部阶段产物）。 | FR-ARCH-1、FR-ARCH-2 | 用户原始要求 |
| AC-2 | 收口带 `--no-archive` 时，用户级 history 中不出现该 run 的 zip（也不写 state 目录副本，维持现状）。 | FR-ARCH-3 | agent 解释 |
| AC-3 | zip 归档完成后，项目内原 runId 目录内容不变（git status 不因归档动作产生变化），仍随项目版控走。 | FR-ARCH-1 | agent 假设 |
| AC-4 | `run finish --status done` 后，`~/.ddo/history` 中不新增 `history/<runId>/` 目录副本，只有 zip 归档（`.state.json` 解压可得）。 | FR-ARCH-4 | 用户修订（BQ-1 答案 A） |

---

## 用户确认

- ✅ **同意**：批准当前 spec，进入 Planning。
- ❌ **修改：<反馈>**：修改当前 spec，展示变化后重新确认。
- ❓ **提问：<问题>**：仅答疑；如需据此改动，必须随后明确选择 `修改`。
