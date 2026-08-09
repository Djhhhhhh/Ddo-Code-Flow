# Ddo-Code-Flow Multi-Workflow Plan

> 基于已确认的 spec.md 做技术决策：定 schema、定通信方式、定运行时模型、定关键算法、定取舍。

---

## 1. 决策原则

| # | 原则 | 落地体现 |
|---|------|----------|
| P-1 | config.json 是唯一入口事实源 | 根配置持有全局 base、workflow 索引、默认 workflow、选择规则和全局 atomTaskOverrides。 |
| P-2 | workflow 定义文件承载可替换流程 | 具体 pipeline、模式级 confirmationGates、模式级 overrides 放入 workflows/*.json。 |
| P-3 | 复用现有 atom-task | 三种模式只组合 context、requirement、git-worktree、spec、plan、test-plan、tasking、coding、verification、review、reporting、reflection 等现有任务。 |
| P-4 | 渐进式读取 | runtime 只在进入当前 stage/node 时读取对应 atom-task、output schema 和声明输入。 |
| P-5 | UI 与 runtime 共享语义 | Studio 使用同一 config/workflow 数据模型渲染和切换预览。 |

---

## 2. 整体架构

### 2.1 架构图

```text
config.json
  ├─ base runtime settings
  ├─ workflows.default
  ├─ workflows.selection rules
  ├─ workflows.items[] ───────┐
  └─ atomTaskOverrides        │
                              ▼
                       workflows/<id>.json
                              │
                              ├─ confirmationGates
                              ├─ pipeline[] stage DAG
                              └─ atomTaskOverrides
                              │
             ┌────────────────┴────────────────┐
             ▼                                 ▼
      ddo-code-flow runtime              Studio UI preview
      state-driven execution             workflow switcher
             │                                 │
             ▼                                 ▼
      .state.json + atom-task md          rendered stage/node DAG
```

### 2.2 关键事实

- FR-WF-1 / FR-WF-2：新增 workflows 目录，每个 workflow 是独立 JSON 文件。
- FR-WF-3 / FR-WF-4 / FR-WF-5：workflow 解析顺序固定为显式参数、配置规则、默认 workflow。
- FR-CONFIG-1 / FR-CONFIG-2：config.json 不再直接承载唯一 pipeline，而是承载 workflow 索引和运行时基础配置。
- FR-RUNTIME-1 到 FR-RUNTIME-5：runtime 先解析目标 workflow，再根据 .state.json 和当前 node 渐进式加载。
- FR-UI-1 到 FR-UI-4：UI 在 topology panel__head 中提供切换控件，按当前 workflow 渲染 DAG。

---

## 3. 目录与命名（最终定版）

```text
Ddo-Code-Flow/
├── config.json                         # 根索引配置，唯一事实源入口
├── config.schema.json                  # 同时定义根配置和 workflowDefinition schema
├── workflows/
│   ├── lightweight.json                # 轻量模式
│   ├── standard.json                   # 标准模式，默认
│   └── guarded.json                    # 加强模式
├── atom-tasks/                         # 不新增 atom-task，仅复用现有目录
└── ui/
    ├── index.html                      # panel__head 新增 workflow select
    ├── studio.js                       # 加载 workflows/*.json 并渲染当前 workflow
    └── styles.css                      # workflow switch 样式
```

---

## 4. 核心 Schema（必填，若适用）

### 4.1 config.json

```jsonc
{
  "$schema": "./config.schema.json",
  "version": "3.0.0",
  "base": {
    "targetDir": "..",
    "contextPaths": [],
    "contextOptional": true,
    "respGenerator": { "maxLength": 32, "case": "kebab", "stripStopwords": true },
    "metrics": { "enabled": false, "provider": "tokscale", "failurePolicy": "warn" }
  },
  "workflows": {
    "default": "standard",
    "selection": {
      "allowUserOverride": true,
      "argumentNames": ["workflow", "mode", "profile"],
      "rules": [
        { "workflow": "lightweight", "matchAny": ["docs", "文档", "调研", "小修"] },
        { "workflow": "guarded", "matchAny": ["安全", "数据迁移", "公开接口", "性能", "并发"] },
        { "workflow": "standard", "fallback": true }
      ]
    },
    "items": [
      { "id": "lightweight", "name": "Lightweight", "path": "workflows/lightweight.json" },
      { "id": "standard", "name": "Standard", "path": "workflows/standard.json" },
      { "id": "guarded", "name": "Guarded", "path": "workflows/guarded.json" }
    ]
  },
  "atomTaskOverrides": {}
}
```

### 4.2 workflowDefinition

```jsonc
{
  "$schema": "../config.schema.json#/$defs/workflowDefinition",
  "id": "standard",
  "version": "1.0.0",
  "name": "Standard",
  "description": "默认完整开发流水线。",
  "confirmationGates": ["spec", "planning", "test-plan", "reflection"],
  "pipeline": [
    {
      "stage": "context",
      "description": "读取上下文。",
      "enabled": true,
      "atomTasks": {
        "entry": ["context"],
        "nodes": {
          "context": { "next": ["requirement"], "parallelApprove": false, "parallelWith": [] }
        }
      }
    }
  ],
  "atomTaskOverrides": {
    "test-plan": { "enabled": true, "tdd": true }
  }
}
```

### 4.3 字段语义约束

- `workflows.default`：必须引用 workflows.items 中存在的 id。
- `workflows.items[].path`：必须指向 workflows/ 下的 JSON 文件。
- `workflows.selection.rules[]`：按顺序匹配，第一条命中生效；fallback 只能作为最后兜底。
- `workflowDefinition.pipeline`：沿用现有 stage + atomTasks DAG 结构。
- `workflowDefinition.confirmationGates`：覆盖该 workflow 的确认门，不再依赖根 base.confirmationGates。
- `workflowDefinition.atomTaskOverrides`：覆盖或补充根 atomTaskOverrides，运行时以 workflow 级优先。

### 4.4 校验

- 根 config schema 校验基础字段、workflow 索引结构、路径格式和 overrides 结构。
- workflowDefinition schema 校验单个 workflow 的 stage DAG 结构。
- runtime/UI 额外做跨文件校验：默认 workflow 存在、path 可读、每个 node 引用已有 atom-task、DAG 无环。
- 旧版 config 带 `pipeline` 时允许迁移为 `workflows/standard.json`，并把 config.json 改写为 v3 索引结构。

---

## 5. 关键算法 / 流程

### 5.1 Workflow 解析算法

解析顺序固定如下：先读取 config.json；如果用户触发 skill 时包含 `workflow=<id>`、`mode=<id>` 或 `profile=<id>` 形式的显式参数，且 allowUserOverride 为 true，则使用该 id；否则按 workflows.selection.rules 顺序检查 matchAny 关键词；若无命中，则使用 fallback 规则；若仍无结果，使用 workflows.default。解析出的 workflow id 必须存在于 workflows.items，否则 abort 并报告配置错误。

### 5.2 旧配置迁移算法

当 config.json 仍是 v2 结构且包含顶层 pipeline 时，runtime/UI 先把当前 config.pipeline、base.confirmationGates 和 atomTaskOverrides 写入 workflows/standard.json；再把 config.json 升级为 v3 索引结构，并设置 workflows.default 为 standard。迁移后继续做 schema 和 DAG 校验。该策略同时满足 FR-CONFIG-4 的升级成本要求和 FR-CONFIG-1 的唯一事实源要求。

### 5.3 渐进式加载算法

runtime 启动只读取 config.json、config.schema.json 和必要的目标 workflow JSON。随后读取或初始化 .state.json，依据 currentStage 和已完成节点决定下一层 DAG。进入节点前才读取 atom-tasks/<name>/<name>.md；仅当该 atom-task 声明 outputSchemaRef 时读取对应 schema；仅按 io.inputs 声明解析并读取输入文件。节点完成后立即写 .state.json，再进入下一个节点。

### 5.4 UI 预览算法

Studio loadAll 读取 config.json、config.schema.json 和 workflows.items 指向的 workflow 文件。activeWorkflowId 默认为 workflows.default。workflow select 的选项来自 workflows.items。用户切换后，renderWorkflow 使用 active workflow 的 pipeline、confirmationGates 和 atomTaskOverrides 计算有效视图；保存时分别写回 config.json 和被编辑的 workflow JSON。

---

## 6. 错误处理与回退

| 触发条件 | 行为 |
|---|---|
| 显式 workflow 参数不存在 | abort 并提示可用 workflow id。 |
| workflow path 不存在或 JSON 无法解析 | abort；UI 显示配置错误并禁用保存。 |
| workflow DAG 有环 | abort；UI 禁用保存并标出错误。 |
| workflow 引用不存在的 atom-task | abort；UI 将节点标记为 broken。 |
| 旧版 config.json 含 pipeline | 自动迁移为 v3 索引配置并提示用户。 |
| .state.json 的 workflowId 与当前解析 workflow 不一致 | 优先使用 .state.json.workflowId 恢复，避免恢复中途切换流程。 |
| 分类规则无命中 | 使用 fallback 或 workflows.default。 |

---

## 7. 风险与权衡

| # | 风险 | 描述 | 处置 |
|---|------|------|------|
| R-1 | 配置分散 | pipeline 从 config.json 移到 workflows/*.json 后跨文件校验更复杂。 | config.json 仍作为唯一入口，所有 workflow 必须被索引；schema + runtime 做跨文件校验。 |
| R-2 | 向后兼容 | 现有用户仍持有 v2 config。 | 提供自动迁移，standard 保持旧流程语义。 |
| R-3 | UI 保存复杂度上升 | UI 需要写 config.json 和 workflow JSON。 | 引入 active workflow draft，保存时分别持久化，预览状态不脱离文件。 |
| R-4 | 参数解析歧义 | 用户需求中可能出现类似 workflow 的自然语言。 | 只识别明确 `workflow=<id>` / `mode=<id>` / `profile=<id>` 格式。 |
| R-5 | guarded 模式护栏有限 | 本次不得新增 atom-task，因此 guarded 只能复用 review 阶段。 | 明确 guarded 是"加强复审模式"，不承诺外部 CI/hook gate。 |

---

## 8. 实施次序（高层路线，供 Tasking 拆分参考）

- 更新 config.schema.json，加入根索引配置和 workflowDefinition 定义。
- 新增 workflows/lightweight.json、workflows/standard.json、workflows/guarded.json，并复用现有 atom-task。
- 改写 config.json 为 v3 索引结构，保留 base、selection、items 和全局 overrides。
- 更新 SKILL.md 与 .agents/skills/EC-Code-Flow/SKILL.md 的加载逻辑说明，强调配置驱动和渐进式读取。
- 更新 Studio UI 的 index.html、studio.js、styles.css，增加 workflow 切换预览能力。
- 增加基础校验脚本或静态检查，验证 JSON 可解析、workflow 引用存在、DAG 无环。
- 运行验证并生成 execution-report.md。

---

## 9. 与 spec 的开放问题对应表

| spec Open Question | plan 中的落地 |
|---|---|
| Q-1 三种工作模式的具体名称、stage 组合和默认模式如何定义？ | 第 3 节和第 4 节：定义 lightweight、standard、guarded，standard 为默认。 |
| Q-2 config.json 与 workflows/*.json 的字段边界如何划分？ | 第 4 节：config.json 是索引与全局运行配置；workflow JSON 承载 pipeline、确认门和模式级 overrides。 |
| Q-3 旧版 config.json 中已有 pipeline 的兼容策略？ | 第 5.2 节：自动迁移为 workflows/standard.json 并升级 config.json。 |
| Q-4 UI 切换 workflow 后的编辑行为？ | 第 5.4 节：切换用于预览 active workflow；保存时写回 config.json 和对应 workflow JSON。 |
| Q-5 执行 skill 时附带参数的格式与优先级？ | 第 5.1 节：显式 `workflow=` / `mode=` / `profile=` 优先，其次规则匹配，最后默认 workflow。 |

---

## 10. 用户确认

请确认以下任一选项：

- ✅ **同意**：本 plan 符合预期，可进入 **Test-Planning** 阶段生成 `test-plan.md`。
- ❌ **修改**：请在下方/对话中列出需要调整的章节与意见，AI 将基于反馈重新生成本文档。
