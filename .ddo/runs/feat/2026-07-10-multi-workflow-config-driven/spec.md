# Ddo-Code-Flow Multi-Workflow Specification

> AI 基于用户原始需求与 context-summary.md 对需求的规约化理解。
> 仅描述 What / Why 与验收标准；技术方案见 plan.md。

---

## 1. 项目概述

### 1.1 项目名称
Ddo-Code-Flow Multi-Workflow

### 1.2 一句话定义
让 ddo-code-flow 支持由配置驱动的多工作流选择、预览与渐进式 atom-task 加载。

### 1.3 设计意图
- 将单一流水线改造为可配置的多工作流体系。
- 保持 atom-task 复用，不为本次三种工作模式新增 atom-task。
- 让配置成为工作流索引、选择规则和运行时配置的唯一事实来源。
- 让 skill 执行时根据配置和状态文件渐进式读取所需文件，避免一次性加载全部上下文。
- 让 UI 能切换并预览不同模式下的工作流。

---

## 2. 术语表（Glossary）

| 术语 | 定义 |
|---|---|
| workflow | 由多个 stage 和 atom-task DAG 组成的一条可执行工作流。 |
| 工作模式 | 面向不同需求类别的 workflow 组合，本次需要 3 种模式。 |
| atom-task | 已存在于 atom-tasks 下的原子任务定义，本次三种模式必须复用现有 atom-task。 |
| 配置文件 | skill 加载逻辑和 UI 读取配置时使用的唯一事实来源。 |
| 状态文件 | 单次 run 的状态文件，用于决定当前阶段和下一步需要渐进式读取的文件。 |
| 渐进式上下文读入 | 只在进入某个阶段或节点时读取该节点所需 atom-task、schema 和输入文件。 |

---

## 3. 功能需求（Functional Requirements）

### 3.1 多工作流配置

- **FR-WF-1**：系统应支持通过目录维护多个 workflow 定义。
- **FR-WF-2**：系统应内置 3 种工作模式，并且这 3 种模式必须由现有 atom-task 组合而成。
- **FR-WF-3**：系统应支持在执行 skill 时通过参数指定目标 workflow。
- **FR-WF-4**：系统应支持在未显式指定 workflow 时，根据需求内容和配置中的分类规则匹配目标 workflow。
- **FR-WF-5**：当参数指定和分类规则都不能确定 workflow 时，系统应使用配置中的默认 workflow。

### 3.2 配置职责重定义

- **FR-CONFIG-1**：配置文件应作为唯一事实来源，描述全局运行配置、workflow 索引、默认 workflow、分类规则和 atom-task override 入口。
- **FR-CONFIG-2**：配置应能索引到具体 workflow 定义，运行时不得依赖写死的单一 pipeline。
- **FR-CONFIG-3**：配置结构应支持校验，避免 workflow 引用缺失、DAG 结构错误或默认 workflow 不存在。
- **FR-CONFIG-4**：系统应保留已有配置可迁移或兼容的路径，降低现有用户升级成本。

### 3.3 skill 加载逻辑

- **FR-RUNTIME-1**：skill 启动后应先读取配置和 schema，并基于配置解析目标 workflow。
- **FR-RUNTIME-2**：skill 应根据状态文件判断当前 run 是否需要恢复，以及恢复后应从哪个 stage/node 继续。
- **FR-RUNTIME-3**：skill 应按目标 workflow 的 stage 和 DAG 渐进式加载 atom-task 定义。
- **FR-RUNTIME-4**：skill 在进入某个 atom-task 前，才读取该 atom-task 的 md、output schema 和该节点声明的输入文件。
- **FR-RUNTIME-5**：skill 的执行流程应完全由配置驱动，不应在 runtime 文本中硬编码具体业务流程。

### 3.4 UI 工作流预览与切换

- **FR-UI-1**：Studio UI 应在中间 topology 面板的 head 区域新增 workflow 切换控件。
- **FR-UI-2**：用户切换 workflow 后，UI 应预览该模式下的 stage、atom-task 节点和 DAG 连线。
- **FR-UI-3**：UI 应显示当前 workflow 的基础信息，帮助用户理解不同模式的用途。
- **FR-UI-4**：UI 的保存逻辑应保持配置与 workflow 定义一致，避免只更新预览状态而未持久化配置。

---

## 4. 产物与目录结构（What gets created）

```text
Ddo-Code-Flow
├── config.json                          (重定义：workflow 索引 + 全局配置)
├── config.schema.json                   (更新：适配新结构)
├── workflows/                           (新增：workflow 定义目录)
│   ├── <workflow-a>.json
│   ├── <workflow-b>.json
│   └── <workflow-c>.json
├── atom-tasks/
│   └── existing atom-task definitions only
└── ui/
    ├── index.html
    ├── studio.js
    └── styles.css
```

---

## 5. 关键流程

```text
user request
  -> load config.json
  -> choose workflow by explicit parameter or configured rules
  -> load/resume .state.json
  -> enter current stage
  -> load only the current atom-task definition and declared inputs
  -> execute node and persist state
  -> continue by workflow DAG
```

---

## 6. 约束与原则

- **C-1**：本次三种工作模式不得新增 atom-task。
- **C-2**：workflow 选择和流程定义必须来自配置，不应散落在 UI 或 skill runtime 的硬编码分支中。
- **C-3**：UI 预览和 skill runtime 应理解同一套配置语义。
- **C-4**：渐进式加载不得破坏现有状态文件恢复能力。
- **C-5**：对现有 run 产物目录结构的兼容性应尽量保持。

---

## 7. 验收标准（Acceptance Criteria）

- **AC-1**：仓库中存在 3 个可被配置索引的 workflow 定义。
- **AC-2**：3 个 workflow 均只引用现有 atom-task。
- **AC-3**：配置不再承担单一 pipeline 的唯一承载职责，而是能索引到具体 workflow。
- **AC-4**：skill 文档明确以配置为唯一事实来源，并描述 workflow 解析、参数覆盖、规则匹配和默认回退逻辑。
- **AC-5**：skill 文档明确根据状态文件和当前 node 渐进式读取 atom-task 文件、schema 和输入文件。
- **AC-6**：Studio UI 的 head 区域提供 workflow 切换控件。
- **AC-7**：切换 workflow 后，UI 可以预览不同模式下的 stage 和 DAG。
- **AC-8**：配置和 UI 变更通过 JSON 校验与基础静态检查。

---

## 8. 非功能需求（Non-Functional）

- **NFR-1**：配置结构应清晰可读，便于用户新增 workflow。
- **NFR-2**：改造应尽量保持向后兼容，至少提供旧 pipeline 配置的迁移或兼容说明。
- **NFR-3**：UI 交互应保持本地静态页面可用，不引入构建依赖。
- **NFR-4**：加载逻辑应减少不必要的上下文读取，避免一次性读取全部 atom-task。

---

## 9. 范围说明（In / Out of Scope）

### 9.1 In Scope
- 新增 workflows 目录及 3 种 workflow 定义。
- 重定义配置的职责和 schema。
- 更新 skill 加载逻辑说明，使其以配置驱动并渐进式读入。
- 更新 Studio UI，使其支持 workflow 切换和预览。
- 使用现有 atom-task 组合三种工作模式。

### 9.2 Out of Scope
- 新增 atom-task。
- 引入远端服务或构建系统。
- 改造业务仓库中的具体产品功能。
- 实现组织级 CI、hook 或外部 review gate。

---

## 10. 开放问题（Open Questions，待 Plan 阶段决策）

- **Q-1**：三种工作模式的具体名称、stage 组合和默认模式如何定义？——留给 plan.md。
- **Q-2**：配置文件与 workflow 定义文件的字段边界如何划分，才能同时满足唯一事实来源和可维护性？——留给 plan.md。
- **Q-3**：旧版配置中已有 pipeline 的兼容策略是迁移、运行时兼容，还是二者都支持？——留给 plan.md。
- **Q-4**：UI 切换 workflow 后的编辑行为，是编辑当前 workflow 文件还是只做预览？——留给 plan.md。
- **Q-5**：执行 skill 时附带参数的格式如何识别，并与自定义分类规则确定优先级？——留给 plan.md。

---

## 11. 用户确认

请确认以下任一选项：

- ✅ **同意**：本 spec 符合预期，可进入 **Planning** 阶段生成 `plan.md`。
- ❌ **修改**：请在下方/对话中列出需要调整的条款编号与意见，AI 将基于反馈重新生成本文档。
