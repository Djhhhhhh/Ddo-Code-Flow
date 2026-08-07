---
name: plan
version: "4.0.0"
enabled: true
timeoutSec: 0
concurrency:
  parallelizable: false
confirmation:
  rejectAction: regenerate-with-feedback
consumes:
  - role: spec
    required: true
  - role: context-summary
    required: false
produces:
  - role: plan
    kind: markdown
    primary: true
  - role: plan-parts
    kind: dir
  - role: tech-design
    kind: markdown
outputSchemaRef: "skill://atom-tasks/plan/plan.output.schema.json"
options:
  - key: splitThreshold
    type: integer
    default: 12000
    label: "拆分阈值"
    description: "Plan 逻辑草稿超过该 Unicode code point 数量后，按语义拆分到 plans/。"
---

# plan

> 基于已确认的 `{{inputs.spec}}` 生成指导后续开发的详细技术 Plan。Plan 负责技术决策、实现边界、仓库复用契约和下游交接；用户确认后方可进入后续编排阶段。

## 核心定位

Plan 面向一个开发者在本地仓库中的实现工作，只描述当前仓库、当前服务或组件，以及本次改动直接依赖的外部契约。它不负责组织协作内容，不生成设计人员、人员分工、人工排期，也不展开非当前服务的内部设计。

Plan 不负责测试用例或完整测试计划；具体测试内容由后续编排节点生成。Plan 只提供 `Verification Anchor`，说明哪些技术契约需要被下游验证。

## 指令

### 1. 读取输入并建立仓库事实

1. 读取已确认的 `{{inputs.spec}}`；仅在存在时读取 `{{inputs.context-summary}}`。
2. 在 `.state.json.worktreePath` 指向的工作树中检查与需求直接相关的现有设计和实现，至少关注：
   - 公共类、公共函数、共享组件和已有扩展点；
   - 请求/响应包装、分页请求与分页响应、错误码和异常处理标准；
   - schema、DDL、迁移约定、序列化、缓存、配置和日志规范；
   - 相似业务流程、测试约定及目录布局。
3. 每项可影响设计的结论必须进入“现有设计与复用基线”，并记录：人类可读的能力说明、文件路径、符号、证据类型、采用方式、适用边界，AI 索引放在最后一列。
4. 证据类型只允许：
   - `Repository Fact`：已读取真实文件且能定位到具体符号；
   - `Assumption`：尚未找到足够仓库证据，必须同时写明待确认方式。
5. 采用方式只允许：`复用现有实现`、`扩展现有实现`、`新增实现`、`不适用`。选择新增时必须说明现有能力为何不满足需求，防止重复设计和重复造轮子。
6. 使用有条件复用原则：满足需求、兼容性和质量约束时，复用 > 扩展 > 新增；已废弃、边界不匹配或质量风险明显的实现不得机械复用。

### 2. 形成技术决策

1. 先写需求范围、非目标和约束，再写仓库复用基线。
2. “技术选型与方案对比”按实际候选生成，不强制凑两个方案：
   - 初始 Plan 阶段发现多个真实可执行路线时，将它们全部加入候选集合；
   - 用户通过 `修改：<反馈>` 补充方案时，将新方案加入同一集合，并重新评估受影响的 Decision 和详细设计；
   - 候选状态使用 `candidate`、`accepted`、`rejected`、`superseded`；
   - 只保留关键差异、仓库适配性、代价、风险和结论，避免历史比较无限膨胀。
3. 每个重大 Decision 说明结论、依据、权衡、影响范围和回退条件；人类可读信息在前，`FR/AC/DEC` 等 AI 索引放在表格末列。
4. 对 spec 中每个开放问题给出唯一确定答案；无法安全确定时，不得伪造事实，应保留为阻塞项并请求用户澄清。

### 3. 按适用性生成详细设计

详细设计固定按以下顺序生成；无改动的章节写简短“不适用及原因”，不要展开模板化空话：

#### 3.1 数据模型设计

先定义业务实体、字段、类型、约束、关系、状态流转、索引、缓存或配置模型。仅在确有数据库变更时给出 schema 与 DDL/迁移策略，并说明新旧版本兼容、回滚和数据不变量。

#### 3.2 API 接口设计

接口必须引用已经定义的数据模型，并优先复用仓库现有请求/响应、分页、鉴权、错误和幂等标准。描述方法、路径或调用入口、请求、响应、错误语义、兼容边界和实现文件职责；不要另造平行协议。

#### 3.3 算法设计

仅当存在非平凡算法、状态机、并发、拆分、排序或一致性逻辑时生成。说明输入、输出、不变量、关键步骤、复杂度和边界条件。普通业务逻辑不得生成完整伪代码、逐行修改清单或可直接复制的实现细节；这些属于 Coding 职责。

#### 3.4 流程、稳定性与交付边界

- 只为当前改动直接相关的主流程、异常流程、状态流转或交互关系生成图。
- 所有正式图结构统一使用 Mermaid 流程图语法；禁止使用 PlantUML，禁止以 ASCII 架构图替代 Mermaid。
- 按适用性描述兼容、性能、安全、可观测性、灰度和回滚；没有直接影响时写明理由即可。
- 给出文件变更计划，但只到“文件/模块职责 + 契约”的粒度，不替 Coding 写逐行实现。

### 4. 组织 Plan 文档

先在内存中形成完整逻辑草稿，按换行统一为 LF 后的 Unicode code point 计数。有效 `splitThreshold` 默认 12000，最小 4000；配置小于 4000 或不是整数时，停止生成并报告配置错误。

#### 4.1 single 模式

当完整逻辑草稿字符数 `<= splitThreshold` 时：

- 将完整内容写入 plan 产物，文档模式标记为 `single`；
- 不创建 `plans/`，也不保留旧的 current parts；
- plan 产物本身是唯一详细 Plan 和确认入口。

#### 4.2 split 模式

当完整逻辑草稿超过阈值时：

- plan 产物保留标题、revision、执行摘要、核心决策、追踪总览、Parts Manifest、完整读取协议和用户确认命令；
- 详细内容按语义边界写入 `plans/NN-<semantic-slug>.md`，编号从 `01` 连续递增；
- 每个 part 标明相同 revision、part 序号和返回 plan 产物的链接；
- manifest 至少包含文档、职责、字符数、状态和末列 AI 索引；有效分册状态标记为 `current`，下游把它们称为 `current parts`；
- 不得在 Markdown 表格、Mermaid 代码块、Decision、完整接口、schema、DDL 或算法契约中间硬切；单个不可分割语义块允许超过阈值；
- 新 revision 重写 manifest。旧分册若保留，必须移出 current 集合或明确标记 `stale`，不得被下游读取。

### 5. 下游交接

- 下游验收规划从 plan 产物出发，只读取生成验收策略所需的 current parts；不得让 Plan 直接承担测试计划职责。
- 下游任务拆分必须读取 plan 产物和 manifest 中全部 current parts，建立完整任务依赖。
- Coding 按当前 task 加载相关 part，可对任务引用的文件路径和符号做一次轻量事实核对；若证据已失效，应停止并报告，不得自行改变已批准契约、切换方案或重新设计。
- Verification 和 Review 从入口出发，按验收分组或变更文件加载相关 parts。
- tech-design 产物只是简化归档，不作为任何下游阶段的执行输入。

### 6. 归档

归档模板统一放在 `atom-tasks/plan/references/`，并按名称选择：

- 用户输入 `归档` 时，只枚举该目录下可用的 `*.md` 文件，并以文件名展示模板列表；此时不生成归档；
- 用户输入 `归档：<模板名>` 时，按完整文件名或不含 `.md` 的 basename 精确匹配模板，例如 `归档：archive-template`；不得接受目录片段、通配符或目录穿越路径；
- 选择过程只做名称解析和文件存在性判断，不比较模板内容、外部来源或哈希，也不维护固定模板校验契约；
- 读取选中的模板和当前 revision 的完整详细 Plan，生成或刷新 tech-design 产物；归档过程不得回写模板文件；
- 按选中模板的原有章节生成内容，不适用章节按模板要求标注 N/A；详细 Plan 仍可按本地单人工作流裁剪；
- 所有图仍使用 Mermaid，并明确记录模板名与来源 Plan revision；
- 归档不是批准动作，不改变 confirmation；详细 Plan 继续驱动 Test-Planning、Tasking、Coding、Verification 和 Review；
- Plan revision 变化后既有归档立即失效（stale），必须由用户再次执行 `归档：<模板名>` 才能刷新。

### 7. 有界静态检查

每个 revision 写入完成后，仅执行一次内联 Markdown/Mermaid 静态检查，不新增 `plan-atom-task.validation.ps1` 或其他 Plan 专属验证脚本。检查范围限于：

- frontmatter/JSON 引用可解析；
- 标题层级、链接、manifest 与 current parts 一致；
- 代码围栏和 Mermaid 围栏闭合；
- split 计数、连续编号和 revision 一致；
- 必需章节、开放问题映射和 AI 索引存在。

内容违规记为 `content_error`；检查命令本身无法执行记为 `checker_execution_error`。两者都必须报告，但失败后不自动重试、不重新扫描仓库、不重新加载 Context。等待用户选择 `修改` 后，才生成下一 revision 并再次执行一次检查，避免“检查 → context 超限 → 重载 → 再检查”的循环。

### 8. 用户确认与友好回复

生成 Plan 后，展示 plan 产物路径、文档模式、revision、分册数量和静态检查结果，并提示用户继续选择执行命令：

- `同意`：批准当前 revision，友好说明即将进入 Test-Planning。
- `修改：<反馈>`：将反馈应用到新 revision；若反馈补充候选方案，重新比较并刷新受影响契约。回复应说明变更摘要、输出位置和本 revision 唯一一次静态检查结果。
- `提问：<问题>`：只回答问题；明确说明没有修改文档、revision 或确认状态。
- `归档`：列出 `references/` 下可选模板名，并提示使用 `归档：<模板名>`；不修改文档或确认状态。
- `归档：<模板名>`：使用按名称选中的模板生成或刷新 tech-design 产物；回复模板名、文件位置、来源 revision、仅供归档的用途，并说明它不代表批准。

执行 `修改`、`提问`、`归档` 或 `归档：<模板名>` 后，回复末尾都必须再次提示用户选择 `同意`、`修改：<反馈>`、`提问：<问题>` 或 `归档`；已列出模板时同时提示 `归档：<模板名>`。

## 约束

- 所有输出必须写入 `.state.json.worktreePath` 指向的功能 worktree，不得误写主仓库。
- spec 中每个开放问题必须有且仅有一个确定答案或明确阻塞，不得伪造仓库事实。
- 人类可读信息优先；FR、AC、DEC、Q 等仅作 AI 索引并放在表格末列或段落末尾。
- Plan 不生成测试用例、不创建测试计划、不编写普通业务代码。
- 不得新增 Plan 专属验证脚本。
- 归档模板统一从 `atom-tasks/plan/references/` 按名称选择；不执行内容、来源路径或哈希校验，归档过程不得修改选中的模板文件。
- 所有正式图必须使用 Mermaid。

