# Part 01 · 引擎侧 auto 模式（gate auto）与复用基线

> 服务 FR-10（引擎半边）、FR-15、AC-10、AC-16。生效目录：仓库根。

## 1. 现有设计与复用基线（全项目共用，他册引用本表）

| 能力 | 位置（可定位符号） | 证据类型 | 采用方式 | 适用边界 |
|---|---|---|---|---|
| 门选项单源派生 | `tools/lib/gate.js` `openGates`/`presentPayload`/`isPresentationValid`/`dynamicOptions` | Repository Fact | 扩展（gate auto 同源取选项与呈现有效性判定） | 静态 ∪ present 钩子动态选项；I-G1 呈现留痕判定 |
| 决议写入路径 | `tools/cli.js` next handler（decision 校验、`gate.decision/closedAt` 写入、journal `decision` 事件，约 700–820 行区间） | Repository Fact | 复用（gate auto 走同一写入语义） | 推进型决议；in-phase 决议被 next 拒绝 |
| F 区审计日志 | `tools/lib/journal.js` `appendAudit`；STATE-SPEC §3.7（11 事件枚举） | Repository Fact | 复用（auto 决议留痕 + 过程层「阶段纪律」提取源） | 仅追加；不驱动控制流（I-J1） |
| E 区产物登记 | STATE-SPEC §3.5；`next` 登记时机 §4.3.1 | Repository Fact | 复用（「产物完整性」指标提取源：声明产物数/校验数） | 登记只在 next；validate 纯读 |
| per-task present 钩子 | `tools/lib/gate.js` `loadPresentHook`（`atom-tasks/<task>/<task>.js` 导出 `present(ctx)`，如 spec 任务的 回答BQ-N 动态选项） | Repository Fact | 复用（auto 策略需匹配动态选项名） | 动态选项恒 in-phase |
| 命令注册与输出契约 | `tools/cli.js` REGISTRY（13 命令）、四通道（stdout JSON/stderr 人话/exit 0·1·2） | Repository Fact | 扩展（注册第 14 命令 gate auto，同一契约） | 注册表即文档源（--help 纯渲染） |
| state 封闭键集与写白名单 | STATE-SPEC §3.6/§4.4 `WRITER_ALLOWLIST`；`tools/lib/state.js` | Repository Fact | 复用（不新增顶层键；gate auto 写字段 ⊆ gate present ∪ next 白名单） | 扩展先入规范再入实现 |
| 沙箱与隔离规范 | `eval/README.md`（runs/ 命名、沙箱即 projectRoot、`DDO_HOME` 覆写） | Repository Fact | 复用（Part 02 沙箱设计沿用） | 既有 eval/runs 内容零改动 |
| 门自动决议先例设计 | `eval/design/03-automation-pipeline.md` §3/§4（runner 无头驱动、门决议策略器，状态：方案稿·待评审） | Repository Fact | 参照（概念对齐；实现按 quick-eval 新做，不改设计稿） | 设计稿不驱动实现的声明保持 |
| 测试约定 | `tools/tests/*.test.js`（node:test，119 用例；如 gate.test.js/present.test.js/next.test.js） | Repository Fact | 复用（新增 gate-auto.test.js 同风格） | 引擎行为变更必须带单测 |
| subflow 机制 | `tools/lib/subflow.js`（subflow start/close，depth [2,3]） | Repository Fact | 不适用（BQ-1 决议：编排不进引擎 subflow） | — |
| 用户源合并解析 | `tools/lib/sources.js` `findTaskDir`（DDO_HOME 感知） | Repository Fact | 注意（沙箱 DDO_HOME 覆写后内置源仍优先解析，用户源消失——两臂一致，无控变量破坏） | 同名冲突 fail-fast |

## 2. DEC-1 编排形态（候选对比）

| 候选 | 状态 | 关键差异 | 结论 |
|---|---|---|---|
| (a) 引擎原生子流程（评测注册为引擎 subflow/预设） | rejected | 需扩展引擎任务机制承载评测语义，引擎与评测耦合，维护面大 | 违背「引擎不做评测专属扩展」意图 |
| (b) 纯 eval/bench 外置编排（不改引擎，门由外部队轮询推决议） | rejected | 门决议绕过 SKILL 门协议（headless 会话内仍会被「未呈现决议」拦截，只能外部抢跑 state，竞态且无留痕语义）；与需求 §7「工作流必须支持 auto 模式」不符 | — |
| (c) 混合：引擎新增通用 `gate auto` + eval/bench/ 编排 | accepted | 引擎只获得与评测无关的通用能力（策略驱动的自动门决议，可记录、可关闭）；编排自由度全保留 | 用户 BQ-1 决议 |

## 3. DEC-2 `gate auto` 设计

### 3.1 命令契约

```
node tools/cli.js gate auto --state <statePath> [--policy <policy.json 路径>]
```

- 语义：对当前所有开门位，按策略文件自动完成「呈现 + 决议」：
  1. 复用 `openGates` 取选项集（静态 ∪ 动态，与 gate present 同源）；
  2. 写 `gate.presentedAt` + 追加 `presented` 事件（note 标注 `auto` 与命中规则 id）——满足 I-G1；
  3. 按策略匹配一个选项：
     - 推进型（如 `同意`）→ 走与 `next --decision` 完全相同的校验与写入路径（decision/closedAt + `decision` 事件，note 含 `auto:命中<规则id>`）；
     - in-phase 型（如动态 `回答BQ-N`）→ 走 `gate interact` 写入语义（`lastInteractedAt` + `interacted` 事件，note = 策略给出的应答文本），stdout 返回该 in-phase 选项的行为契约文本（与 gate present dispatch 同形），由调用方（headless 会话代理）执行写回后**再次调用 gate auto**；
  4. 策略无命中 → exit 1 硬错并列出当前选项名（**不回退、不自由生成**——红线 FR-4）。
- 缺 `--policy` 且环境变量 `DDO_GATE_AUTO_POLICY` 亦未设 → UsageError（exit 2）。
- `manual 模式 = 不调用 gate auto`：既有 gate present/interact/next 流程零改动（AC-10「可关闭」的落点）。

### 3.2 策略文件 schema（引擎通用，评测无关）

```json
{
  "rules": [
    { "id": "R1", "match": { "stage": "spec", "phase": "02" },
      "prefer": ["同意"], "inPhase": { "回答BQ-1": "按你的假设继续" } },
    { "id": "R2", "match": { "stage": "plan", "phase": "02" }, "prefer": ["同意"] }
  ],
  "defaults": { "prefer": ["同意"] }
}
```

- 匹配序：精确 `(stage, phase)` 规则 → `defaults`；无 defaults 且无命中 → 硬错。
- `prefer` 按序取第一个「当前选项集中存在」的名字；`inPhase` 按选项名精确匹配（动态选项名如 `回答BQ-1` 由 present 钩子现算，策略由编排层从题包 `clarify.json` 生成，见 Part 02 §5）。
- 引擎只做名字匹配与既定文本回放，**不生成任何应答内容**。

### 3.3 STATE-SPEC 增补（先改规范再改实现）

- §4.2 矩阵新增一行：`gate auto`｜读：state、任务 config、present 钩子、策略文件｜写 state：`gate.presentedAt`、`gate.lastInteractedAt`、`gate.decision/closedAt`、`currentStage`、`stages[].status/at`、`artifacts`（推进路径与 next 同）｜写日志：`presented`(auto)/`interacted`(auto)/`decision`(auto)/`advanced`/`activated`/`artifacts-recorded`｜外部副作用：无。
- §4.4 `WRITER_ALLOWLIST` 增行：`'gate auto': ['currentStage','stages','artifacts']`（⊆ next ∪ gate present ∪ gate interact 白名单并集）。
- §3.0 命令计数 13 → 14；`tools/cli.js` 头部注释命令登记同步。
- 不变量不变：I-G1（先写 presentedAt 再决议）、I-J1、I-5；崩溃写序沿用「先 state 后日志」。

### 3.4 文件变更计划（引擎侧）

| 文件 | 职责/契约 |
|---|---|
| `tools/STATE-SPEC.md` | §3.0/§4.2/§4.4 增补 gate auto（§3.3 文案） |
| `tools/cli.js` | REGISTRY 注册 `gate auto`；handler 组装 present+决议/交互两分支；复用 next 决议路径 |
| `tools/lib/gate.js` | 新增 `applyPolicy(gates, policy)`（纯函数：规则匹配 → 选中选项与应答文本）；不改既有导出 |
| `tools/tests/gate-auto.test.js` | 单测：策略命中推进型/in-phase 型/未命中硬错/呈现留痕满足 I-G1/manual 流程不受影响 |

回退条件：若实现中发现决议写入路径无法安全复用（next handler 深耦合），收缩为 gate auto 仅做「present + 输出策略选中项」、由调用方执行既有 dispatch 命令——引擎更小侵入，语义等价（留痕分散在既有命令）。
