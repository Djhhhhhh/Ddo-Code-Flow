# ddo-swe Specification

> 本文档是 AI 基于 `docs/requirement.md` 与流程图对项目需求的"规约化（specification）"理解。
> 它只描述 **What / Why / 验收标准**，不涉及具体技术选型与实现方案（实现方案见后续 `plan.md`）。
> 需用户确认本 spec 是否符合预期后，方可进入下一阶段（Planning）。

---

## 1. 项目概述

### 1.1 项目名称

`ddo-swe`

### 1.2 一句话定义

一个**可定制化的 AI 编程流水线（pipeline）skill**：把"AI 写代码"的过程拆成若干**有序阶段（stage）**，每个阶段由可配置的**原子任务（atom-task）**承担实际工作；通过编辑 `config.json` 即可重新编排流水线，无需改动 skill 本体。

### 1.3 设计意图

- **流程标准化**：将"需求 → 规约 → 方案 → 测试计划 → 任务拆分 → 编码 → 验收 → 复盘"固化为可复用流水线。
- **流程与能力解耦**：流水线只编排顺序，"做什么"由 atom-task 提供；atom-task 可被替换、复用、新增。
- **过程可视化与可控**：关键阶段必须由用户显式确认（human-in-the-loop），失败可回退重做。
- **可视化配置**：通过一个极简的本地前端页面查看/修改 `config.json`，并查看当前流水线执行状态。

---

## 2. 术语表（Glossary）


| 术语                         | 定义                                                                           |
| -------------------------- | ---------------------------------------------------------------------------- |
| **Pipeline（流水线）**          | 一组按顺序执行的 stage 集合，由 `config.json` 描述。                                        |
| **Stage（阶段）**              | 流水线中的一个步骤，例如 `Specification`、`Planning`。每个 stage 内部由 1 到 N 个 atom-task 串联完成。 |
| **Atom-task（原子任务）**        | 可被 stage 引用的最小执行单元，以 JSON 描述其元信息（输入、输出、提示词/指令等）。                             |
| **Run（运行实例）**              | 一次完整的流水线执行；每次 run 会在目标目录下创建一个 `yy-mm-dd-<desp>/` 工作目录用于存放该 run 的所有产物。        |
| **Confirmation gate（确认门）** | 流水线中需要用户显式确认（同意/否决）才能推进的检查点。                                                 |
| **Context（上下文）**           | 进入流水线前注入的项目背景信息（AGENTS.md / README.md / product.md / 用户自定义目录等）。              |
| **Target dir（目标目录）**       | 用户当前 AI 编程工作所在的项目目录，所有 run 产物默认落在该目录下。                                       |


---

## 3. 功能需求（Functional Requirements）

### 3.1 Pipeline 总体行为

- **FR-P1**：流水线由 `config.json` 定义，按顺序执行下列 stage（默认顺序与流程图一致）：
  1. Context
  2. Requirement
  3. Specification
  4. Planning
  5. Test-Planning
  6. Tasking
  7. Coding
  8. Verification
  9. Review
  10. Reporting
  11. Reflection
  12. Done
- **FR-P2**：每个 stage 关联 0 个或多个 atom-task，atom-task 的引用与执行顺序由 `config.json` 配置。
- **FR-P3**：流水线启动时，必须先完成一次 **init**，由 `config.json` 提供初始化方法以创建/校验基础目录与文件骨架。
- **FR-P4**：流水线必须支持**确认门**：在指定 stage 完成后等待用户输入"同意 / 否决"。
  - 同意：进入下一阶段。
  - 否决：返回当前 stage 重新生成产物（可附带用户修改意见再次执行）。
- **FR-P5**：在出现下列回退条件时，流水线必须能回到上一阶段并重做：
  - `spec.md` 未通过用户确认 → 回到 Specification。
  - `plan.md` 未通过用户确认 → 回到 Planning。
  - `test-plan.md` 未通过用户确认 → 回到 Test-Planning。
  - Verification 失败 → 回到 Coding，直到验收全部通过。
  - `reflection-report.md` 未通过用户确认 → 回到 Reflection。

### 3.2 各阶段需求

#### 3.2.1 Context

- **FR-CTX-1**：读取并汇总项目上下文，至少包含：`AGENTS.md`、`README.md`、`product.md`；以及 `config.json` 中由用户自定义的额外路径/目录。
- **FR-CTX-2**：缺失文件不阻断流水线，但需在产物中显式记录"缺失"。

#### 3.2.2 Requirement

- **FR-REQ-1**：接受两种需求输入方式（二选一）：
  - 用户预先写好的 `requirement.md` 文件；或
  - 用户直接输入的提示词描述。
- **FR-REQ-2**：若两种都提供，以 `requirement.md` 为主，提示词作为补充上下文。

#### 3.2.3 Specification

- **FR-SPEC-1**：在目标目录下创建该 run 的工作目录 `yy-mm-dd-<desp>/`（`<desp>` 由 AI 基于需求生成的简短描述，要求 kebab-case 且可读）。
- **FR-SPEC-2**：基于 `spec_template`，结合 Requirement 与 Context，在该工作目录中生成 `spec.md`。
- **FR-SPEC-3**：本阶段为**确认门**：必须等待用户确认 `spec.md`；否决则可附带反馈意见重新生成。

#### 3.2.4 Planning

- **FR-PLAN-1**：基于 `plan_template` 与已确认的 `spec.md`，生成 `plan.md`，进行**技术决策**（架构、模块划分、依赖、风险等）。
- **FR-PLAN-2**：本阶段为**确认门**：必须等待用户确认 `plan.md`；否决则重新生成。

#### 3.2.5 Test-Planning

- **FR-TP-1**：基于已确认的 `spec.md`，生成 `test-plan.md`，**以 checklist 形式**列出验收标准（每条验收点必须可被机器或人工核对为通过/失败）。
- **FR-TP-2**：本阶段为**确认门**：必须等待用户确认 `test-plan.md`；否决则重新生成。

#### 3.2.6 Tasking

- **FR-TASK-1**：基于已确认的 `plan.md` 与 `test-plan.md`，在该 run 工作目录下创建 `tasks/` 子目录。
- **FR-TASK-2**：在 `tasks/` 中生成 `task-01.md`、`task-02.md`、… 每个文件描述**一项具体可执行的开发任务**（含目标、产物、关联的验收点等）。
- **FR-TASK-3**：在 `tasks/` 目录**内部**生成 `task-group.json`，描述：
  - 任务之间的依赖/先后顺序；
  - 哪些任务可以**并行**执行。
- **FR-TASK-4**：`task-group.json` 必须能被 Coding 阶段直接消费以决定调度顺序。

#### 3.2.7 Coding

- **FR-CODE-1**：按 `task-group.json` 描述的顺序与并行度执行每个 task。
- **FR-CODE-2**：编码产物为目标项目中实际的源代码改动；过程不应隐式跳过任何任务。

#### 3.2.8 Verification

- **FR-VER-1**：以 `test-plan.md` 的 checklist 为准对编码结果进行验收。
- **FR-VER-2**：任一验收点失败，必须返回 Coding 阶段，直到全部通过。
- **FR-VER-3**：每次验收结果必须可追溯（记录通过/失败项及原因）。

#### 3.2.9 Review

- **FR-REV-1**：本阶段为**预留阶段**：当前版本可不强制执行任何 review 逻辑。
- **FR-REV-2**：必须保留扩展点：允许后续在 `config.json` 中通过配置 `sub-agent-review` 类的 atom-task 接入 review；接受 `check-list.md` 作为 review 依据。

#### 3.2.10 Reporting

- **FR-REP-1**：汇总上述各阶段的产物与结果，生成 `execution-report.md`。
- **FR-REP-2**：报告必须能回答："本次 run 做了什么、产出了哪些文件、验收是否通过"。

#### 3.2.11 Reflection

- **FR-REF-1**：检查目标项目中是否存在需要执行的"后续流程"（例如未完结的需求、遗留的 TODO 等），若存在则触发对应的后续流程。
- **FR-REF-2**：生成 `reflection-report.md`。
- **FR-REF-3**：本阶段为**确认门**：必须等待用户确认 `reflection-report.md`。

#### 3.2.12 Done

- **FR-DONE-1**：所有阶段完成且用户已确认 reflection 报告，标记 run 结束。

### 3.3 Atom-task 抽象

- **FR-AT-1**：所有 atom-task 必须存储在 `atom-tasks/` 目录下，**每个 atom-task 占用一个自己的子目录**（1 个 atom-task = 1 个子目录），形如 `atom-tasks/<atom-task-name>/`。
- **FR-AT-2**：atom-task 子目录内部至少包含：
  - 一份 **JSON 格式**的任务定义文件（描述任务元信息：名称、用途、输入/输出契约、是否启用等）；
  - 该 atom-task **附属的所有产物**（如 `spec_template.md`、`plan_template.md`、`test-plan_template.md`、`check-list.md` 等模板文件，以及该 atom-task 自有的提示词、参考片段等）。
- **FR-AT-3**：模板文件（spec_template / plan_template / test-plan_template / check-list 等）**不再放在独立的 `templates/` 顶级目录中**，它们是各自所属 atom-task 的附属物，跟随对应 atom-task 子目录一起存放与版本化。
- **FR-AT-4**：atom-task 是"抽象的、可被引用的"任务定义；流水线本身不内嵌任何业务逻辑，只通过 `config.json` 引用 atom-task。
- **FR-AT-5**：`config.json` 必须能把任意 atom-task 挂载到任意 stage（前提是该 atom-task 的输入/输出与该 stage 的契约匹配）。
- **FR-AT-6**：每个 atom-task 必须支持**启用/禁用开关**，可通过其 JSON 定义文件或 `config.json` 中的引用进行切换；禁用后该 atom-task 在流水线中不被执行，但其子目录与产物保留。
- **FR-AT-7**：新增/修改/启用/禁用 atom-task 不应需要修改 skill 本体代码——这是"流水线与原子任务解耦"的硬性约束。

### 3.4 可视化配置页面

- **FR-UI-1**：提供一个**极简前端页面**，技术栈尽量限定在**原生 HTML + CSS + JS**（不引入构建工具与重量级框架）。
- **FR-UI-2**：页面必须提供以下三项核心功能：
  1. **编辑基础配置**：查看/修改 `config.json` 中与具体流水线编排无关的基础字段（如 Context 阶段读取的自定义路径、目标目录、`<desp>` 生成规则等"全局设置"）。
  2. **编辑流水线**：查看/修改 `config.json` 中 pipeline 的 stage 顺序、每个 stage 所引用的 atom-task 及其执行顺序。
  3. **原子任务开关**：列出 `atom-tasks/` 下所有 atom-task，允许用户通过 UI 对每个 atom-task 进行**启用 / 禁用**切换；变更结果落到 `config.json`（或对应 atom-task JSON 的开关字段）中。
- **FR-UI-3**：页面的"保存"动作只修改 skill 存储目录下的 `config.json`（以及在 FR-UI-2.3 场景下可能涉及的对应 atom-task JSON 中的开关字段），不修改其它文件。
- **FR-UI-4**：页面无需账号体系、无需外部服务，应能纯本地运行。

---

## 4. 产物与目录结构（What gets created）

### 4.1 Skill 自身目录（仓库内）

```
skills/ddo-swe/
├── SKILL.md                          # skill 入口与说明
├── config.json                       # 默认流水线配置（基础配置 + pipeline 编排 + atom-task 引用与开关）
├── atom-tasks/                       # 抽象的原子任务集合（每个 atom-task = 1 个子目录）
│   ├── <atom-task-a>/
│   │   ├── <atom-task-a>.json        #   该 atom-task 的元信息（含 enabled 开关、输入/输出契约等）
│   │   └── <附属产物，如模板/提示词/check-list 等>
│   ├── <atom-task-spec>/             #   例：负责 Specification 的 atom-task
│   │   ├── spec.json
│   │   └── spec_template.md          #     spec_template 跟随其归属的 atom-task
│   ├── <atom-task-plan>/
│   │   ├── plan.json
│   │   └── plan_template.md
│   ├── <atom-task-test-plan>/
│   │   ├── test-plan.json
│   │   └── test-plan_template.md
│   ├── <atom-task-review>/
│   │   ├── review.json
│   │   └── check-list.md
│   └── ...
├── ui/                               # 可视化配置页面（原生 HTML+CSS+JS）
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── docs/                             # 本 skill 自身的需求/规约/方案文档
    ├── requirement.md
    └── spec.md
```

> 注：
>
> - 各 atom-task 子目录名、JSON 文件名、UI 目录与内部文件名均为 spec 层的**建议**；最终命名以 `plan.md` 的技术决策为准。
> - 不再有顶级的 `templates/` 目录——所有模板（spec_template / plan_template / test-plan_template / check-list 等）作为对应 atom-task 的**附属产物**，与该 atom-task 的 JSON 同处一个子目录。

### 4.2 单次 run 在目标项目中产出的目录

```
<target-dir>/
└── yy-mm-dd-<desp>/                # 本次 run 的工作目录
    ├── spec.md
    ├── plan.md
    ├── test-plan.md
    ├── tasks/                      # 任务集合
    │   ├── task-01.md
    │   ├── task-02.md
    │   ├── ...
    │   └── task-group.json         # 任务依赖与并行关系，落在 tasks/ 内部
    ├── execution-report.md
    └── reflection-report.md
```

---

## 5. 关键流程（含确认门）

```
[Context] → [Requirement] → [Specification] → (用户确认 spec.md) ┐
                                                                  │ N → 回到 Specification
                                                                  Y
                                                                  ↓
                              [Planning] → (用户确认 plan.md) ┐
                                                              │ N → 回到 Planning
                                                              Y
                                                              ↓
                         [Test-Planning] → (用户确认 test-plan.md) ┐
                                                                    │ N → 回到 Test-Planning
                                                                    Y
                                                                    ↓
       [Tasking] → [Coding] → [Verification] ─── 验收失败 ───→ 回到 Coding
                                          │
                                          └── 全部通过 ──→ [Review] → [Reporting] →
                                                                                     [Reflection] → (用户确认 reflection-report.md) → [Done]
```

---

## 6. 约束与原则

- **C-1（解耦）**：流水线编排（`config.json`）与原子任务定义（`atom-tasks/*.json`）必须严格分离；改 pipeline 不改 atom-task，反之亦然。
- **C-2（人工确认优先）**：所有"确认门"必须明确暴露给用户，不允许默默通过。
- **C-3（产物落盘）**：每个 stage 的关键产物必须以文件形式落盘，便于审阅、版本化与回溯。
- **C-4（轻量前端）**：可视化页面坚持原生 HTML+CSS+JS，不引入打包/构建依赖。
- **C-5（无云端）**：本 skill 在本地即可完整运行，不依赖外部账号或在线服务。
- **C-6（向后兼容）**：新增 stage / 新增 atom-task 不应破坏现有 `config.json` 的可读性与默认行为。

---

## 7. 验收标准（Acceptance Criteria）

> 这些是 spec 层的高层验收点，后续会在 `test-plan.md` 中被进一步拆分为可勾选的 checklist。

- **AC-1**：在一个干净的目标目录 + 一份 `requirement.md` 的前提下，完整跑通 12 个 stage，产出第 4.2 节列出的全部产物文件。
- **AC-2**：在 Specification / Planning / Test-Planning / Reflection 阶段，流水线必须**实际停下**等待用户确认，且否决能回退重做。
- **AC-3**：Verification 失败时必须能回到 Coding 重做，直到 `test-plan.md` 中的 checklist 全部通过。
- **AC-4**：把任一 stage 在 `config.json` 中切换为不同 atom-task 后，流水线行为相应改变，**且不需要修改 skill 源码**。
- **AC-5**：新增一个 atom-task 子目录 `atom-tasks/<new>/`（含其 JSON 与附属产物）并在 `config.json` 中引用，流水线能识别并执行该 atom-task。
- **AC-6**：在 UI 中将任一 atom-task 切换为"禁用"后，流水线在后续运行中跳过该 atom-task；切回"启用"后恢复执行——**全程无需修改 skill 源码**。
- **AC-7**：打开 UI 入口页面即可在本地浏览器中完成（a）编辑基础配置、（b）编辑流水线编排、（c）切换 atom-task 启用/禁用三件事，无需启动构建工具或外部服务。
- **AC-8**：`task-group.json` 位于 `tasks/` 内部，能正确表达任务依赖与并行关系，Coding 阶段按该描述调度。

---

## 8. 非功能需求（Non-Functional）

- **NFR-1（可读性）**：所有产物（spec / plan / test-plan / tasks / reports）均为 Markdown，便于在 IDE 与浏览器中直接阅读。
- **NFR-2（可追溯）**：每次 run 的所有产物集中在同一个 `yy-mm-dd-<desp>/` 目录下，方便对比与回溯。
- **NFR-3（可扩展）**：atom-task 数量、stage 内 atom-task 数量均无硬上限。
- **NFR-4（容错）**：缺失非关键上下文（如 `product.md` 不存在）不阻断流水线，但应在 `execution-report.md` 中记录。
- **NFR-5（最小依赖）**：UI 部分零运行时依赖；skill 主体的运行时依赖在 `plan.md` 中尽量收敛到最少。

---

## 9. 范围说明（In / Out of Scope）

### In Scope

- 12 阶段流水线的定义、串联与"确认门 / 失败回退"行为。
- `config.json` 驱动的流水线编排能力。
- `atom-tasks/` 抽象与可挂载机制。
- 单次 run 在目标目录下的标准化产物结构。
- 极简本地可视化页面（查看/编辑 config + 查看运行状态）。

### Out of Scope（本 spec 不承诺）

- 任何具体 atom-task 的业务实现（除接口约定外）。
- 多用户协作 / 远程同步 / 在线托管。
- 复杂前端框架、组件库、国际化、深色模式等。
- Review 阶段的具体策略（仅保留扩展点）。

---

## 10. 开放问题（Open Questions，待 Plan 阶段决策）

- **Q-1**：`config.json` 的 schema 详细字段（pipeline / stage / atom-task 引用 / 用户自定义路径）—— 留给 `plan.md`。
- **Q-2**：atom-task JSON 的字段定义（输入契约、输出契约、是否可并行、超时策略等）—— 留给 `plan.md`。
- **Q-3**：`<desp>` 的生成规则与长度上限 —— 留给 `plan.md`。
- **Q-4**：UI 与流水线状态之间的通信机制（直接读写文件 / 本地轻量 server / 其它）—— 留给 `plan.md`。
- **Q-5**：Verification 阶段判定 checklist 通过的具体方式（人工勾选 / 自动执行命令 / 两者结合）—— 留给 `plan.md`。
- **Q-6**：Review 阶段未来接入的 atom-task 形态（sub-agent / 静态检查 / 二者皆有）—— 留给后续迭代。

---

## 11. 用户确认

请确认以下任一选项：

- ✅ **同意**：本 spec 符合预期，可进入 **Planning** 阶段生成 `plan.md`。
- ❌ **修改**：请在下方/对话中列出需要调整的条款编号与意见，AI 将基于反馈重新生成本文档。

