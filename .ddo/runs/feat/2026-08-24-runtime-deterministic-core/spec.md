# 确定性内核下沉 Runtime Spec

> 本文档用于确认 agent 是否正确理解用户关于「把 ddo-code-flow 的确定性内核从 SKILL.md 散文下沉到 runtime 代码」的需求。

---

## 对齐摘要

- 本质：在 skill 内置一个 `ddo` CLI，把「围绕生成的那圈机械动作」（落盘/登记/推进/拦截）标准化，规则从散文下沉为磁盘上的不可变代码——**代码不进上下文（code ≠ context）**。
- 用户目标：让确定性机制（DAG 校验/角色注入/状态归属/门控）由代码强制，而非 LLM 自觉；失败从「静默出错」变为「响亮报错/可自愈」。
- 期望交付：无状态 Node CLI 子命令 runtime，模型只做生成，机械簿记与门控交给代码。
- 关键边界：CLI 只做簿记、不生成业务内容；触发（何时调哪个子命令）仍是短循环软约束；四层职责模型不变。
- 当前状态：BQ-1 已解决（范围 = 仅 P0.5 + P0）；无未决阻塞，可批准。

---

## 用户目标

- 让确定性机制由代码强制，规则从「散文（进上下文、会被压缩稀释）」下沉为「磁盘上的不可变代码（不进上下文）」，即 **code ≠ context**。
- 明确目标边界：目标是**失败从静默变响亮、可自愈**，不是「让模型永不遗忘」。触发（何时调用哪个子命令）仍是短循环软约束，接受其天花板。
- 让模型从「生成器 + 解释器」变为「只做生成」：CLI 只做围绕生成的机械簿记（落盘 / 登记角色 / 追加 history / 推进阶段 / 拦截越权写），**不生成业务内容**。
- 复用已验证的 `scripts/metrics/plugin.js` 范式（子命令 + stdout JSON + exit 码 + 读写 .state.json）。

---

## 范围与非目标

### In Scope

- P0.5 最小硬化：`validate-output`（按 `outputSchemaRef` 硬校验节点产出）+ `register-artifact`（stdin 接产出、落盘、写 artifacts、追加 history）。
- P0 runtime 子命令集：`compose-config` / `select-workflow` / `validate-dag` / `init-state` + `find-resumable` / `next-node` / `register-artifact` / `validate-output` / `gate` / `advance-stage`。
- 四件套契约：stdout 结构化 JSON、stderr 人类可读、exit code 0/1/2/77、.state.json 唯一状态源。
- `applyMutation` 写入守卫：从 `state.schema.json` 的 `x-ddo-writer` 建 field→writer 表，越权写或自造顶层字段即 exit 1。
- 协议解析：`skill://` / `project://` / `run://`。
- SKILL.md 的散文 Step 1–7 改写为委托 runtime 子命令。

### Non-goals

- P1（next-node 预计算 + 分层加载）——中期方向，本次不做。
- P2（阶段级动态裁剪）——长期方向，本次不做。
- 迁移或改写 `scripts/metrics/plugin.js`（保持现状，作为范式参照）。
- 常驻服务形态（文档已明确否决：runtime 是进程式无状态 CLI，非服务）。
- 改变四层职责模型、workflow/config 语义或 atom-task 业务指令。
- 追求「消除模型遗忘」或 100% 确定性触发——触发纪律仍为软约束。

---

## 需求对齐

| ID | Agent 对需求的理解 | 来源 | 成功结果 |
|---|---|---|---|
| FR-RUNTIME-1 | runtime 以无状态 Node CLI 子命令形式存在，状态唯一来源是 .state.json，崩溃/换轮不丢。 | 用户原始要求（doc §4） | AC-1 |
| FR-SUBCOMMANDS-2 | 实现 P0 子命令集，各子命令职责一一对应 SKILL.md Step 1–7。 | 用户原始要求（doc §3 P0 表） | AC-2, AC-3, AC-5, AC-6, AC-7, AC-8 |
| FR-CONTRACT-3 | 遵守四件套契约：stdout 只吐结构化 JSON、stderr 人类可读错误、exit code 0/1/2/77、.state.json 唯一状态源。 | 用户原始要求（doc §4） | AC-1 |
| FR-VALIDATE-4 | validate-output 按 atom-task 的 `outputSchemaRef`（skill:// 解析）校验节点产出，不通过 exit 1 硬拦。 | 用户原始要求（doc §3 P0.5） | AC-2 |
| FR-REGISTER-5 | register-artifact 从 stdin 接收产出文本，落盘到 artifactDir、写 .state.json.artifacts、追加 history；模型不再手写黑板登记。 | 用户原始要求（doc §3 P0.5） | AC-3 |
| FR-GUARD-6 | applyMutation 是唯一写 .state.json 的入口，按 x-ddo-writer 拦截越权写，additionalProperties:false 拦截自造顶层字段。 | 用户原始要求（doc §4） | AC-4 |
| FR-PROTOCOL-7 | 解析 skill://（skillRoot）、project://（projectRoot/.ddo）、run://（产物）三种协议。 | 用户原始要求（doc §4） | AC-2, AC-3 |
| FR-SKILLMD-8 | SKILL.md 散文 Step 1–7 改写为委托 runtime 子命令，模型只做生成、不做解释器。 | agent 解释（doc §2 演进目标） | AC-9 |
| FR-LAYER-9 | 不改变四层职责模型：runtime 不接管 atom-task 的业务决策；CLI 只做机械簿记，不生成业务内容。 | 用户原始要求（doc §2）+ 用户澄清 | AC-9 |

---

## 约束与保留术语

- 保留术语：`runtime`、`atom-task`、`workflow`、`x-ddo-writer`、`applyMutation`、`outputSchemaRef`、`additionalProperties:false`、`run://`、`skill://`、`project://`。
- 触发机制是软约束：模型通过 Bash 调用子命令的纪律写在 SKILL.md 里，不追求 100% 确定性触发；以「短循环 + 可自愈 + 响亮失败」为边界。
- 代码 ≠ 上下文：`ddo.js` 源码由模型执行、从不读入上下文；规则下沉后 SKILL.md 应变短，净上下文下降。
- 项目事实约束：新 atom-task frontmatter 必须校验 `atom-tasks/_schema/atom-task-md.schema.json`；新角色必须先登记 `atom-tasks/artifacts.json`；新 .state.json 顶层字段必须先声明 `state.schema.json` 且恰有一个 `x-ddo-writer`。
- 项目事实约束：skill 不得在 run 期间写 `skillRoot`；不得改 `.gitignore` 或 git exclude。

---

## 解释与假设

| 类型 | 内容 | 依据或原因 | 若错误的影响 |
|---|---|---|---|
| Interpretation | 「代码不进上下文」：ddo.js 源码由模型 Bash 执行、从不被读入上下文，规则下沉后 SKILL.md 变短，净上下文下降。 | 用户澄清 + doc §5（Node 进程式）。 | 若 SKILL.md 改写不彻底、仍保留大段散文，净上下文未必下降。 |
| Interpretation | 「触发是软约束」：模型何时调用子命令仍是散文纪律；目标是让失败从静默变响亮/自愈，而非消除遗忘。 | 用户澄清 + doc §4（退出码修正循环）。 | 若用户期望触发也 100% 确定性，需改用 hooks/MCP，超出本次范围。 |
| Interpretation | 「P0.5 + P0 落地」等价于实现完整 P0 子命令集（P0 表已把 register-artifact / validate-output 列为子命令，P0.5 被 P0 吸收）。 | doc §3 P0 表同时包含这两个子命令。 | 若用户只想要最小增量、暂不子命令化其余 Step，交付物会偏大。 |
| Interpretation | 「SKILL.md 散文 Step 1–7 改写」是本 run 的一部分，而非只新增 runtime 代码。 | doc §2 演进目标 + §3 P0 表映射到各 Step。 | 若用户只想先写 runtime、SKILL.md 改写留待后续，则本次会多改动 SKILL.md。 |
| Assumption | runtime 采用 Node CommonJS（与 plugin.js 一致），不引入第三方依赖与构建步骤。 | doc §5 选 Node + 复用 plugin.js 范式。 | 若要求 ESM 或打包分发，工程形态会变。 |
| Assumption | 现有存量 run 的 .state.json 约定需被新 runtime 正确读取/续跑。 | 恢复能力是 doc §4 的明确目标。 | 若允许破坏旧 run 恢复，兼容工作量会小很多。 |

---

## 对齐变化摘要

| 变更类型 | ID | 修改前 | 修改后 | 依据 |
|---|---|---|---|---|
| 修改 | 对齐摘要 | 未点明"本质是内置 ddo CLI / code≠context" | 补充本质与 code≠context，明确边界与 BQ-1 已解决 | 用户澄清 |
| 修改 | 用户目标 | 目标仅聚焦"机制由代码强制" | 补充目标边界：失败变响亮而非消除遗忘；触发是软约束；CLI 只簿记不生成 | 用户澄清 |
| 新增 | 解释与假设 | — | 新增"code≠context"与"触发软约束"两条 Interpretation | 用户澄清 |
| 修改 | 约束与保留术语 | 无触发/上下文相关约束 | 新增"触发是软约束""代码≠上下文"两条 | 用户澄清 |
| 新增 | Non-goals | — | 新增"不追求消除遗忘 / 100% 确定性触发" | 用户澄清 |
| 删除 | BQ-1 | 交付范围待确认 | 已解决：范围 = 仅 P0.5 + P0，P1/P2 不做 | 用户回答（同意：仅 P0.5+P0） |
| 修改 | 用户确认 | 提供"回答 BQ-1"选项 | 切换为"同意/修改/提问"选项 | BQ-1 已解决 |

---

## 留给 Planning

- **PD-1**：runtime 入口文件位置（skillRoot 根 `ddo.js` 或 `scripts/runtime/ddo.js`）与目录组织。
- **PD-2**：runtime 的测试框架选择（Node 内置 test runner / Jest / Mocha）与测试目录约定。
- **PD-3**：`run://` 协议的解析基准——文档 §4 写「run:// → artifactDir」，但存量 .state.json 的 artifact path 形如 `run://.ddo/runs/<type>/<dateDescription>/<file>`（相对 worktreePath），二者需统一兼容。
- **PD-4**：applyMutation 中各子命令的 writer 身份如何确定（按子命令名映射到 x-ddo-writer 的值）。
- **PD-5**：SKILL.md 改写的粒度与旧 run 恢复的兼容策略。
- **PD-6**：`validate-output` 的校验语义——`outputSchemaRef` 指向的文件（如 spec.output.schema.json）是描述性文档而非 JSON Schema，需确定机器可校验的具体规则（frontmatter / 必需 section / state.schema.json 等）。

---

## 成功结果

| ID | 用户可观察的结果 | Validates | 来源 |
|---|---|---|---|
| AC-1 | 执行 `node ddo.js <subcommand>` 无需除 Node 外的依赖即可运行，并按约定返回 0/1/2/77 退出码。 | FR-RUNTIME-1, FR-CONTRACT-3 | 用户原始要求 |
| AC-2 | 对一份违反其 `outputSchemaRef` 的节点产出，`validate-output` 以 exit 1 + stderr 说明拦截；对合法产出 exit 0。 | FR-VALIDATE-4, FR-PROTOCOL-7 | 用户原始要求 |
| AC-3 | `register-artifact` 把 stdin 文本落盘到 artifactDir、写入 .state.json.artifacts 并追加 history，全程无需模型手写黑板。 | FR-REGISTER-5, FR-PROTOCOL-7 | 用户原始要求 |
| AC-4 | `applyMutation` 对越权写（写他人 x-ddo-writer 字段）与自造顶层字段均 exit 1 并报错。 | FR-GUARD-6 | 用户原始要求 |
| AC-5 | `validate-dag` 在 required consume 无上游产出时 exit 1；对 guarded.json exit 0。 | FR-SUBCOMMANDS-2 | 用户原始要求 |
| AC-6 | `compose-config` 输出合并后的 JSON 且不向磁盘写任何 per-run effective config 文件。 | FR-SUBCOMMANDS-2 | 用户原始要求 |
| AC-7 | `next-node` 输出自包含指令，其中 `{{inputs.*}}` 已替换为上游产物路径、options 已合并。 | FR-SUBCOMMANDS-2 | 用户原始要求 |
| AC-8 | `advance-stage` 仅在终态检查（阶段全 done/合法跳过、门全批准、无 running/failed/pending）全满足时才推进 currentStage。 | FR-SUBCOMMANDS-2 | 用户原始要求 |
| AC-9 | 新增角色/工作流边/状态字段时，配套新增 role reachability 测试与 state field ownership 测试；SKILL.md Step 1–7 改为委托子命令。 | FR-SKILLMD-8, FR-LAYER-9 | agent 解释 |

---

## 用户确认

请确认以下任一选项：

- ✅ **同意**：批准当前 spec，进入 Planning。
- ❌ **修改：<反馈>**：修改当前 spec，展示对齐变化摘要后重新确认。
- ❓ **提问：<问题>**：仅回答问题，不修改 spec、revision、确认状态或修订历史；答复后询问是否需要转为 `修改`。
