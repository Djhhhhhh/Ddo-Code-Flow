# Ddo-Code-Flow SKILL.md 机制完善 Specification

> AI 基于用户原始需求与 context-summary.md 对需求的规约化理解。
> 仅描述 What / Why 与验收标准；技术方案见 plan.md。

---

## 1. 项目概述

### 1.1 项目名称
Ddo-Code-Flow SKILL.md 机制完善

### 1.2 一句话定义
修复 SKILL.md 中实际存在的结构性问题：步骤编号重复、状态机字段缺失、验证范围过广、恢复逻辑分散，并增强 history 事件日志的完整性。

### 1.3 设计意图
- 修复文档结构错误（两个 Step 3），确保步骤编号连续唯一
- 补全 .state.json 初始化模板中缺失的 `workflowId` 字段，解决状态机写入时序问题
- 将 Step 1 的"验证所有 workflow"改为"按需验证目标 workflow"，减少启动时的冗余加载
- 整合分散的恢复逻辑，降低 agent 执行时的状态遗漏风险
- 完善 history 事件日志：定义事件类型集合、增加 `note`/`feedback`/`target` 字段、记录确认门迭代与用户反馈

---

## 2. 术语表（Glossary）

| 术语 | 定义 |
|---|---|
| workflowId | 工作流唯一标识符，记录在 .state.json 中，用于标识本次 run 使用的工作流定义 |
| 渐进式上下文加载 | 仅在进入某个 node 时才加载对应的 atom-task 定义、outputSchema 和依赖，不在启动时预读取所有文件 |
| 状态机防呆 | 通过显式固化关键字段和强制校验，防止状态机在恢复时因外部变化而产生不一致 |
| selection.rules | config.json 中定义的工作流选择规则，通过关键词匹配决定使用哪个工作流 |

---

## 3. 功能需求（Functional Requirements）

### 3.1 修复步骤编号重复

- **FR-DUP-1**：将当前两个 "Step 3" 合并或重编号，确保全文步骤编号连续唯一（Step 1 → Step 2 → Step 3 → Step 4 → Step 5，无重复）
- **FR-DUP-2**：路径解析规则表只在"执行流水线"步骤中出现一次，不在"初始化状态"步骤中重复

### 3.2 补全 workflowId 到 .state.json 初始化模板

- **FR-STATE-1**：在 .state.json 初始化模板（当前 Step 3 "Resolve target directory" 中的模板）中新增 `workflowId` 字段
- **FR-STATE-2**：`workflowId` 的值来源明确为 Step 2 解析结果，模板中用占位符标注
- **FR-STATE-3**：消除 Step 2.8 "Record workflowId in .state.json" 与 Step 3 模板之间的时序矛盾——模板创建时就包含 `workflowId`，无需后续补写

### 3.3 Step 1 按需验证目标 workflow

- **FR-VALID-1**：Step 1 不再遍历验证 `workflows.items[]` 中的所有 workflow JSON，改为仅验证 config 结构和引用完整性
- **FR-VALID-2**：目标 workflow JSON 的加载与 schema 校验移至 Step 2（解析出目标 workflow 之后）
- **FR-VALID-3**：Step 1 保留的校验内容：config.json schema 校验、v2→v3 自动迁移、`workflows.default` 引用检查、`selection.rules[].workflow` 引用检查
- **FR-VALID-4**：Step 2 新增的校验内容：目标 workflow JSON 文件存在性、JSON 有效性、schema 校验、DAG 无环检查

### 3.4 整合恢复逻辑

- **FR-RESUME-1**：将 .state.json 搜索与恢复逻辑整合到一个连续的步骤块中，不再分散在 Step 2 和 Step 3 两处
- **FR-RESUME-2**：恢复时的 workflowId 覆盖逻辑与 .state.json 搜索在同一位置处理

### 3.5 增强 history 事件日志

- **FR-HIST-1**：定义 history 的事件类型集合（created, resumed, worktree-created, node-start, node-done, node-failed, gate-pending, gate-approved, gate-rejected, stage-done, stage-skipped, recovery-triggered, rollback-analyzed, rollback-triggered, run-completed）
- **FR-HIST-2**：每个 history 条目新增可选字段：`note`（人类可读补充说明）、`feedback`（gate-rejected 时记录用户原始反馈）、`target`（recovery-triggered 时记录回退目标阶段）
- **FR-HIST-3**：确认门必须生成完整的事件链：`gate-pending` → `gate-approved` 或 `gate-rejected`（含 feedback）→ 重新生成 → 再次 `gate-pending` → 直到 `gate-approved`
- **FR-HIST-4**：spec/planning 等确认门阶段的多次否决必须全部记录在 history 中，feedback 字段格式为 `第x轮反馈：（反馈具体内容）`，x 为同一 node 在同一 stage 内的否决轮次（从 1 递增）
- **FR-HIST-5**：node-start/node-done 事件必须记录 stage 和 node 字段，便于追溯每个 atom-task 的执行时间线

### 3.6 .state.json 新增路径与元信息字段

- **FR-PATH-1**：.state.json 初始化时写入 `configPath`（config.json 绝对路径）和 `workflowPath`（目标 workflow JSON 绝对路径）
- **FR-PATH-2**：恢复时若 .state.json 缺少 `configPath`/`workflowPath`，agent 从 config.json 重新解析后补写
- **FR-META-1**：.state.json 初始化时写入 `historyMeta` 字段，包含事件类型枚举、feedbackFormat、feedbackScope、rules
- **FR-META-2**：`historyMeta` 随 .state.json 持久化，agent 恢复时可直接读取 history 编写规则

### 3.7 支持通过 .state.json 直接恢复工作流

- **FR-RESUME-3**：当用户直接提供 .state.json 路径要求恢复时，agent 可从 .state.json 中的 `configPath` 和 `workflowPath` 直接加载配置和工作流，无需重新执行 Step 1 和 Step 2
- **FR-RESUME-4**：直接恢复时仍需校验 workflowId 与 config.workflows.items[] 的一致性

### 3.8 文档版本归档（_del 目录）

- **FR-DEL-1**：git-worktree 创建工作目录时，同步在 `.state.json` 同级目录下创建 `_del` 目录
- **FR-DEL-2**：当确认门阶段的文档（spec.md、plan.md、test-plan.md 等）因用户否决而需要重大修改时，agent 必须先将当前版本 copy 到 `_del` 目录，再覆盖原文件
- **FR-DEL-3**：归档文件命名格式：`<原文件名>.<ISO 8601 时间戳>.md`（如 `spec.md.2026-07-13T12:01:00+08:00.md`）
- **FR-DEL-4**：跨阶段回滚时，回滚目标阶段及其下游阶段的文档均需归档
- **FR-DEL-5**：`_del` 目录中的文件仅用于 review 阶段对比，不参与流水线执行

### 3.9 确认门跨阶段回滚机制

- **FR-ROLLBACK-1**：当用户在 planning 阶段否决 plan 时，agent 必须分析用户反馈是否涉及 spec 层面的变更（如需求范围、功能需求增删、验收标准修改）。若是，则回滚到 spec 阶段重新生成 spec 并获得用户确认，再重新生成 plan
- **FR-ROLLBACK-2**：当用户在 test-plan 阶段否决 test-plan 时，agent 必须分析用户反馈是否涉及 spec 或 plan 层面的变更。若是 spec 变更则回滚到 spec；若是 plan 变更则回滚到 planning
- **FR-ROLLBACK-3**：回滚时必须记录 `rollback-triggered` 事件到 history，包含 `target`（回滚目标阶段）、`feedback`（用户原始反馈）、`note`（回滚原因分析）
- **FR-ROLLBACK-4**：回滚后重新经过的每个阶段都必须重新走确认门流程，不可跳过
- **FR-ROLLBACK-5**：回滚判断标准——以下情况需要回滚到 spec：
  - 用户要求增删功能需求（FR）
  - 用户要求修改验收标准（AC）
  - 用户要求调整项目范围（In/Out of Scope）
  - 用户要求修改术语定义或项目概述

---

## 4. 约束与原则

- **C-1**：不得引入 Git Hooks 或任何外部进程依赖
- **C-2**：修改范围仅限 SKILL.md 文件，不涉及 config.json、config.schema.json 或 atom-task 定义
- **C-3**：保持 SKILL.md 的指令型 runtime 风格，不引入新的执行模型
- **C-4**：向后兼容：现有的 .state.json 格式不得破坏性变更（只增字段，不删不改）

---

## 5. 验收标准（Acceptance Criteria）

- **AC-1**：SKILL.md 全文步骤编号连续唯一（Step 1 ~ Step N），无重复
- **AC-2**：.state.json 初始化模板包含 `workflowId` 字段
- **AC-3**：Step 1 不再遍历 `workflows.items[]` 做全量 workflow 校验
- **AC-4**：目标 workflow JSON 的加载与校验在 Step 2 中完成（解析出目标之后）
- **AC-5**：恢复逻辑（.state.json 搜索 + workflowId 覆盖）集中在一个连续段落中
- **AC-6**：路径解析规则表全文只出现一次
- **AC-7**：SKILL.md 中定义了 history 事件类型集合（至少 13 种事件）
- **AC-8**：history 条目结构包含 `note`、`feedback`、`target` 三个可选字段的定义
- **AC-9**：SKILL.md 中有确认门完整事件链的示例（gate-pending → gate-rejected → 重新生成 → gate-approved）
- **AC-10**：.state.json 初始化模板包含 `configPath` 和 `workflowPath` 字段
- **AC-11**：.state.json 初始化模板包含 `historyMeta` 字段（含 version, eventTypes, feedbackFormat, feedbackScope, rules）
- **AC-12**：SKILL.md 中描述了通过 .state.json 直接恢复工作流的流程
- **AC-13**：SKILL.md 中定义了确认门跨阶段回滚的判断标准和执行流程
- **AC-14**：SKILL.md 中有回滚场景的 history 示例（含 rollback-triggered 事件）
- **AC-15**：git-worktree 原子任务指令中包含创建 _del 目录的步骤
- **AC-16**：SKILL.md 中定义了文档归档的时机和命名格式

---

## 6. 范围说明（In / Out of Scope）

### In Scope
- SKILL.md 文件的内容修改
- .state.json 初始化模板的字段增强（新增 workflowId）
- .state.json history 事件日志规范（事件类型定义 + 条目结构 + 示例）
- 步骤合并、重编号与逻辑整合

### Out of Scope
- config.json / config.schema.json 的结构性变更
- atom-task .md 文件的修改
- 新增 atom-task 或 pipeline stage
- Git Hooks 或 CI/CD 集成
- Metrics 插件的修改

---

## 7. 开放问题（Open Questions，待 Plan 阶段决策）

- **Q-1**：合并后的步骤数量是保持 5 个（合并两个 Step 3 为一个），还是变为 4 个（合并 Step 1+2 为初始化，原两个 Step 3 合并为执行）？
- **Q-2**：Step 1 校验 selection.rules 引用时，是否需要加载被引用的 workflow JSON 文件来验证其 schema？还是只检查 items[].id 存在性即可？

---

## 8. 用户确认

请确认以下任一选项：

- ✅ **同意**：本 spec 符合预期，可进入 **Planning** 阶段生成 `plan.md`。
- ❌ **修改**：请在下方/对话中列出需要调整的条款编号与意见，AI 将基于反馈重新生成本文档。
