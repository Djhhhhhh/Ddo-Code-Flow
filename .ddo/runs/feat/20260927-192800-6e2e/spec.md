# run finish 免归档开关 Spec

> 本文档用于确认 agent 是否正确理解用户关于「run finish 增加免归档开关」的需求。

---

## 对齐摘要

- 用户目标：流程型 run（如 pr-delivery 交付链）结束时**不进入用户级 history**——run finish 提供免归档开关。
- 期望交付：run finish 的免归档旗标；启用时跳过 history 两步（state 副本拷贝 + runs.jsonl 追加）。
- 关键边界：收口其余语义不变（index 移除、currentStage 清空）；项目内 run 产物不受影响；不带开关行为与现状完全一致。
- 当前状态：无未解决 BQ，待批准。

---

## 用户目标

- 交付型/流程型 run 结束后不污染用户级 history（`~/.ddo/history/`），因其无审计价值。
- 开关在 finish 时指定，可追溯适用于已存在的 run（含正在等待合并确认门的交付 run）。

---

## 范围与非目标

### In Scope

- run finish 增加免归档开关：跳过「state 副本拷贝到 `~/.ddo/history/<runId>/`」与「`runs.jsonl` 追加一行」。
- 收口语义保持：index 移除、currentStage 清空、原 state 文件不动（随项目版控走）。
- 不带开关的 run finish 行为与现状完全一致。

### Non-goals

- 不改 run start（不新增启动期旋钮或预设级免归档默认——后续有需要另立）。
- 不动 history 既有格式与已归档数据；不做 history 查询/清理命令。
- 不区分 run 类型自动判断（是否免归档完全由用户显式指定）。

---

## 需求对齐

| ID | Agent 对需求的理解 | 来源 | 成功结果 |
|---|---|---|---|
| FR-FLAG-1 | run finish 提供免归档开关，启用时跳过 history 副本归档与 runs.jsonl 追加两步。 | 用户原始要求 + 决议（先补机制） | AC-1 |
| FR-FINISH-1 | 免归档时收口其余语义不变：index 移除、currentStage 清空、原 state 文件不动。 | 用户原始要求（「不入 history」仅指用户级归档） | AC-2 |
| FR-RETRO-1 | 开关在 finish 时指定即可，对已存在的 run 可追溯适用，无需启动期预声明。 | 用户决议（追溯适用于等待中的交付 run） | AC-1 |
| FR-COMPAT-1 | 不带开关的 run finish 归档行为与现状完全一致。 | agent 解释（兼容底线） | AC-3 |

---

## 约束与保留术语

- 项目事实：run finish 现状无条件四步——① `history.archiveState`（副本拷贝）② `history.append`（runs.jsonl 追加）③ index 移除 ④ currentStage 清空（tools/cli.js run finish / tools/lib/history.js）。
- 保留用户术语：免归档、用户级目录（`~/.ddo/history/`，即 DDO_HOME 下 history）、runs.jsonl、index。

---

## 解释与假设

| 类型 | 内容 | 依据或原因 | 若错误的影响 |
|---|---|---|---|
| Interpretation | 「不入 history」仅指用户级 DDO_HOME 的 history 目录与 runs.jsonl；项目内 `.ddo/runs/` 产物不受影响（随版控走）。 | 用户原话「用户级目录下的history」。 | 若用户也想清项目内产物，范围需扩大——但那与「产物随项目版控走」的既有契约冲突，需显式修改。 |

---

## 留给 Planning

- **PD-1**：旗标命名（如 `--no-archive`）、parse/输出形态（如 finish 输出 `archived: false`）、history.js 跳过位置与测试扩展（lifecycle 域）。
- **PD-2**：是否在未来提供启动期旋钮/预设级免归档默认（本 run 不做，仅记录）。

---

## 成功结果

| ID | 用户可观察的结果 | Validates | 来源 |
|---|---|---|---|
| AC-1 | 以开关收口的 run：`~/.ddo/history/` 下无该 runId 目录、runs.jsonl 无该行，命令成功退出。 | FR-FLAG-1、FR-RETRO-1 | 用户原始要求 |
| AC-2 | 免归档收口后：resume/status 不再发现该 run（index 已移除），项目内 `.ddo/runs/<type>/<runId>/` 产物仍在。 | FR-FINISH-1 | 用户原始要求 + agent 解释 |
| AC-3 | 不带开关收口的 run：history 目录与 runs.jsonl 照旧出现该 run 记录。 | FR-COMPAT-1 | agent 解释 |

---

## 用户确认

无未解决 BQ。用户可以：

- ✅ **同意**：批准当前 spec，进入 Planning。
- ❌ **修改：<反馈>**：修改当前 spec，展示变化后重新确认。
- ❓ **提问：<问题>**：仅答疑；如需据此改动，必须随后明确选择 `修改`。
