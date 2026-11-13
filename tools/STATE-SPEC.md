# STATE-SPEC — `.state.json` 结构规范（schema v2）与工具读写规则

> **定位**：本文件是 state 数据模型与全部引擎命令读写规则的**单一权威文档**（schema v2）。来源：issue #86 实施指导手册自足版 v1.1 §3+§4（2026-11-11 批准）。
> **冲突处理**：本文件与代码事实矛盾时，以「文件+符号」重定位为准；修订契约先改本文件再改实现。
> **版本**：schema v2（`schemaVersion: 2`；v1 = 无标记的现行结构，零迁移兼容，见 §3.8/§4.5）。

---

## 3. v2 数据模型完整规范（字段级）

> v2 对 v1 只做**加性演进**：新增段均为可选段，v1 state 无需迁移即可被 v2 内核读写（零迁移先例：`git.multiRepo`、`subflows`）。
> （呈现约定：本文档内 JSON 示例块一律按 `JSON.stringify(x, null, 2)` 形态展开——与引擎序列化格式对齐，见 I-8；行内短引用不受此约束。）

### 3.0 六分区总览

state 顶层按职责分为六区。分区是**规范概念**（JSON 无物理分栏），每区有唯一写入方集合与生命周期：

| 区 | 职责 | 字段（顶层键） | 生命周期 | 变更方 |
|---|---|---|---|---|
| A 标识区 | run 身份，创建后不可变 | `runId` `title` `startedAt` `schemaVersion` `ephemeral?` `workflow?` | 创建时定稿 | 仅 run start / subflow start（创建） |
| B 环境区 | 运行环境与旋钮，创建后不可变 | `git` `dirs` `atomTasks` | 创建时定稿 | 仅 run start / subflow start（创建） |
| C 进度区 | 权威机器状态（控制流唯一事实源） | `currentStage` `stages`（含 `gate` 协议子对象） | 随推进变更 | next / gate present / gate interact / rollback / run finish |
| D 编排区 | 子流程注册与溯源 | `subflows?` `subflow?` | 运行期变更 | subflow start / subflow close |
| E 产物区 | 各阶段产物文件登记（当前有效集） | `artifacts?` | 相位推进时追加/回滚时清除 | next / rollback |
| F 使用日志区 | 使用痕迹（**移出 state**） | —（独立文件 `.usage.jsonl`） | 仅追加 | 全部变更型命令 |

**核心原则**：state 只承载「驱动控制流所必需的当前事实」；使用历史（F 区）全部移入同级追加式日志文件，任何命令不得从日志读取控制流依据（不变量 I-J1）。

### 3.1 A 标识区

| 字段 | 类型 | 必填 | 缺省 | 写入方 | 语义与约束 |
|---|---|---|---|---|---|
| `runId` | string | 是 | — | run start | 顶层 run 匹配 `^\d{8}-\d{6}-[0-9a-f]{4}$`；子流程为 `<父runId>-sf-<n>`。创建后不可变。 |
| `title` | string | 是 | — | run start | 一句话标题，非空。进 state 与 history。 |
| `startedAt` | string | 是 | — | run start | ISO 8601 本地时间带时区偏移（`tools/cli.js` nowIso）。创建后不可变。 |
| `schemaVersion` | integer | v2 是（v1 缺失视为 1） | 2 | run start | 结构代际标记，合法域 `[1, 2]`。缺失 = v1（存量零迁移）。只增不改。 |
| `ephemeral` | boolean | 否 | false（缺失） | run start | 临时模式标记；true 时 finish 走删除分支。创建后不可变。 |
| `workflow` | string | 否（v2 建议必填） | — | run start | 物化的预设名（如 `basic`）。v1 无此字段（run start 返回值有、state 未存——v2 补齐缺口）。 |

### 3.2 B 环境区

| 字段 | 类型 | 必填 | 写入方 | 语义与约束 |
|---|---|---|---|---|
| `git` | object | 是 | run start | 单仓库：`mainBranch`/`branch`/`worktreePath`（可缺省推断链）；multi：`multiRepo:true` + `container` + `repos[]`（role/name/repoPath/worktreePath/branch/mainBranch，主仓库首位，worktreePath 全局唯一）。创建后不可变。 |
| `dirs` | object | 是 | run start | `projectRoot`/`runDir` 绝对路径且 runDir ⊆ projectRoot（ephemeral 例外放行）；`tasksDir?` 绝对路径——**解析优先级**：`--tasks-dir` flag > `state.dirs.tasksDir` > skillRoot 缺省（`tools/cli.js` tasksDirFor），本规范固化该三级取值；`projects?` multi 同序清单。创建后不可变。 |
| `atomTasks` | object | 是（可为空对象） | run start / subflow start | `<task>.<key> → value` 运行级旋钮（defaults 预填 + `--config` 覆盖后的终值）。创建后冻结。 |

### 3.3 C 进度区（权威状态）

**`currentStage`**：`string[]`，必填；元素形如 `<task>:<phase>`，phase 两位数字。语义：**当前位置清单**（执行循环的驱动器）；空数组 = run 已收束（finish 清空；zip 归档保留清空前快照——有意分歧，见 I-7）。

**`stages`**：`object<task, stageEntry>`，必填；由预设物化（`tools/lib/workflow.js` expandStages），物化后自包含、不回指预设文件。`stageEntry`：

| 字段 | 类型 | 必填 | 语义 |
|---|---|---|---|
| `status` | enum | 是 | `pending` / `running` / `waiting-human` / `done` / `failed`（五值收敛）。状态机见下。 |
| `dependOn` | string[] | 是 | DAG 依赖（物化自预设）。不可变。 |
| `at` | ISO string | 是 | **最后触碰时刻**：该阶段最近一次 status 变更或 gate 写入的时刻（每次覆盖，非历史）。v2 明确其为「最后触碰」语义，不承担审计职责（审计在 F 区）。 |
| `gate` | object | 否 | 确认门协议对象（仅 human 相位）。见下。 |

**`gate` 协议对象（v2 有界化）**：

| 字段 | 类型 | 必填 | 语义 |
|---|---|---|---|
| `phase` | string | 是 | 两位相位 id，`^\d{2}$`。 |
| `openedAt` | ISO | 是 | 开门时刻。 |
| `options` | object[] | 是 | 静态声明选项三元组 `{name, desc, action}`（action 白名单：`next --decision <n>` / `rollback --stage <id>` / `run finish --status <s>` / `in-phase`）。**长度有界**：来自任务声明或标准二元兜底，不随使用增长。 |
| `presentedAt` | ISO | 否 | 最近一次呈现时刻（覆盖式）。 |
| `lastInteractedAt` | ISO | 否（v2 新增） | 最近一次相位内交互时刻（覆盖式标量）。**取代 v1 的 `interactions[]` 数组**：呈现有效性判定只需「最后一次交互时刻」，不需要全量交互史。 |
| `decision` | string | 否 | 推进型决议名（门关闭时写）。 |
| `closedAt` | ISO | 否 | 门关闭时刻。 |

- **v1 字段 `interactions[]` 废弃**：v2 写入方不得再写入；v2 读取方不得依赖（兼容读取：存在则忽略）。全量交互史迁往 F 区日志。
- **`lastInteractedAt` 的性质**：它是**协议必需标量**而非历史记录——呈现有效性判定（I-G1）需要「最后一次交互时刻」这一控制流事实，与 `presentedAt` 同类。以一个标量取代 v1 的无界数组，state 复杂度**净减**；历史操作记录全部外置 F 区，不因此回流 state。
- 呈现有效性（I-G1，`tools/lib/gate.js` isPresentationValid）：`presentedAt > openedAt` 且 `presentedAt > lastInteractedAt`（存在时）。判定只依赖 state 内标量，不读日志。

**阶段状态机（现状固化，v2 无变更）**：`pending →(激活)→ running|waiting-human →(相位耗尽)→ done`；`→(回滚)→ pending`；`→(失败终态)→ failed`。激活条件：dependOn 全 done（DAG 就绪）。

### 3.4 D 编排区

沿用现行结构（`tools/lib/state.js` assertSubflows/assertSubflowMeta 校验即规范）：`subflows[]`（父侧注册表：id `sf-<n>` 全 run 唯一 / title / workflow / atStage / statePath ⊆ `<runDir>/subflows/` / status `active|closed` / startedAt / closedAt? / abandoned?）与 `subflow`（子侧溯源：depth ∈ [2,3] / parentStatePath / parentRunId / atStage / title）。v2 无结构变更，仅纳入本规范管辖。

### 3.5 E 产物区（v2 新增）

```json
"artifacts": {
  "spec": [
    {
      "phase": "01",
      "recordedAt": "…",
      "trigger": "next",
      "files": [
        {
          "path": "spec.md",
          "bytes": 4380,
          "sha256": "…"
        }
      ]
    }
  ],
  "plan": [
    {
      "phase": "01",
      "recordedAt": "…",
      "trigger": "next",
      "files": [
        {
          "path": "plan.md",
          "bytes": 6120,
          "sha256": "…"
        },
        {
          "path": "plans/01-数据模型契约.md",
          "bytes": 9800,
          "sha256": "…"
        }
      ]
    }
  ]
}
```

| 要素 | 规则 |
|---|---|
| 键 | stageId；值为该阶段**已完成的 action/updates 相位登记条目数组**（按推进顺序追加）。 |
| 条目 | `{phase, recordedAt, trigger, files[]}`；`trigger` 恒为 `next`（登记时机=相位推进，§4.3.1）。 |
| `files[].path` | runDir 内相对路径，禁绝对路径与 `..`（复用 `tools/cli.js` artifactPath 防逃逸）。**split 分册文件以 `plans/NN-*.md` 前缀路径逐一登记**。 |
| `files[].bytes` / `sha256` | 登记时刻的文件大小与 SHA-256（Node crypto，读入即算）。粒度：路径 + 大小 + 内容摘要，足够支持完整性与下游失效判定，成本可控。 |
| 语义 | **当前有效集**：rollback 重置某阶段时删除该键下对应条目（重做后重新登记）；历史轨迹在 F 区日志（`artifacts-recorded` 事件），不在 state 保存全史。 |
| 不变式 | I-E1：条目内 file 必须在登记时刻真实存在；I-E2：登记只发生在 `next`（validate 保持纯读）；I-E3：键 ⊆ `stages` 的键。 |

### 3.6 完整 state 顶层键清单（v2 权威定界）

`runId` · `title` · `startedAt` · `schemaVersion` · `ephemeral?` · `workflow?` · `git` · `dirs` · `atomTasks` · `currentStage` · `stages` · `subflows?` · `subflow?` · `artifacts?`

（? = 可选段。除上述外不得新增顶层键；扩展先入本规范再入实现。）

### 3.7 F 使用日志区：`.usage.jsonl`（v2 新增）

**定位**：使用日志是**纯复盘材料**——保存运行中间过程信息（交互、决议、推进、回滚、产物登记事件），供事后复盘与审计消费；它不被任何控制流读取（I-J1），因此**不增加 `.state.json` 的复杂度**。与之对照，产物登记（E 区）因被下游阶段消费而留在 state。

- 位置：与 `.state.json` 同级（`<runDir>/.usage.jsonl`）；子流程各自独立一份。随 runDir 整目录进入 finish zip 归档；ephemeral 随目录删除。
- 形态：JSON Lines，仅追加，一行一事件（下为事件对象结构示意；文件内序列化为单行——JSONL 正常形态，豁免 I-8）：

```json
{
  "seq": 7,
  "at": "2026-11-11T15:02:11.482+08:00",
  "event": "interacted",
  "command": "gate interact",
  "stage": "spec",
  "phase": "02",
  "option": "修改",
  "note": "反馈：…"
}
```

| 字段 | 规则 |
|---|---|
| `seq` | 文件内单调递增正整数，从 1 起；**允许空洞**（崩溃窗口语义，见下）。 |
| `event` | 枚举 11 种：`run-started` / `presented` / `interacted` / `decision` / `advanced` / `activated` / `rollback` / `subflow-started` / `subflow-closed` / `artifacts-recorded` / `finished`。 |
| `command` / `stage` / `phase` / `option` / `note` / `detail` | 按事件适用性可选。**note 按事件承载**：`interacted` = 用户交互反馈全文（现行 `--note`，v1 进 state、v2 只进日志）；`presented` = agent 执行摘要（`gate present --note`，§4.3.5）；`rollback` = reason。note 推荐两段式人可读格式——**做了什么（动作/变更清单）＋为什么/结论（理由与影响）**；自由文本，不承诺结构化（纯复盘用途）。 |

**追加顺序规则（崩溃一致性）**：

- 涉及门新鲜度镜像的事件（`interacted`）：**先写 state（`lastInteractedAt`）成功，再追加日志**。崩溃于两写之间 → 镜像已新、日志缺行 → 呈现判定偏保守（要求重新呈现），方向安全。
- 纯审计事件（`decision`/`advanced`/…）：**state 写成功后追加**；追加失败输出 stderr 警告、不回滚已提交的状态变更（审计尽力而为，控制流一致性优先）。
- `seq` 空洞即上述崩溃窗口的合法产物，消费方不得假设连续。
- 回滚不再销毁使用史：v1 中 rollback `delete stages[s].gate` 连同交互史一并删除；v2 交互史在日志中天然保留，回滚只清协议对象。

### 3.8 全局不变量（硬约束清单，实现落点=assertState 扩展 + 测试）

- **I-1 单一事实源**：控制流判定只读 state；`.usage.jsonl` 永不参与控制流。
- **I-2 原子写**：所有 state 写入经 atomicWrite（`tools/lib/fsutil.js`）；读写模型=现读不缓存（四通道契约）。
- **I-3 写入方白名单**：每个命令只允许写其声明字段集（矩阵见 §4.2、表见 §4.4）；exec/validate/status/resume/guide/list/deps 为纯读命令。
- **I-4 产物防逃逸**：E 区与产物归档路径必须 runDir 内相对（复用 artifactPath）。
- **I-5 门对象有界**：`gate` 除 `options`（声明期定长）外不得含数组字段；`interactions` 禁止再写入。
- **I-6 版本单调**：`schemaVersion` 只增；读取方容忍低版本（可选段零迁移）；未知顶层键不拒绝（前向兼容，assertState 现行为保持）。
- **I-7 归档快照语义**：finish 先 zip 后清 `currentStage`——zip 内为收束前快照、活文件为收束后状态，此分歧为既定设计，规范予以固化而非「修复」。
- **I-8 可读序列化**：引擎写入的独立 JSON 文件（`.state.json`、`~/.ddo/index.json`）统一 2 空格缩进 + 尾随换行——现行实现已然，规范固化、零代码改动；JSONL 文件（runs.jsonl、`.usage.jsonl`）一行一事件为其正常形态，不适用本条。
- **I-G1 呈现有效性**：见 §3.3。
- **I-J1 日志不驱动控制流**：见 §3.0 核心原则（I-1 的日志向专项表述）。
- **I-E1..E3 产物登记**：见 §3.5。
- **I-S1..S4 子流程**：沿用现行（statePath 防逃逸 / closed 必附 closedAt / depth ∈ [2,3] / id 全 run 唯一）。

---

## 4. 工具读写规则（全部 13 命令）

### 4.1 通用规则（先于矩阵，适用于所有命令）

- **R-1 现读不缓存**：每次命令执行重新 `readState` + `assertState`（`tools/lib/state.js`），无内存缓存——并发会话以最后一次写为准。
- **R-2 原子写**：state 变更仅经 `writeState`（atomicWrite），禁止局部 patch、禁止手工编辑。
- **R-3 白名单纪律**：命令只允许写矩阵声明的字段；实现载体为 `state.js` 内的 `WRITER_ALLOWLIST` 表 + 测试快照断言（缺省不增加运行时开销，`DDO_STATE_STRICT=1` 时开启写后比对守卫）。
- **R-4 纯读命令零写入**：exec / validate / status / resume / list / guide / deps check 不得写 state 与日志（发现即 bug）。
- **R-5 日志随写**：变更型命令在 state 写成功后按 §3.7 顺序规则追加 `.usage.jsonl`。
- **R-6 外部副作用边界**：index（~/.ddo/index.json）、history（~/.ddo/history/runs.jsonl 与 zip）、runDir 产物文件、`_del/` 归档目录均**不是 state 字段**，其写入时机在 §4.2 矩阵逐命令注明，防止与 state 写入次序混淆。

### 4.2 矩阵总表（覆盖 `tools/cli.js` REGISTRY 全部 13 命令，无遗漏）

| 命令 | 读 | 写 state | 写日志（事件） | 外部副作用 |
|---|---|---|---|---|
| `run start` | workflow 预设、任务 config、index（freshRunId 防碰撞） | **创建** A+B+C+E 空骨架+`schemaVersion:2`+`workflow`（全字段初始物化） | `run-started`（创建日志文件+首事件） | mkdir runDir；index.register |
| `exec` | state、任务 config/prompt、output schema | — | — | — |
| `validate` | state、任务 config、产物文件 | — | — | — |
| `next` | state、任务 config（相位/门声明）、产物文件（E 区登记快照） | `currentStage`、`stages[].status/at`、`gate.decision/closedAt`、`artifacts`（相位推进时登记） | `decision`、`advanced`、`activated`、`artifacts-recorded` | — |
| `gate present` | state、任务 config、present 钩子 | `gate.presentedAt`；隐式门物化（`gate` 整对象补全） | `presented`（可含 `--note` agent 执行摘要，§4.3.5） | — |
| `gate interact` | state、任务 config、present 钩子 | `gate.lastInteractedAt`（v2；v1 写 `interactions[]` 追加） | `interacted`（含 note 全文） | — |
| `rollback` | state、任务 config（output 声明）、`_del/` 扫描 | `stages[reset].status='pending'/at`、**删除** `gate`、**删除** `artifacts[reset]` 条目、`currentStage=[target:01]` | `rollback`（含 reason） | 产物移动至 `_del/rollback-<n>/`（次序：先归档文件再写 state） |
| `status` | state、任务 config | — | — | — |
| `resume` | index、state | — | — | — |
| `list tasks` / `list workflows` | 任务/预设目录 | — | — | — |
| `guide` | 预设、任务 config、index | — | — | — |
| `subflow start` | 父 state、预设、任务 config | 子 state **创建**（同 run start 形态+`subflow` 溯源段）；父 `subflows[]` 追加 | 双侧 `subflow-started`（父日志先，随父 state 写） | mkdir `<runDir>/subflows/sf-n/` |
| `subflow close` | 父 state、子 state（终态校验） | 父 `subflows[id].status='closed'`+`closedAt`(+`abandoned`) | `subflow-closed` | — |
| `run finish` | state、runDir | `currentStage=[]`（仅非空时写） | `finished`（**先于 zip**：日志随 runDir 进归档） | ①zip 归档 ②history.append ③index.unregister ④（ephemeral：删 runDir 替代①②） |

### 4.3 关键写入时机细则

#### 4.3.1 E 区（artifacts）登记——仅发生在 `next`

- **触发点**：`next` 将某 action 相位推进（相位内 or 阶段收尾）时，对该相位声明的 output 做存在性快照登记：
  - 字符串声明（如 plan 相位 01 的 `"plan.md"`）→ 登记该文件 + **声明的产物目录**（见 4.3.2）下现存文件；
  - `{updates:[…]}` 声明（human 相位，如 plan 相位 02）→ 在 `next --decision` 关门时按同规则登记。
- **为什么不在 validate**：validate 是纯读校验器（R-4）——「校验通过」与「登记事实」解耦：登记证据=推进时刻文件存在+摘要，而非校验结论。**不新增命令、不改 validate 契约**，登记搭 `next` 便车。
- **失败语义**：声明文件在推进时缺失 → 登记空 files 并在 stdout 提示（不阻断推进——阻断职责在 validate，位置协议已在 SKILL.md 执行循环中约束「校验成功后才推进」）。

#### 4.3.2 split 分册目录的声明扩展（解决 plans/ 不可见）

- 任务 config 的 output 声明新增目录形态：`{"files": ["plan.md"], "dirs": ["plans"]}`（与现行 `string` / `{updates:[…]}` 并列，第三形态；结构载体=`atom-tasks/_schema/task-config.schema.json` 的 `output.oneOf`）。
- `plan` 任务相位 01 改声明为上述形态 → `next` 登记 `plan.md` + `plans/` 下全部现存分册（逐文件 path/bytes/sha256）；validate 对 `dirs` 做「目录存在且非空」检查（split 时），分册内容契约仍由 plan.md 的 Parts Manifest 承载（engine 不解析 manifest 内容，只登记文件集）。
- `stageOutputFiles`（rollback 归档清单推导，`tools/cli.js`）同步扩展：`dirs` 声明在回滚时整目录移入 `_del/rollback-<n>/`。

#### 4.3.3 finish 次序（固化现行 + 日志插入点）

`run-started … finished 日志追加 → ① zip（含 state+日志+产物）→ ② history.append → ③ index.unregister → ④ currentStage 清空写回`。①② 幂等、崩溃重跑即恢复（现行语义）；`finished` 日志先于 zip 保证归档完整；④ 最后写使活文件呈现收束后形态（I-7）。

#### 4.3.4 subflow 双 state 写序

`subflow start`：先物化子 state（子目录+子日志首事件），后写父 state（注册表追加）——崩溃窗口内子 state 存在但父未注册=孤儿目录，重跑同 id 目录已存在即报错，人工清理；不产生父侧脏注册（保守方向）。`subflow close`：只写父 state。

#### 4.3.5 agent 执行摘要留痕（对现有工具的扩展，不新增命令）

- `gate present` 增可选参数 `--note <text>`：agent 呈现送审时附「本轮执行摘要」；引擎写入 `presented` 事件的 `note` 字段（两段式建议见 §3.7）——**note 不进 state**（呈现有效性仍只看 `presentedAt` 标量，I-G1 不变），职责判据保持。
- 提示注入点（单点）：`gate present` 输出 payload 的 `hint` 文本增补一行「呈现时可附 `--note` 两段式执行摘要（做了什么+结论）」——agent 在提交时刻被提示，无需在 exec 指令做条件注入。
- 边界：无 human 相位的阶段（如 reporting 类收尾阶段）无呈现时刻，其过程记录仍由产物文档 + E 区登记（`artifacts-recorded`）承载；`interacted`（用户反馈）与 `presented`（agent 摘要）的 note 语义分离，复盘时按 `event` 区分。

### 4.4 `WRITER_ALLOWLIST` 定义（R-3 的实现契约）

```js
// tools/lib/state.js
const WRITER_ALLOWLIST = {
  'run start':      ['*create*'],                                  // 全量创建（A/B/C/E 空骨架）
  'next':           ['currentStage', 'stages', 'artifacts'],
  'gate present':   ['stages.*.gate.presentedAt', 'stages.*.gate'],// 隐式门物化限 gate 整对象
  'gate interact':  ['stages.*.gate.lastInteractedAt'],
  'rollback':       ['currentStage', 'stages', 'artifacts'],
  'subflow start':  ['*create*child*', 'subflows'],                // 子创建+父注册
  'subflow close':  ['subflows'],
  'run finish':     ['currentStage'],
  // 未列出者（exec/validate/status/resume/list/guide/deps check）= 纯读，白名单为空集
};
```

守卫语义：`DDO_STATE_STRICT=1` 时，命令结束前对 state 做 deep-diff，越白名单的变更 → stderr 报告 + exit 1（开发/测试守卫）；缺省关闭（零运行时成本）。测试快照断言以同一张表驱动，规范与测试同源。

### 4.5 禁止事项汇总（负面清单）

- 任何命令不得写 A 区（标识）与 B 区（环境）——创建后冻结；唯一例外是创建动作本身。
- 任何命令不得从 `.usage.jsonl` 读取控制流依据（呈现有效性只看 state 标量，I-G1）。
- 任何命令不得在 state 中新增 §3.6 清单之外的顶层键。
- agent/宿主不得手工编辑 `.state.json`（SKILL.md 既有红线，纳入规范）；`--reason` 只进日志不进 state（现行 rollback 语义保持）。
- v2 写入方不得再写 `gate.interactions[]`（I-5）；读取方兼容忽略。
- validate 不得因登记职责而获得写入权（R-4，防职责蔓延）。

---

*AI 索引：I-1..I-8/I-G1/I-J1/I-E1..E3/I-S1..S4、R-1..R-6。来源手册完整索引见 issue #86（FR/S/RC/P/V 系列）。*
