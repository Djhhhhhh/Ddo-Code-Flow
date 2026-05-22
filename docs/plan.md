# ddo-swe Plan

> 本文档基于已确认的 `docs/spec.md` 做**技术决策**：定 schema、定通信方式、定运行时模型、定关键算法、定取舍。
> 不写代码，但对每个开放问题给出唯一确定答案。具体到"每个文件改什么、写什么"会在 `tasks/` 阶段拆分。
> 需用户确认本 plan 是否符合预期后，方可进入下一阶段（Test-Planning）。

---

## 1. 决策原则


| #   | 原则                                   | 落地体现                                                                                                          |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| P-1 | **指令型 runtime**，不写自研执行器              | 流水线"执行引擎"就是 AI agent（Cursor）本身。`SKILL.md` 用自然语言 + 锚点描述执行步骤，agent 按 `config.json` 顺序读 atom-task → 产出文件 → 等待确认。 |
| P-2 | **配置即真相**（config as source of truth） | 流水线行为完全由 `config.json` + `atom-tasks/<task>/*.json` 描述；改行为不改 SKILL.md 主体。                                     |
| P-3 | **文件系统即状态机**                         | 工作目录中产物文件存在与否、`<run>/.state.json` 的字段就是流水线状态；不引入数据库、不引入后台进程。                                                  |
| P-4 | **UI 零后端**                           | UI 用浏览器 `File System Access API` 直接读写本地文件；不起 server、不打包。                                                      |
| P-5 | **不重复造轮子**                           | JSON Schema 用 Draft 2020-12，前端零依赖，所有产物 Markdown/JSON。                                                         |


---

## 2. 整体架构

```
┌────────────────────────────────────────────────────────────────────────┐
│  Cursor Agent  ── reads ──▶  skills/ddo-swe/SKILL.md                   │
│        │                                │                              │
│        │ executes pipeline per          │ references                   │
│        ▼                                ▼                              │
│  ┌────────────┐         ┌────────────────────────────────┐             │
│  │ config.json│◀── ref ─│   atom-tasks/<name>/<name>.json│             │
│  └────────────┘         │   atom-tasks/<name>/*.md       │             │
│        ▲                └────────────────────────────────┘             │
│        │ read/write                                                    │
│        │                                                               │
│  ┌─────┴────────┐                                                      │
│  │   ui/        │  ◀── browser opens index.html, uses                  │
│  │  index.html  │      File System Access API to edit                  │
│  └──────────────┘      config.json and atom-task JSONs                 │
│                                                                        │
│  Per-run artifacts live in target project:                             │
│  <target>/yy-mm-dd-<desp>/                                             │
│      ├── .state.json   (pipeline state machine)                        │
│      ├── spec.md / plan.md / test-plan.md                              │
│      ├── tasks/{task-01.md ... , task-group.json}                      │
│      ├── verification.log                                              │
│      ├── execution-report.md                                           │
│      └── reflection-report.md                                          │
└────────────────────────────────────────────────────────────────────────┘
```

关键事实：

- **没有"运行时进程"**。一次 run 等价于 Cursor agent 一次会话；agent 退出后，重启会话只要读 `.state.json` 即可续跑。
- **没有"调度器"**。`task-group.json` 里的依赖与并行声明，由 agent 自己解读后顺序/分批调用 Coding atom-task。
- **没有"消息总线"**。stage 之间通信靠**文件**——下一阶段读上一阶段落盘的产物。

---

## 3. 目录与命名（最终定版）

### 3.1 Skill 自身

```
skills/ddo-swe/
├── SKILL.md
├── config.json
├── config.schema.json              # config.json 的 JSON Schema，供 UI 校验
├── atom-tasks/
│   ├── _schema/
│   │   └── atom-task.schema.json   # 所有 atom-task JSON 共用的 schema
│   ├── context/                    # 阶段 1 默认 atom-task
│   │   └── context.json
│   ├── requirement/                # 阶段 2
│   │   └── requirement.json
│   ├── spec/                       # 阶段 3
│   │   ├── spec.json
│   │   └── spec_template.md
│   ├── plan/                       # 阶段 4
│   │   ├── plan.json
│   │   └── plan_template.md
│   ├── test-plan/                  # 阶段 5
│   │   ├── test-plan.json
│   │   └── test-plan_template.md
│   ├── tasking/                    # 阶段 6
│   │   ├── tasking.json
│   │   └── task_template.md
│   ├── coding/                     # 阶段 7
│   │   └── coding.json
│   ├── verification/               # 阶段 8
│   │   ├── verification.json
│   │   └── verification_template.md
│   ├── review/                     # 阶段 9（默认空实现，留 hook）
│   │   ├── review.json
│   │   └── check-list.md
│   ├── reporting/                  # 阶段 10
│   │   ├── reporting.json
│   │   └── execution-report_template.md
│   └── reflection/                 # 阶段 11
│       ├── reflection.json
│       └── reflection-report_template.md
├── ui/
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── docs/
    ├── requirement.md
    ├── spec.md
    └── plan.md
```

### 3.2 单次 run（在用户目标项目里）

```
<target>/yy-mm-dd-<desp>/
├── .state.json
├── spec.md
├── plan.md
├── test-plan.md
├── tasks/
│   ├── task-01.md
│   ├── task-02.md
│   ├── ...
│   └── task-group.json
├── verification.log
├── execution-report.md
└── reflection-report.md
```

---

## 4. `config.json` Schema（决策 Q-1）

### 4.1 字段定义

```jsonc
{
  "$schema": "./config.schema.json",
  "version": "1.0.0",

  "base": {
    "targetDir": ".",                          // 目标项目根，相对路径以 skill 调用处为基准
    "contextPaths": [                          // FR-CTX-1：默认扫描 + 用户自定义
      "AGENTS.md",
      "README.md",
      "product.md"
    ],
    "contextOptional": true,                   // FR-CTX-2 / NFR-4：缺文件不阻断
    "respGenerator": {                         // 决策 Q-3 见 §6
      "maxLength": 32,
      "case": "kebab",
      "stripStopwords": true
    },
    "confirmationGates": [                     // FR-P4，确认门白名单
      "specification",
      "planning",
      "test-planning",
      "reflection"
    ]
  },

  "pipeline": [                                // FR-P1，按数组顺序执行
    {
      "stage": "context",
      "description": "读取项目基础上下文（AGENTS.md / README.md / product.md / 用户自定义路径），构建后续阶段所需的背景信息。",
      "atomTasks": {                           // 拓扑图形式，详见 §4.4
        "entry": ["context"],
        "nodes": {
          "context": { "next": [], "parallelApprove": false }
        }
      }
    },
    {
      "stage": "requirement",
      "description": "接收用户的需求输入（requirement.md 或直接提示词），形成本次 run 的需求来源。",
      "atomTasks": {
        "entry": ["requirement"],
        "nodes": {
          "requirement": { "next": [], "parallelApprove": false }
        }
      }
    },
    {
      "stage": "specification",
      "description": "AI 基于 Requirement 与 Context 生成 spec.md，进入用户确认门；否决则带反馈意见重生成。",
      "atomTasks": {
        "entry": ["spec"],
        "nodes": {
          "spec": { "next": [], "parallelApprove": false }
        }
      }
    },
    {
      "stage": "planning",
      "description": "基于已确认的 spec.md 做技术决策，生成 plan.md，进入用户确认门。",
      "atomTasks": {
        "entry": ["plan"],
        "nodes": {
          "plan": { "next": [], "parallelApprove": false }
        }
      }
    },
    {
      "stage": "test-planning",
      "description": "基于已确认的 spec.md 生成 test-plan.md（checklist 形式定义验收标准），进入用户确认门。",
      "atomTasks": {
        "entry": ["test-plan"],
        "nodes": {
          "test-plan": { "next": [], "parallelApprove": false }
        }
      }
    },
    {
      "stage": "tasking",
      "description": "基于 plan.md 与 test-plan.md 拆分出 task-01.md … 并生成 tasks/task-group.json 描述依赖与并行关系。",
      "atomTasks": {
        "entry": ["tasking"],
        "nodes": {
          "tasking": { "next": [], "parallelApprove": false }
        }
      }
    },
    {
      "stage": "coding",
      "description": "按 task-group.json 的拓扑顺序执行每个 task，产出真实代码改动。",
      "atomTasks": {
        "entry": ["coding"],
        "nodes": {
          "coding": { "next": [], "parallelApprove": false }
        }
      }
    },
    {
      "stage": "verification",
      "description": "依据 test-plan.md 的 checklist 验收编码结果；任一条目失败则回到 Coding 重做，直到全部通过。",
      "atomTasks": {
        "entry": ["verification"],
        "nodes": {
          "verification": { "next": [], "parallelApprove": false }
        }
      }
    },
    {
      "stage": "review",
      "description": "预留扩展点：后续可挂载 sub-agent-review 类 atom-task 做代码/文档复审。默认无 atom-task。",
      "atomTasks": { "entry": [], "nodes": {} }
    },
    {
      "stage": "reporting",
      "description": "汇总上述各阶段产物与结果，生成 execution-report.md。",
      "atomTasks": {
        "entry": ["reporting"],
        "nodes": {
          "reporting": { "next": [], "parallelApprove": false }
        }
      }
    },
    {
      "stage": "reflection",
      "description": "检查项目是否存在未完结的后续流程，生成 reflection-report.md，进入用户确认门。",
      "atomTasks": {
        "entry": ["reflection"],
        "nodes": {
          "reflection": { "next": [], "parallelApprove": false }
        }
      }
    },
    {
      "stage": "done",
      "description": "标记本次 run 结束。",
      "atomTasks": { "entry": [], "nodes": {} }
    }
  ],

  "atomTaskOverrides": {                       // FR-AT-6：UI 写入的开关覆盖
    "review": { "enabled": false }             // key = atom-task 目录名
  }
}
```

### 4.2 字段语义约束

- **`version`**：semver，UI 与 agent 在加载时做主版本检查，主版本不匹配则拒绝执行并提示升级。
- **`base.targetDir`**：`"."` 表示流水线产物落在 agent 当前工作目录下；用户也可写绝对路径。
- **`base.contextPaths`**：相对 `targetDir` 解析；元素可为文件或目录；目录会被递归读取（仅 `.md` / `.txt`，深度上限 3）。
- **`base.contextOptional=true`** 时，缺失项记入 `execution-report.md` 的"Context missing"段；`false` 时缺失即阻断并报错。
- **`pipeline[].stage`**：必须从 §3.2 的 12 个枚举中取值；顺序可调，但**确认门所属 stage 必须出现在数组中**，否则 UI/Agent 报错。
- **`pipeline[].description`**：人类可读的一句话说明，用于 UI 卡片副标题与执行报告。**必填**且非空。
- **`pipeline[].atomTasks`**：拓扑图对象，详见 §4.4。`atomTasks.entry` 为该 stage 的起始 atom-task 列表；`atomTasks.nodes[name].next` 指向下一批 atom-task。
- **`atomTaskOverrides[name].enabled=false`**：流水线遇到该 atom-task 时**跳过**（但其归属 stage 不跳过，跳过的是该 task 在该 stage 内的执行）。

### 4.3 校验

- 提供 `config.schema.json`（JSON Schema Draft 2020-12）。
- UI 端使用 [Ajv 标准 schema 概念] 的最小子集自实现（避免引入 Ajv 包，保持零依赖）：只校验类型、枚举、必填、引用存在性（atom-task 目录是否真存在）、**拓扑图无环**（详见 §4.4）。
- Agent 端在 Context 阶段第一步做同样校验，失败立即终止。

### 4.4 Stage 内 atom-task 拓扑图（决策点 D-1）

**动机**：原本 `atomTasks` 是数组，只能表达"串行"。但未来同一 stage 内可能：
- 并行跑多个 atom-task（例如同一阶段并行做多种风格的 review）。
- 多个并行 atom-task 的结果**一起进入同一个确认门**（用户一次性审批多个产物）。

故升级为**有向无环图（DAG）**结构：

```jsonc
"atomTasks": {
  "entry": ["task-a", "task-b"],               // 起始节点（并行执行）
  "nodes": {
    "task-a": { "next": ["task-c"], "parallelApprove": false },
    "task-b": { "next": ["task-c"], "parallelApprove": false },
    "task-c": { "next": [],         "parallelApprove": true  }
  }
}
```

字段语义：

| 字段 | 含义 |
|------|------|
| `entry` | 该 stage 入口节点列表（≥1 个时即并行启动）。空数组表示该 stage 本身无 atom-task（如 `review` 默认值、`done`）。 |
| `nodes` | 字典；key 必须等于 `atom-tasks/` 下某个目录名；value 见下三项。 |
| `nodes[name].next` | 字符串数组，列出当前节点完成后**立即可触发**的下游节点。空数组表示终端节点。 |
| `nodes[name].parallelApprove` | 布尔。若为 `true`，表示该节点的产物**与同一批次内（同一拓扑层）所有 `parallelApprove=true` 的节点**一同进入"合并确认门"——用户对这一批产物**整体同意/否决**而非逐个。 |

执行规则（agent 侧）：
1. 拓扑排序 `entry → ... → 终端`，按层（layer）批次化执行。
2. 同层中 `parallelApprove=false` 的节点跑完即结算；`parallelApprove=true` 的节点跑完后**统一弹出一次确认门**。
3. 整张 DAG 无环（schema 阶段静态校验）。
4. 任一节点的 `enabled=false`（来自 atom-task JSON 或 `atomTaskOverrides`）：从图中**移除该节点**，其 `next` 指向的下游节点的依赖也对应移除；若移除后下游成为孤儿，agent 直接跳过；若 `entry` 中所有节点都被禁用，该 stage 等同空 stage。

向后兼容（UI/Agent 加载时自动迁移）：

- 若 `atomTasks` 是字符串数组（旧格式），自动转成线性 DAG：第一个为 `entry`，后续每个的 `next` 指向下一个。
- 转换后立刻按新结构落盘（UI 显式提示用户"已自动升级 schema"）。

---

## 5. Atom-task Schema（决策 Q-2）

### 5.1 通用 schema（`atom-tasks/_schema/atom-task.schema.json` 形态）

```jsonc
{
  "name": "spec",                              // 唯一 ID，等于其目录名
  "version": "1.0.0",
  "stage": "specification",                    // 该 atom-task 设计服务的 stage（语义提示，非硬约束）
  "description": "读取 requirement.md 与 Context 汇总，套用 spec_template.md 生成 spec.md。",  // 必填，UI 节点的副标题与执行报告中均会显示
  "enabled": true,                             // FR-AT-6 开关默认值；可被 config.atomTaskOverrides 覆盖

  "io": {                                      // 输入/输出契约
    "inputs": [                                // 文件路径相对 run 工作目录或 skill 目录
      { "ref": "skill://atom-tasks/spec/spec_template.md", "required": true },
      { "ref": "run://../requirement.md",                  "required": false },
      { "ref": "run://../<context-summary>",               "required": true }
    ],
    "outputs": [
      { "ref": "run://spec.md", "kind": "markdown" }
    ]
  },

  "prompt": {                                  // agent 读取后注入对话
    "instruction": "Read {inputs[*]} and produce {outputs[0]} using the template. Follow these rules: …",
    "templateRef": "skill://atom-tasks/spec/spec_template.md",
    "guardrails": [
      "Do not include implementation details.",
      "Number every functional requirement."
    ]
  },

  "confirmation": {                            // 确认门策略
    "required": true,                          // = stage 在 base.confirmationGates 中
    "rejectAction": "regenerate-with-feedback" // 否决后行为：重生成时把用户反馈拼到 prompt 末尾
  },

  "concurrency": {                             // 默认串行；预留给 Coding 阶段
    "parallelizable": false
  },

  "timeoutSec": 0                              // 0 表示无超时（指令型 runtime，由用户/agent 控制）
}
```

### 5.2 URI 协议（关键设计）

- **`skill://`** 前缀 → 解析为 `skills/ddo-swe/` 内的路径，跨 run 共享，**只读**。
- **`run://`** 前缀 → 解析为当前 run 的工作目录 `<target>/yy-mm-dd-<desp>/` 内的路径，**可读可写**。
- **`run://../`** 表示工作目录的父级（即 `targetDir` 本身），用于读 `requirement.md` 等用户输入。

这个二元协议的好处：atom-task JSON 可以在不知道具体 run 目录名的前提下描述其 IO，agent 在执行时再做路径解析。

### 5.3 Coding atom-task 的特化（决策依据 task-group.json）

`atom-tasks/coding/coding.json` 中的 `concurrency.parallelizable=true`；但**真实并行度**由本次 run 的 `tasks/task-group.json` 决定。Coding atom-task 会被**多次调用**，每次喂入一个 task 文件，agent 根据 `task-group.json` 的依赖图自己批次化：

```jsonc
// tasks/task-group.json schema
{
  "version": "1.0.0",
  "tasks": [
    { "id": "task-01", "file": "task-01.md", "dependsOn": [] },
    { "id": "task-02", "file": "task-02.md", "dependsOn": [] },
    { "id": "task-03", "file": "task-03.md", "dependsOn": ["task-01", "task-02"] }
  ],
  "parallelGroups": [                          // 可选：显式声明可并行批次
    ["task-01", "task-02"],
    ["task-03"]
  ]
}
```

- 若 `parallelGroups` 缺省，agent 用 `dependsOn` 做拓扑排序、同层视为可并行。
- 若 `parallelGroups` 存在，**以其为准**，`dependsOn` 仅做正确性校验。

---

## 6. `<desp>` 生成规则（决策 Q-3）

由 Specification atom-task 的 prompt 强制：

1. 从已读取的 `requirement.md` / 用户提示词中抽 **1–3 个名词短语**，能"读 30 字内说清是什么需求"。
2. 转 **kebab-case**：小写、空格转 `-`、剔除连续 `-`、剥离首尾 `-`。
3. 剔除停用词：`a, an, the, of, for, with, to, and, or` 与对应中文："的、和、与、给"。
4. 长度截断到 **≤ 32 字符**；若超出，从右侧按 `-` 边界截。
5. 失败兜底：用 `unnamed`。

最终目录名格式：`YYYY-MM-DD-<desp>`（4 位年）。例：`2026-05-23-pipeline-init`。

> 决策点：用 **4 位年** 而非 spec 草稿里的 `yy`，避免世纪歧义；同时 ISO-8601 排序更友好。spec 中的 `yy-mm-dd-<desp>` 视作示意，本 plan 正式定为 `YYYY-MM-DD-<desp>`。

---

## 7. 工作目录状态机（`.state.json`）

```jsonc
{
  "runId": "2026-05-23-pipeline-init",
  "createdAt": "2026-05-23T01:20:00+08:00",
  "currentStage": "planning",
  "stages": {
    "context":       { "status": "done",    "startedAt": "...", "endedAt": "...", "outputs": [] },
    "requirement":   { "status": "done",    "startedAt": "...", "endedAt": "...", "outputs": ["../requirement.md"] },
    "specification": { "status": "done",    "confirmation": "approved", "outputs": ["spec.md"] },
    "planning":      { "status": "running" }
  },
  "history": [                                 // 否决/回退的审计轨
    { "stage": "specification", "action": "rejected", "feedback": "…", "at": "..." },
    { "stage": "specification", "action": "regenerated", "at": "..." },
    { "stage": "specification", "action": "approved", "at": "..." }
  ]
}
```

- `status ∈ {pending, running, done, failed, skipped}`
- `confirmation ∈ {n/a, pending, approved, rejected}`
- 文件由 agent 在每次 stage 边界**自己更新并落盘**（指令型 runtime 的代价：要求 SKILL.md 把"更新 .state.json"明确写在每一步收尾）。
- 用户中断会话后续跑：agent 第一步读 `.state.json` → 跳到 `currentStage` 续做。

---

## 8. 确认门与回退（决策 Q-5 与 §spec FR-P4/P5）

### 8.1 通用确认流程

每个确认门 stage 收尾时，agent 必须：

1. 写出该阶段产物（如 `spec.md`）。
2. 写 `.state.json`，把 `confirmation` 置为 `pending`。
3. **显式向用户输出**："请确认 spec.md。回复 *同意* / *修改：<意见>*"。
4. 收到回复后：
  - **同意** → `confirmation=approved`，进入下一 stage。
  - **修改** → 记录 `feedback`，把用户意见拼到 atom-task 的 prompt 末尾，回到该 atom-task 重跑（覆盖原产物，旧版本进 history）。

### 8.2 Verification 判定（决策 Q-5）

采用**两段式判定**，由 `verification` atom-task 自己驱动：

1. **机器可判定项**：`test-plan.md` 中以 `- [ ] cmd: <shell>` 形式书写的条目，agent 执行该 shell（在用户目标项目里）并比对 exit code = 0；输出/错误写入 `verification.log`。
2. **人工判定项**：以 `- [ ] human: <描述>` 形式书写的条目，agent 不执行，直接列给用户在终端勾选。
3. 任意一项未通过 → 状态 `failed`，回到 Coding 阶段（agent 自己选取相关 task 重做或新增 task）。
4. 全部通过 → `verification.log` 末尾打 "ALL PASSED"，进入 Review。

> 这把 Q-5 的取舍定为"两者结合"：machine + human 共存，由 test-plan 的语法标记决定。

---

## 9. UI 设计（决策 Q-4）

> **视觉参考**：`docs/pipeline.png`（流水线节点图样式）。
> **设计语言**：严格沿用 `DESIGN.md`（项目内的 Ollama-style design system）所定义的色板、字体、形状、间距与组件。本 UI 不引入新视觉 token。

### 9.1 通信机制

**采用 [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)**（Chromium 系浏览器原生支持）。用户首次打开 UI 时通过文件选择器授权 `skills/ddo-swe/` 目录，之后 UI 在此目录下读写 `config.json` 与扫描 `atom-tasks/*/`。

- **不起 server**，符合 C-4/C-5。
- **不依赖打包**，纯静态资源。
- 浏览器兼容性差时（如 Firefox/Safari）退化为"下载 / 上传 `config.json`"流程，UI 给出明确提示。

> 决策点：放弃"本地轻量 server"方案，避免 Node/Python 等运行时依赖；牺牲一点跨浏览器兼容换零依赖。

### 9.2 设计语言映射（直接引用 DESIGN.md tokens）

| 元素 | token |
|------|-------|
| 页面背景 | `{colors.canvas}`（#ffffff），全页一张纸 |
| 主要文字 | `{colors.ink}`（#000000）标题；`{colors.body}`（#737373）说明文字 |
| 顶栏标题字 | `{typography.display-lg}`（30px / 500，SF Pro Rounded） |
| 节点标题字 | `{typography.heading-md}`（20px / 500） |
| 节点副标题（description） | `{typography.body-sm}`（14px / 400）in `{colors.body}` |
| 主按钮 | `{component.button-primary}`（黑色 pill，`{rounded.full}`） |
| 次按钮 | `{component.button-secondary}`（白底黑字带 hairline 边框，`{rounded.full}`） |
| Tab 切换条 | `{component.search-pill}` 同款形状（`{rounded.full}` + `{colors.surface-soft}` 底） |
| 节点卡片 | `{rounded.lg}`（12px）+ 1px `{colors.hairline}` border，无阴影 |
| Stage 泳道 | dotted border 1px `{colors.hairline-strong}`，圆角 `{rounded.lg}` |
| 确认门 / 关键警示节点 | `{component.pricing-card-dark}` 同款反色（`{colors.surface-dark}` 背景 + `{colors.on-dark}` 文字）——**每张图最多 1 个高亮态**，仅用于标示当前确认门 |
| 启用/禁用开关 | "启用"= `{component.button-primary}` 状态；"禁用"= `{component.button-disabled}` 状态；均为 `{rounded.full}` pill |
| 段落间距 | `{spacing.section}`（88px）；卡片内 padding `{spacing.xl}`（24px） |

> 同时遵循 DESIGN.md 的 Do's & Don'ts：**无渐变 / 无阴影 / 无品牌色 / 不引入中间圆角 / 不引入 hover 状态文档**。

### 9.3 页面结构（单页三 Tab）

顶栏 + Tab pill 组，对照 `pipeline.png` 的视觉密度与留白：

```
┌─────────────────────────────────────────────────────────────────────┐
│  ddo-swe                                  [Open folder] [Reload] [Save]│  ← display-lg 标题 + button-primary
├─────────────────────────────────────────────────────────────────────┤
│      ( Base )  ( Pipeline )  ( Atom-tasks )                          │  ← Tab pill 组
│                                                                      │
│  ……tab content……                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### 9.3.1 Base Tab — 编辑基础配置

简洁表单，pill 形输入控件：

- `targetDir` —— `{component.text-input}`
- `contextPaths` —— 每条一行 pill chip，右端 `×` 删除；底部一个 `+ Add path` `{component.button-secondary}`
- `contextOptional` —— 一对互斥 `{component.button-secondary}`（"Optional" / "Strict"），选中态切到 `{component.button-primary}`
- `respGenerator.maxLength` / `case` —— pill 形 number input 与 select

#### 9.3.2 Pipeline Tab — 流水线可视化编排（参考 `docs/pipeline.png`）

**核心交互：节点 - 边 - 泳道**（原生 SVG + 绝对定位 DOM 实现，无第三方库）：

```
┌─[Context]──────────────┐  ┌─[Specification]───────────────┐  ┌─[Planning]─…
│  desc: 读取项目基础上下文 │  │  desc: 生成 spec.md 并进入确认门 │  │
│                        │  │                               │  │
│   ┌──────────┐         │  │   ┌──────────┐                │  │
│   │ context  │─────────┼──┼──▶│   spec   │── 用户确认 ──Y─▶│──┼──▶ …
│   │ desc:…   │         │  │   │ desc:…   │       │         │  │
│   └──────────┘         │  │   └──────────┘       N         │  │
│                        │  │       ▲              │         │  │
│                        │  │       └──────────────┘         │  │
└────────────────────────┘  └───────────────────────────────┘  └─…
```

- 每个 **stage** 是一个 dotted-border 泳道（`{colors.hairline-strong}`），左上角显示 stage 名（`{typography.heading-md}`）和其 `description`（`{typography.body-sm}` in `{colors.body}`，从 `config.json` 的 `pipeline[].description` 读取）。
- 每个 **atom-task** 是泳道内一个 `{rounded.lg}` 12px 圆角卡片，含：节点名（`{typography.heading-sm}`）+ description（`{typography.body-sm}` in `{colors.body}`，从 atom-task JSON 的 `description` 读取）。
- 节点之间用 SVG `<path>` 黑色 1px 直线 + 末端三角箭头表达 `nodes[name].next`。
- Stage 之间也用同样的箭头连接；遇确认门 stage 时，stage 边框采用反色 `{colors.surface-dark}` 提示。
- 拖拽交互：
  - **拖动 stage 顺序** → 重排 `config.pipeline` 数组。
  - **从右侧抽屉拖 atom-task 节点进入泳道** → 加入到该 stage 的 `atomTasks.nodes`（新节点默认 `next: []`，并追加到 `entry` 末尾）。
  - **在两个节点上依次点击"连线"按钮** → 添加边到上游节点的 `next`。
  - **节点上的 × 图标** → 从 `nodes` 与所有 `next` 列表中移除该节点。
- 顶部一行"**合并审批**"复选框：选中后将所选节点的 `parallelApprove` 字段统一置 `true`，用于"并发执行需要一起审批"的场景。
- 拓扑变更后实时校验是否成环；成环则 Save 按钮变 `{component.button-disabled}`，并在环路边线上以红色 1px 高亮（红色仅用于错误态，不作为常规色板的一部分）。

#### 9.3.3 Atom-tasks Tab — 扫描 + 开关 + 加入流程

```
┌─────────────────────────────────────────────────────────────────────┐
│  Atom-tasks                                  [ Scan atom-tasks/ ]    │  ← button-secondary
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ name: spec                            ( ENABLED )  │  ← pill 开关
│  │ (atom card)  │ description: 读取 requirement.md…                  │
│  │              │ stage: specification    in pipeline: ✓             │
│  └──────────────┘                                                    │
│                                                                      │
│  ┌──────────────┐ name: review-checklist                ( DISABLED ) │
│  │              │ description: 跑 check-list.md 做 sub-agent 复审     │
│  │              │ stage: review           in pipeline: ✗             │
│  │              │                  [ Add to "review" stage ▼ ]       │  ← 未在流水线时显示
│  └──────────────┘                                                    │
│  ...                                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

行为定义：
- **Scan atom-tasks/** 按钮（也在进入此 Tab 时自动触发一次）：遍历 `skills/ddo-swe/atom-tasks/*/`，读取每个子目录下的 `*.json`，展示全部 atom-task 卡片（name / description / stage）。
- **in pipeline 检测**：检查该 atom-task 名是否出现在 `config.pipeline[*].atomTasks.nodes` 任一处。
  - **`✓ in pipeline`** → 显示其所在 stage 与节点位置；点击可跳转 Pipeline Tab 并高亮该节点。
  - **`✗ not in pipeline`**（未使用）→ 显示 **"Add to <stage> stage"** 下拉按钮，下拉默认选中该 atom-task JSON 中的 `stage` 字段值，用户确认后：
    1. 把该 name 加入 `config.pipeline[stage=<选择项>].atomTasks.nodes`，初始 `next: []`；
    2. 同时追加到该 stage 的 `entry` 末尾（后续可在 Pipeline Tab 内改连线）；
    3. UI 切到 Pipeline Tab 并高亮新加入节点。
- **ENABLED / DISABLED 开关**：写 `config.atomTaskOverrides[name].enabled`。**不**直接修改 atom-task 自身的 JSON 文件。

#### 9.3.4 顶栏与全局动作

- **Open folder**：触发 File System Access API 目录选择；授权后顶栏右侧以 `{typography.body-sm}` `{colors.body}` 显示当前目录的相对名。
- **Save**：把当前编辑态序列化写回 `config.json`；保存前执行 §4.3 校验 + §4.4 的 DAG 无环校验，失败时按钮变 `{component.button-disabled}`，错误项以红色 1px 边框高亮。
- **Reload**：丢弃未保存修改，从磁盘重读 `config.json`。

### 9.4 保存语义

- **三个 Tab 的所有写动作**最终都落到同一个文件：`skills/ddo-swe/config.json`。
- atom-task 自身的 JSON（`atom-tasks/<name>/<name>.json`）**UI 不修改**。开关一律走 `atomTaskOverrides`（覆盖层），保持 atom-task 自身的"默认行为"不变。
- 保存前执行 §4.3 校验 + §4.4 的"DAG 无环"校验，全部通过才允许写盘。

### 9.5 UI 不做的事（明确边界）

- 不显示流水线执行状态（spec §3.4 已移除该需求）。
- 不编辑 atom-task 的 prompt / template 内容（手工编辑 atom-task 子目录即可）。
- 不展示 run 历史。
- 不引入流程图编辑库（react-flow / drawflow 等）——视觉与拖拽均用原生 SVG + DOM 自实现，符合 C-4。

---

## 10. Review 阶段的扩展点（Q-6）

当前版本：`config.json` 的 `review` stage 的 `atomTasks` 默认为空数组——即 noop。

未来要接入 review 时：

1. 新建 `atom-tasks/<my-review>/` 子目录。
2. JSON 的 `prompt.instruction` 描述"以 sub-agent 形式跑 check-list"。
3. `io.inputs` 引用 `skill://atom-tasks/review/check-list.md` 或自定义 checklist。
4. `io.outputs` 产出 `run://review-report.md`。
5. 在 `config.json` 的 `pipeline[stage=review].atomTasks` 拓扑中把该 name 加入 `entry` 与 `nodes`（也可通过 Atom-tasks Tab 的 "Add to review stage" 一键完成）。

无需改 SKILL.md，无需改其它 atom-task。这是 P-2 的直接红利。

---

## 11. SKILL.md 的写法约定

虽然 SKILL.md 内容在 `tasks/` 阶段才会被具体撰写，但 plan 层先冻结其**结构骨架**：

```
---
name: ddo-swe
description: |
  Customizable AI coding pipeline skill. Use when the user wants to drive
  a multi-stage spec→plan→test→code→verify workflow on a target project.
metadata: ...
---

# ddo-swe

## When to use
…

## Inputs
- requirement.md OR user prompt
- skills/ddo-swe/config.json

## Execution (read top-to-bottom each session)
1. Load and validate config.json (against config.schema.json + DAG no-cycle check).
2. Read .state.json from <target>/<run-dir>/ if present; else go to step 3.
3. For each stage in config.pipeline (skipping done ones):
   a. Resolve stage.atomTasks as a DAG (entry → nodes[*].next).
      Drop any node whose effective enabled == false (after overrides).
   b. Execute the DAG in topological batches:
      i.   For each batch (set of nodes whose deps are all done):
           - For each node in the batch in parallel (or pseudo-parallel via
             batched outputs): load atom-tasks/<name>/<name>.json,
             resolve skill:// and run:// URIs, run the prompt, write outputs,
             update .state.json.
      ii.  After the batch finishes, if any of its nodes has
           parallelApprove == true, group ALL such nodes' outputs into a
           single confirmation request and ask the user once.
      iii. If the user rejects, re-run the rejected subset with feedback.
   c. If the stage itself is in config.base.confirmationGates (and no
      parallelApprove already handled it), ask the user to confirm
      the stage's terminal outputs.
4. On any rejection: re-run the relevant atom-task(s) with feedback appended.
5. On Verification failure: jump back to Coding.
6. Emit execution-report.md and reflection-report.md as specified.
```

关键点：**SKILL.md 描述"如何读 config 并执行"，不描述任何具体业务**。

---

## 12. 风险与权衡


| 风险  | 描述                                               | 处置                                                                                        |
| --- | ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| R-1 | File System Access API 仅在 Chromium 系全量可用         | UI 在不支持时给出"下载/上传 config.json"的兜底交互，文字明确说明                                                 |
| R-2 | 指令型 runtime 依赖 agent 严格按 SKILL.md 执行             | SKILL.md 写成机械化步骤列表 + 强制写 `.state.json`；测试时通过观察 `.state.json` 的迁移轨迹来核对一致性                  |
| R-3 | `task-group.json` 的"并行"在指令型 runtime 下其实是分批，不是真并发 | 文档明确表述为"批次（batches）"而非"线程"，避免误解；并行收益主要来自 agent 同次响应内一次输出多文件                               |
| R-4 | Verification 阶段执行 shell 存在风险                     | `cmd:` 标记仅允许运行在用户目标项目目录内；agent 不主动 `sudo`、不动外部资源；这点写进 verification atom-task 的 guardrails |
| R-5 | `<desp>` 偶发碰撞                                    | 若目标目录下已存在同名 `YYYY-MM-DD-<desp>/`，追加 `-2`、`-3` 序号；记录到 `.state.json.runId`                  |
| R-6 | 原生 SVG 自实现拓扑图编辑器复杂度高、易出 bug                     | 限定交互到 4 类（拖 stage / 拖 atom 入泳道 / 点击连线 / × 删除）；连线只允许从源节点拉到目标节点的"连线锚点"；每次编辑后调用一遍 schema+DAG 校验，校验通过才更新 in-memory 状态。视觉细节坚守 DESIGN.md 已有 token，不引入新组件。 |
| R-7 | Atom-tasks Tab 扫描结果与 `config.json` 不一致时的展示       | 仅以 `config.json` 为单一真相源；扫描结果只用于"有哪些可用"，"是否启用"始终读 `atomTaskOverrides`。展示时明确标注 `in pipeline ✓/✗` 与 `enabled ●/○` 两个独立维度。 |


---

## 13. 实施次序（高层路线，供 Tasking 拆分参考）

> 此处不是 task 列表本体，仅提供**实施次序与依赖**视角，便于下个阶段拆分。

1. **基础骨架**
  - 写 `config.schema.json` 与 `atom-tasks/_schema/atom-task.schema.json`
  - 写 `config.json` 默认值
  - 写 SKILL.md 执行循环骨架
2. **atom-tasks 默认实现（每个一个子目录）**
  - context / requirement / spec / plan / test-plan / tasking / coding / verification / reporting / reflection
  - review 为 noop 占位
3. **UI**（视觉直接对齐 `DESIGN.md`；交互参考 `docs/pipeline.png`）
  - `index.html` 顶栏 + Tab pill 组框架
  - File System Access API 接入 + 兼容性兜底
  - Schema 校验器（轻量自实现，含 DAG 无环检查）
  - Base Tab（pill 表单）
  - Pipeline Tab（SVG 节点图 + 拖拽 + 连线 + 合并审批 toggle）
  - Atom-tasks Tab（扫描 / 开关 / "Add to stage" 一键加入）
4. **端到端冒烟**
  - 用一个最小 requirement.md 完整跑 12 阶段
  - 故意触发一次否决、一次 verification 失败、一次会话中断恢复

模块 1 是模块 2/3 的硬依赖；模块 2 和模块 3 之间无依赖、可并行。

---

## 14. 与 spec 的开放问题对应表


| spec Open Question        | plan 中的落地                               |
| ------------------------- | --------------------------------------- |
| Q-1 `config.json` schema  | §4 完整定义（含 §4.4 stage 内 atom-task DAG 拓扑） |
| Q-2 atom-task JSON schema | §5 完整定义（含 `description` 必填字段与 URI 协议）   |
| Q-3 `<desp>` 生成规则         | §6                                      |
| Q-4 UI ↔ 流水线通信            | §9.1：File System Access API，无后端         |
| Q-5 Verification 判定方式     | §8.2：machine `cmd:` + human `human:` 双轨 |
| Q-6 Review 未来形态           | §10：sub-agent atom-task，noop 默认         |


---

## 15. 用户确认

请确认以下任一选项：

- ✅ **同意**：本 plan 符合预期，可进入 **Test-Planning** 阶段生成 `test-plan.md`。
- ❌ **修改**：请在下方/对话中列出需要调整的章节与意见（章节号 §x.y / 决策点编号），AI 将基于反馈重新生成本文档。

