# 工作项 07 · exec-loop — 设计方案

> 版本：**v1.0（2026-09-23 已定版）**——P1–P6 全部定稿（P1 任务级三元组 / P4 缺省=当前相位+严格拦截 / P5 只定名划界；P2/P3/P6 默认采纳未否决），进入实现。变更需升级版本号并记录于 §11。
> 需求依据：[requirement.md](./requirement.md)（D1–D5）
> 契约基线：[../02-index-structure/plan.md](../02-index-structure/plan.md) v1.1（state schema，本轮扩展）、[../05-atom-tasks/plan.md](../05-atom-tasks/plan.md) v1.4 §2.1（L1/L2/L3 分级、`type: human` 注册源）、[../06-workflow/plan.md](../06-workflow/plan.md) v1.1 §4（next 现状）

## 1. 定位与设计原则

本轮把「确认门」从 prompt 文本（L2 硬约束块）升级为 **state 数据 + CLI 拦截**，并锁死执行节律。三条原则：

1. **两层归属（D4）**：需要确认是任务属性（`phases[].type: "human"`）；流程中的门实例与操作参数注册进 `.state.json`。
2. **职责解耦（需求输入 3）**：原子任务只注册门，不负责拦截；CLI 执行函数负责检查拦截与可读。
3. **节律结构锁（D5）**：不靠指令约定「要调 next」，靠「不 next 就 exec 不了下一个位置」锁死。

## 2. 确认门生命周期

```text
声明（任务属性）   config.json phases[].type: "human"（05 已有）+ 可选 gate.options 选项集（P1+v1.4：
   │               任务级定制，用户词汇决议名；未声明 → CLI 标准二元兜底 同意/驳回）
注册（run 实例）   run start / next 把位置点亮到 human 相位时写门：
   │               stages[k].gate = { phase, openedAt, options: [...] }（选项自任务声明
   │               逐字注册，action 四类白名单在注册时 fail fast 校验）
   │               status → waiting-human（06 P2 既有语义，不变）
拦截（CLI 检查）   exec / validate：执行位置必须 ∈ currentStage（§4.1）
   │               next：门开着 → 必须携带 --decision <name> 才放行，且 <name> 的声明
   │               action 必须是 next 命令（非推进型决议喂给 next → 拦截并指向其
   │               声明动作，§4.2）
呈现（agent→用户） 开门命令的输出（openedGates）/ status 的 gateOptions（呈现集，含 in-phase）：
   │               agent 用宿主提问工具原样呈现选项清单，用户选择后按 action 处理（D1）
关闭/处理          推进型（next --decision <name>）：推进 + gate 落 decision/closedAt 留痕；
                   转移型（如 驳回→rollback --stage k）：阶段重置即清门，重做后重新送审开新门；
                   in-phase（如 修改/提问）：按该相位 prompt 的行为定义处理，不触推进命令
```

**强度边界（诚实声明）**：拦截保证「门未关就不能推进」（结构性）；不防 agent 伪造决议——呈现协议是 SKILL 级约束，决议留痕供审计。严格用户亲跑通道留 O2。05 O-B 的 L3 以此形态落地并记录。

## 3. 声明层与 state schema 扩展（02 基线 → v1.2）

### 3.1 任务声明：`phases[].gate.options` 三元组（P1 定稿：任务级定制）

```json
{
  "id": "02", "summary": "用户确认门", "type": "human",
  "gate": {
    "options": [
      { "name": "同意", "desc": "批准当前 spec（仅当不存在未解决 BQ），本相位完成", "action": "next --decision 同意" },
      { "name": "驳回", "desc": "回滚 spec 阶段，按意见回到相位 01 重新生成",         "action": "rollback --stage spec" },
      { "name": "修改", "desc": "把反馈作为新的需求证据更新受影响条目，重新送审",       "action": "in-phase" },
      { "name": "提问", "desc": "只读答疑，不修改 spec、不改变任何 ID 与确认状态",      "action": "in-phase" }
    ]
  }
}
```

| 三元组字段（用户口径） | 字段 | 约束 |
|---|---|---|
| 参数 | `name` | 决议名 = **用户词汇**（`--decision` 的取值；phase 内唯一；`^[\\w一-鿿][\\w一-鿿-]*$`——字母/数字/下划线/连字符/CJK，无空格。v1.4：名字即用户嘴里的词，如 同意/驳回/修改/提问） |
| 描述 | `desc` | 给用户看的一句话（含后果）；任务级声明是静态文案（任务不知道自己在 workflow 中的后继，不点名后续阶段） |
| 动作 | `action` | **四类**（v1.4）：推进型 `next --decision <name>`（name 须与本选项一致）/ 转移型 `rollback --stage <id>`、`run finish --status <s>` / **相位内交互 `in-phase`**（无 CLI 命令，按该相位 prompt 的行为定义处理——修改/提问/归档等升为一等门选项）。注册时 fail fast 校验，垃圾命令进不了 state |

- **未声明 `gate.options` → CLI 标准二元兜底**（v1.3 起 4 个人审任务已声明，其余任务零改动兜底）：同意（desc 现算真实下一步：同阶段还有下一相位 →「进入 X（摘要）」；否则按 DAG →「收尾并点亮 后继」；无后继 →「收尾（run 将完成）」）+ 驳回（desc「回滚本阶段重做」，action 指向自身 stage）；
- 决议分类（v1.4 三类）：**推进型**（`next …`，可喂给 `next --decision`）/ **转移型**（rollback / run finish，agent 代跑声明命令）/ **in-phase**（相位内交互，按 prompt 行为定义处理，不触 CLI）。

### 3.2 state：`stages[k].gate`（D2：内嵌）

```json
"spec": {
  "status": "waiting-human",
  "dependOn": ["requirement"],
  "at": "2026-09-23T10:00:00.000Z",
  "gate": {
    "phase": "02",
    "openedAt": "2026-09-23T10:00:00.000Z",
    "options": [
      { "name": "同意", "desc": "批准当前 spec（仅当不存在未解决 BQ），本相位完成", "action": "next --decision 同意" },
      { "name": "驳回", "desc": "回滚 spec 阶段，按意见回到相位 01 重新生成",         "action": "rollback --stage spec" },
      { "name": "修改", "desc": "把反馈作为新的需求证据更新受影响条目，重新送审",       "action": "in-phase" },
      { "name": "提问", "desc": "只读答疑，不修改 spec、不改变任何 ID 与确认状态",      "action": "in-phase" }
    ],
    "decision": "同意",
    "closedAt": "2026-09-23T10:05:00.000Z"
  }
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `gate.phase` | string | 门看守的相位 id（两位） |
| `gate.openedAt` | date-time | 注册时间 |
| `gate.options[]` | object[] | **操作参数注册**（需求输入 3 / D4）：三元组自任务声明逐字注册（或 CLI 标准兜底现算） |
| `gate.decision` / `gate.closedAt` | string / date-time | 仅关闭后出现（推进型决议留痕）；转移型决议走对应命令（rollback 清门 / finish 归档），不落 decision |

生命周期规则：

- **开启**：`run start` 点亮起点、`next` 相位内推进 / DAG 点亮，目标相位 `type: human` 时写门（现有任务中 spec:02 / test-plan:02 等即此形态；test-plan 为「中间人审位」案例：01→02(human)→03）；
- **关闭（推进型）**：next 推进成功时落 `decision/closedAt`，记录保留；
- **清除（转移型 / 上游回滚）**：rollback 重置集合内的阶段**显式删除 gate**（现有实现 `{...stage, status:'pending'}` 会保留旧字段——实现时必须显式清）；重做再进 human 相位开新门；
- `run finish` 不动门（history 行不含 gate，state 随项目归档）。

## 4. 命令变更

### 4.1 `exec` / `validate`：位置校验（节律结构锁）

```text
规则:   --task 必须出现在 state.currentStage 的某个 entry 中；
        --phase 缺省 = 该任务在 currentStage 中的当前相位；
        显式 --phase 必须与当前位置一致（不得超前执行未来相位、不得重放已过去相位；
        重放【当前】相位合法——validate 失败修正循环需要）。
不符:   exit 1，stderr 指明当前位置与被拒位置，如：
        「执行位置不符：currentStage = [spec:01]，不能 exec coding:01」
```

validate 的 `--phase` 缺省同步改为「当前位置相位」（现状缺省 01，test-plan:03 场景会错位）。

### 4.2 `next`：门检查与决议

```text
用法:   next --state <path> [--decision <name>] [--tasks-dir <path>]
检查:   currentStage 任一 entry 的相位 type=human 且其 stage 的 gate 开着（无 decision）：
          未携带 --decision → exit 1：
            stderr「确认门未关闭：<stage>:<phase> 需用户决议」+ 选项清单人话版
            （in-phase 显示为「相位内交互」）；stdout JSON 含 gate 全量——错误信息本身就是提示。
          携带 <name>：
            <name> 不在该门声明的 options 中 → exit 2（未知决议）；
            <name> 的 action 是 in-phase → exit 1（相位内交互不走 next，指向 prompt 行为定义）；
            <name> 的 action 是转移型命令 → exit 1，指向其声明的 action
              （如「驳回 的动作是 rollback --stage spec，请执行该命令」）；
            合法（推进型）→ 正常推进；该 gate 落 decision=<name>/closedAt。
        --decision 在无开门时使用 → exit 2（用法错误，防 cargo-cult）。
输出:   既有 advanced/finished/activated/currentStage/completed 之外新增：
          openedGates: [ { stage, phase, options } ]     ← 本轮推进进入 human 相位时
          closedGates: [ { stage, decision } ]           ← 本轮决议关闭的门
粒度:   --decision 作用于 currentStage 全部开门（基础链单门；并行细分留 O1）
```

### 4.3 `run start` / `rollback` 对齐

- `run start`：点亮起点时首相位为 human → 写门（现有任务无此形态，机制对称支持）；
- `rollback`：重置集合内阶段的 gate 显式清除；输出新增 `clearedGates: [stage…]`。

### 4.4 新命令 `status`（顶层动词，03 §3.4 自足原语）

```text
用法:   status --state <path>
输出:   {
          runId, title,
          currentStage: [ { stage, phase, phaseType, status, gate? } ],
          gateOptions: [ { name, desc, action } ],        // 呈现集：开门位的全部选项（含 in-phase）
          availableCommands: [ { name?, cmd, desc } ]     // 可执行集：命令型选项 + 派生命令
        }
派生:   两清单均由 state 现算（不存储，单一事实源）：
          action 位    → gateOptions 空；availableCommands = exec/validate/next
                         + rollback（可回滚阶段）/ run finish --status aborted
          human 开门位 → gateOptions = 门全部选项；availableCommands 仅命令型选项
                         （action 补全 --state 成 cmd；in-phase 不进可执行集）
                         + run finish --status aborted
          currentStage 空 → availableCommands = run finish --status done（收束提示）
定位:   中断恢复的唯一定位入口：SKILL 约定 agent 在中断点调用 status，
        把 gateOptions 与 availableCommands 原样转述给用户（D1/D3——提示 = 结构化输出的转述）
```

## 5. 原子上下文窗口（概念定名与本轮边界）

用户概念澄清后的定名：**原子上下文窗口 = 当前执行位置绑定的全部内容**，两条绑定通道，均由命令物化：

| 通道 | 内容 | 物化命令 | 状态 |
|---|---|---|---|
| prompt 绑定 | 前言 + 当前相位段 + 钩子现算 ctx + extra_ctx + rules + Output Contract | exec 组装（05 已实现） | 既有 |
| 门绑定 | 确认门 + 操作参数（命令 + 后续动作） | start / next 注册，status 读取 | **本轮落地** |

「通过命令规范窗口内哪些内容是绑定的」= 窗口内容由 CLI 命令物化与校验（exec 只服务当前位置 = 越窗拦截；ctx 注入时序仍归钩子按 state 现算，05 D12 不动）。**本轮不做**窗口绑定登记（把每次 exec 实际注入的 ctx 清单 receipt 写入 state 供中断恢复比对）——留 O3（P5 评审确认）。

## 6. SKILL 驱动循环改写（随实现落地）

```text
逐相位:  exec → agent 执行 → validate → next
开门时:  next 输出含 openedGates（或 status 显示 waiting-human）→
         agent 必须用宿主提问工具原样呈现门的选项清单（name/desc/action），
         用户选择后按 action 处理：推进型（next --decision <name>）由 agent 代跑 next；
         转移型（rollback / finish）按声明的命令执行；
         in-phase（修改/提问等）按该相位 prompt 的行为定义处理，不触推进命令。
中断恢复: 读 index/state → status → 把 gateOptions 与 availableCommands 原样转述给用户，等选择。
红线:    门未关时代跑 next 必被 CLI 拦截（exit 1）；转移型与 in-phase 选项喂 next 也会被拦；
         不得替用户决议、不得省略呈现。
```

README 命令表同步（status / --decision / 位置校验说明）。

## 7. 实现清单

| 文件 | 动作 | 内容 |
|---|---|---|
| `tools/lib/workflow.js` | 扩展 | `buildGate(state, stageId, phase, tasksDir)`：读任务 `gate.options` 三元组逐字注册（含 action 动词合法性校验），未声明 → 标准二元兜底（desc 按 DAG 现算后继）；`hasOpenGate` 判断 |
| `tools/cli.js` | 扩展 | exec/validate 位置校验与相位缺省；next 门检查 + `--decision <name>` 匹配与推进型判定 + openedGate/closedGate；start 开门；rollback 清门 + clearedGates；登记 `status` |
| `tools/lib/state.js` | 扩展 | assertState 认知 `stages[k].gate`（可选字段，校验形态：phase/openedAt/options 三元组） |
| `SKILL.md` / `README.md` | 更新 | §6 驱动循环 + 命令表 |
| `tools/tests/*` | 扩展 | §8 用例 + 既有用例适配（exec 用例需对齐 currentStage） |

## 8. 测试计划（沙箱约定沿用）

| 对象 | 用例 |
|---|---|
| 位置校验 | exec 非 currentStage 任务 → exit 1；exec 未来相位 → exit 1；重放当前相位 → 成功（修正循环）；validate 相位缺省 = 当前相位 |
| 门生命周期 | next 进入 spec:02 → gate 写入 + status=waiting-human + openedGate 输出；无 --decision 的 next → exit 1 且输出含 options 三元组；`--decision approve` → 推进 + decision/closedAt 落盘；rollback → gate 清除 + clearedGates；重做再入 :02 → 开新门 |
| 任务级定制 options | fixture 任务声明三元组（含非标准决议名如 approve-with-changes）→ 注册进 state 逐字一致；`--decision approve-with-changes` 放行；转移型决议（reject）喂 next → exit 1 且指向声明 action；action 非法动词 → 注册时 fail fast |
| 兜底 options | 未声明 gate.options 的 human 相位 → 标准二元（desc 含现算后继阶段名） |
| start 开门 | 构造首相位 human 的测试任务 → run start 即写门 |
| status | action 位 / human 开门位 / currentStage 空 三态的 availableCommands 断言 |
| 用法 | 无开门时 `--decision` → exit 2；未知决议名 → exit 2 |
| 回归 | 既有 41 用例适配后全绿（exec/next 用例补位置对齐与门参数） |

## 9. 开放问题

| # | 问题 | 状态 |
|---|---|---|
| O1 | 并行 DAG 多门决议粒度 | 后续轮（--decision 现作用于全体开门） |
| O2 | 严格模式（用户亲跑通道 / 环境开关） | 后续可选 |
| O3 | 窗口绑定登记（ctx 注入 receipt） | 后续轮（P5 确认） |
| O4 | 契约联动收账：02 升 v1.2、04 O2 关闭、05 O-B 关闭（L3 落地形态记录）、06 无涉 | 实现时同步 |

## 10. 评审要点（已全部定稿）

| # | 结论 |
|---|---|
| P1 | ✅ 定稿：门操作集 = 任务级定制三元组（name/desc/action，`phases[].gate.options`，action 动词白名单 fail fast）；未声明 CLI 标准二元兜底；转移型决议不得喂 next |
| P2 | ✅ 定稿：推进型决议后 gate 保留 decision/closedAt 留痕；转移型经 rollback 清门（痕迹在 rollback --reason） |
| P3 | ✅ 定稿：新命令命名 `status`（顶层动词） |
| P4 | ✅ 定稿：exec/validate 的 `--phase` 缺省 = 当前位置相位；显式传参须与当前位置一致，否则拦截 |
| P5 | ✅ 定稿：原子上下文窗口本轮只定名 + 边界文档化（§5）；绑定登记留 O3 |
| P6 | ✅ 定稿：当前相位可重放（修正循环）；过去/未来相位拦截（渐进式加载红线） |

## 变更记录

| 版本 | 日期 | 说明 |
|---|---|---|
| v0.1 | 2026-09-23 | 初版：门生命周期（声明/注册/拦截/呈现/关闭）、stages[k].gate schema、四命令变更 + status、窗口概念定名、SKILL 改写要点、实现清单与测试计划、P1–P6 评审点 |
| v0.2 | 2026-09-23 | P1 定稿升级为任务级定制：§3.1 `phases[].gate.options` 三元组（name/desc/action，action 动词白名单 fail fast）+ 标准二元兜底 + 推进型/转移型决议分类与 next 拦截规则；同步 §2/§4/§6/§7/§8 |
| **v1.0** | 2026-09-23 | **定版**：P4（缺省=当前相位+严格拦截）、P5（只定名划界）按推荐定稿；P2/P3/P6 默认采纳。实现细节微调：next/start 的开门/关门输出用数组字段 `openedGates[]` / `closedGates[]`（并行 DAG 对称）。进入实现 |
| **v1.1** | 2026-09-23 | **实现完毕**：`workflow.js` 增 `standardOptions`/`buildGate`（三元组逐字注册 + action 白名单 fail fast）；`state.js` assertGate 形态校验；cli 五处落地——exec/validate 位置协议（缺省=当前相位、不一致拦截、重放当前相位合法）、next 门检查（无 `--decision` 拦截且错误即提示、未知决议 exit 2、转移型决议喂 next 拦截并指向声明动作、决议留痕）、start 首相位 human 开门、rollback 显式清门（`clearedGates`）、新顶层动词 `status`（三态 availableCommands 派生 + `--state` 补全）。**严格语义**：human 相位无 gate 视同开门（手工/legacy state 不放行，兜底标准二元提示）。测试 53/53（新增 gate.test.js 12 例，validate/next 夹具按位置协议对齐）；E2E 冒烟（start → 开门 → 拦截 → status → `--decision approve` 推进）通过；SKILL/README 同步；02 升 v1.2、04 O2 关闭、05 O-B 关闭 |
| v1.2 | 2026-09-23 | **命名修订**（用户评审：`ops` 易联想运维平台，实际语义是「选项」）：`gate.ops` → `gate.options`；三元组 `op/desc/action` → `name/desc/action`（name 即 `--decision` 取的决议名，flag 本身不变）；status 输出 `availableOps` → `availableCommands`（名副其实：可直接执行的命令清单）；代码标识同步（standardOptions / renderOptions / DECISION_RE）。全仓 11 文件统一，测试 53/53 复验通过 |
| v1.3 | 2026-09-23 | **任务适配收口**：① 4 个人审相位（spec/plan/test-plan/reflection 的 `:02`）声明 `gate.options`——desc 只写任务内事实（如 spec「仅当不存在未解决 BQ」、test-plan「进入相位 03（TDD Red 骨架）」、reflection「随后执行 run finish」），不越权点名 workflow 后继；② 四任务 prompt.md 确认门段去双轨——门决议改为「从 state 的 `stages.<task>.gate.options` 呈现，不得自造推进/回滚选项」，`修改/提问/回答 BQ/归档` 等相位内交互留在 prompt（不是门决议）；③ `standardOptions` 兜底 desc 升级为现算真实下一步（中段人审位不再误说「收尾并点亮」）；④ spec 的「BQ 未解决禁止批准」留 prompt 约束（静态声明表达不了条件选项，动态生成属未来扩展）。测试 56/56（gate.test.js 增 3 例：声明注册逐字一致 / 中段兜底「进入 :03」/ 末段兜底「run 将完成」）；E2E 冒烟（声明选项呈现 + 去双轨 prompt + approve 推进）通过 |
| v1.4 | 2026-09-24 | **用户词汇决议名 + in-phase 第四类 + config 标准格式**（用户评审两点）：① 决议名从 ASCII 标识改为用户词汇（charset 放开 CJK：`^[\w一-鿿][\w一-鿿-]*$`），名字即用户嘴里的词——4 任务选项集按各自 md 语义定稿（spec：同意/驳回/修改/提问；plan：+归档；test-plan：同意/驳回/修改/提问；reflection：同意/修改/提问），`修改/提问/归档` 升为一等门选项（action=in-phase），双轨彻底清零；② action 四类白名单（推进/转移/`run finish`/in-phase），in-phase 喂 next → exit 1 指向 prompt 行为定义；③ status 输出拆双清单——`gateOptions`（呈现集，含 in-phase）/ `availableCommands`（可执行集，仅命令型 + 派生）；④ 新增 `atom-tasks/_schema/task-config.schema.json`（任务 config 标准格式，增量兼容：additionalProperties 放行、已知字段严格；语义级约束仍归 buildGate），`run start` 装配时对全链任务 fail fast 校验（expandStages → validateTaskConfig）。兜底选项集更名 同意/驳回。测试 60/60（gate.test.js 19 例：含 in-phase 拦截/双清单/全仓 config schema 校验/装配 fail fast） |
