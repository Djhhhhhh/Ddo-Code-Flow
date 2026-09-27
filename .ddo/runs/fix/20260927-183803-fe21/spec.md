# 交互协议结构闭环 Spec

> 本文档用于确认 agent 是否正确理解用户关于「把向用户呈现选项的交互协议从 prompt 散文升级为结构保证」的需求。

---

## 对齐摘要

- 用户目标：需要 AI 向用户输出 options 的操作（确认门呈现、提问后再询问、冷启动引导、断点恢复呈现）不再依赖 AI 自觉读散文，而是有明确、统一、结构强制的交互模式。
- 期望交付：统一交互呈现入口（单一 payload 来源，覆盖门/resume/冷启动，含动态 BQ 选项）+ 呈现与相位内交互留痕 + 决议前置校验（最后交互后须重新呈现才可决议）。
- 关键边界：防「漏问 / 漏 re-ask」的疏漏型失败；不防 agent 伪造决议（诚实边界不变，严格用户亲跑通道留后续）。冷启动无 state，只做形态统一、不留痕闭环。
- 当前状态：BQ-1（覆盖时刻）、BQ-2（动态选项）均已由用户确认写回，待用户批准本 spec。

---

## 用户目标

- AI 需要给用户输出选项的一切时刻，用户看到的是同一种交互模式：AI 从单一来源拿到结构化 payload 并原样转述。
- 提问（in-phase 相位内交互）之后，重新询问（re-ask）由结构自动触发，不靠 AI 记得。
- 变更在 git worktree 分支 `fix/interaction-loop` 上进行，run 产物留在 worktree 内（参考 `Ddo-Code-Flow-feat-worktree-creation-timing` 的分支结构）。

---

## 范围与非目标

### In Scope

- run 内确认门（human 相位）的交互：统一呈现入口命令、呈现留痕、in-phase 交互留痕、`next --decision` 与转移型决议的前置校验。
- spec 门的动态选项（`回答 BQ-N`）纳入统一 payload：呈现入口经 per-task 钩子现算未解决 BQ 并生成选项（BQ-2 决议）。
- resume 呈现与冷启动引导的形态统一（BQ-1 决议「全部统一」）：resume 的 gateOptions 与门 payload 同源同形态；冷启动引导（问模式等）的选项数据由 CLI 以统一 payload 形态产出。
- CLI 拒绝时的提示输出（stderr/stdout 选项清单）与呈现 payload 同源。
- SKILL.md 协议与带 in-phase 选项的门任务 prompt（spec / plan / test-plan / reflection 确认门相位）同步改写。
- 配套测试（tools/tests/）。

### Non-goals

- 不做严格用户亲跑通道、不防 agent 伪造决议（跑完呈现命令后自己决议仍可能——本轮只防疏漏）。
- 不改 workflow/DAG/节律结构、不动 `.state.json` 既有语义命令（next/rollback/run finish 的对外形态不变，只加前置校验）。
- 冷启动引导不做留痕闭环（无 state 可写），只统一 payload 形态与单一来源。
- 不引入宿主特定机制（hooks 等）；payload 保持宿主无关，由 agent 转述。

---

## 需求对齐

| ID | Agent 对需求的理解 | 来源 | 成功结果 |
|---|---|---|---|
| FR-1 | 提供唯一的交互呈现入口，覆盖全部需要用户选择的时刻：run 内确认门（含经 per-task 钩子现算的动态 `回答 BQ-N` 选项）、resume 呈现、冷启动引导。执行后输出统一结构化 payload（问题、选项 name/desc、action 分发指引），AI 只需原样转述，不得自造呈现。 | 用户决议（方向 B + BQ-1 全部统一 + BQ-2 纳入） | AC-1、AC-6、AC-7 |
| FR-2 | 呈现留痕：run 内确认门的呈现入口成功执行即在 state 的门实例上记录呈现时间戳，作为「已向用户呈现」的唯一结构证据（resume/冷启动无门实例，不留痕）。 | 用户决议（呈现/交互留痕；「漏问被结构性拦截」） | AC-2 |
| FR-3 | 相位内交互留痕：in-phase 选项（提问/修改/回答 BQ-N 等）对应的行为发生时经 CLI 记录进门实例，并使既有呈现记录过期（最后交互晚于最后呈现）。 | 用户决议；用户原话例「在提问之后，就不会自动触发重新询问」 | AC-3 |
| FR-4 | 决议前置校验：门未关时，`next --decision` 与转移型决议载体（rollback）必须存在晚于「门开启时间与最后一条交互记录较晚者」的呈现记录，否则拒绝推进并输出与呈现入口同源的选项清单与指引；`run finish` 保持元操作不校验。 | 用户决议（「next --decision 校验『交互后必须重新呈现』」） | AC-2、AC-3、AC-4 |
| FR-5 | 协议同步：SKILL.md（确认门协议/冷启动/中断恢复）与门任务 prompt 的呈现义务改写为「跑命令 → 转述 payload → 经 CLI 记录交互」，re-ask 依赖结构拦截而非散文提醒。 | 用户原话（「不会被 ai 读到、不统一」的根治） | AC-5 |

---

## 约束与保留术语

- 保留用户术语：`options`（选项）、`交互模式`、`重新询问`（re-ask）、`提问`。
- 保留项目术语：确认门、呈现（present）、相位内交互（in-phase）、决议（decision）。
- 结构保证优先于 prompt 约定（项目既有哲学，Context Fact）。
- 四通道契约不变：stdout=JSON（exec 裸文本例外）/ stderr=人话 / exit 0·1·2 / state 现读不缓存。
- `.state.json` 仍是唯一事实源：留痕字段进 state，派生物不落盘。
- 冷启动引导统一只到「形态与来源」，不承诺留痕校验（无 state，BQ-1 决议的边界）。

---

## 解释与假设

| 类型 | 内容 | 依据或原因 | 若错误的影响 |
|---|---|---|---|
| Interpretation | 「统一交互 payload」实现为新增一个专门呈现命令作为唯一入口，而非仅扩展既有 `status` 输出。 | 用户决议描述为「统一交互 payload + 留痕 + 校验」三件套，呈现需带写痕副作用，`status` 语义是只读视图。 | 若用户倾向少加命令，命令形态可变（PD-1），What 不变。 |
| Interpretation | 转移型决议中的 `run finish` 不做呈现校验：中止 run 是用户元操作，不应被门挡住；rollback 是门声明的决议载体，纳入校验。 | 对「决议前置校验」的最小一致解释。 | 若用户认为 finish 也应校验，FR-4 边界微调，不影响其余 FR。 |
| Interpretation | 冷启动「全部统一」解释为：引导各问的选项数据由 CLI 命令以与门 payload 相同的形态产出（如 list 输出即 payload），AI 转述；不含留痕与决议校验。 | 冷启动无 state，结构闭环无处落痕（BQ-1 选项描述已言明「统一方式完全不同」）。 | 若用户期望冷启动也有强制闭环，需先有 run 前状态载体——超出本轮。 |
| Assumption | 宿主提问工具（如 AskUserQuestion）形态不变，payload 由 agent 转述，无需机器可读选项协议。 | 现有 @interact:required 机制即此假设。 | 若要宿主直读 payload，交付形态变化——低概率，不设 BQ。 |

---

## 对齐变化摘要

| 变更类型 | ID | 修改前 | 修改后 | 依据 |
|---|---|---|---|---|
| 已解决 | BQ-1 | 覆盖时刻待确认 | 全部统一：确认门 + resume + 冷启动 | 用户回答（宿主提问工具） |
| 已解决 | BQ-2 | 动态选项是否纳入待确认 | 纳入：per-task 钩子现算 `回答 BQ-N` 进 payload | 用户回答（宿主提问工具，重问后确认） |
| 修改 | FR-1 | 覆盖时刻依赖 BQ-1、动态选项依赖 BQ-2 | 全时刻覆盖 + 动态选项纳入，AC 关联扩为 AC-1/6/7 | BQ-1、BQ-2 决议 |
| 修改 | FR-3 | in-phase 选项（提问/修改等） | 明确含 `回答 BQ-N`（同为相位内交互，同样过期呈现） | BQ-2 决议的自然推论 |
| 新增 | AC-6、AC-7 | — | 冷启动形态统一、resume 同源两个可观察结果 | BQ-1 决议 |
| 新增 | PD-6～PD-8 | — | 钩子协议、BQ 解析、冷启动命令形态三项实现决策 | BQ-1、BQ-2 决议 |
| 修改 | In Scope / Non-goals | 仅 run 内门交互 | 增冷启动/resume/钩子协议；冷启动不留痕入 Non-goals | BQ-1、BQ-2 决议 |

---

## 留给 Planning

- **PD-1** 呈现/交互命令的命名与形态（如 `gate present` / `gate interact`，或合并为单命令子动作）。
- **PD-2** 留痕字段的 schema（presentedAt / interactions[] 形状；rollback 清门时一并重置；旧 state 缺字段的兼容语义）。
- **PD-3** 「呈现过期」的判定实现（时间戳比较 vs 单调版本号）。
- **PD-4** rollback 侧呈现校验的落点（命令内校验 vs 共用校验函数）。
- **PD-5** 被拒输出与呈现 payload 的同源渲染（复用 renderOptions 或新渲染器）。
- **PD-6** per-task 呈现钩子协议（如 `presentOptions` 的签名、返回形态；无钩子任务的缺省行为；钩子失败的处理）。
- **PD-7** 未解决 BQ 的解析实现（从 runDir 的 spec.md「需要用户确认」section 提取 BQ-N 与内容）。
- **PD-8** 冷启动统一形态的落点（list workflows / list tasks 输出改造为 payload 形态，还是新增引导命令）。

---

## 成功结果

| ID | 用户可观察的结果 | Validates | 来源 |
|---|---|---|---|
| AC-1 | 对开着的门执行呈现入口，输出含全部选项（静态 name/desc/action 分发指引 + 动态 `回答 BQ-N`）的统一 payload；AI 在任何门时刻转述的内容与之同源一致，不再有多形态即兴呈现。 | FR-1 | 用户决议 |
| AC-2 | 门开后未呈现直接 `next --decision <name>` 被拒（exit 1 + 选项清单指引）；补跑呈现入口后同一决议命令成功，state 同时留下 presentedAt 与 decision/closedAt 痕迹。 | FR-2、FR-4 | 用户决议 |
| AC-3 | 呈现后发生一次 in-phase 交互（如 提问、回答 BQ-N）再决议被拒，提示「交互后须重新呈现」；重新呈现后决议成功——提问后的再询问由结构强制，不再依赖 AI 自觉。 | FR-3、FR-4 | 用户原话（re-ask 例子） |
| AC-4 | 门开着且未呈现时，直接执行转移型决议载体（rollback）同样被拒并指引先呈现。 | FR-4 | agent 解释 |
| AC-5 | SKILL.md 与四个门任务 prompt 更新后，agent 的呈现/交互义务全部可机械执行（跑命令→转述→记录），无「凭记忆自由发挥」的呈现要求残留。 | FR-5 | 用户原话 |
| AC-6 | 冷启动引导（问目标/问模式/问类型）中每个选择题的选项数据由 CLI 以统一 payload 形态产出，AI 只转述不自拼。 | FR-1 | 用户决议（BQ-1） |
| AC-7 | resume 加载后向用户呈现的门选项与 run 内呈现入口的 payload 同源同形态。 | FR-1 | 用户决议（BQ-1） |

---

## 用户确认

- ✅ **同意**：批准当前 spec，进入 Planning。
- ❌ **驳回**：回滚 spec 阶段，按意见回到相位 01 重新生成。
- ❌ **修改：<反馈>**：修改当前 spec，展示变化后重新确认。
- ❓ **提问：<问题>**：仅答疑；如需据此改动，必须随后明确选择 `修改`。
