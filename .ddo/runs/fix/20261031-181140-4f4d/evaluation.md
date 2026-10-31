# 工具链设计合理性评估（evaluation）

> 依据：plan r2（四维裁决矩阵 + 双参照系外部调研 + 最小变更集）。评估对象 = tools/cli.js REGISTRY 全部 17 个子命令（commit f2b93d2 时点）。引用密度格式：SKILL.md / README.md / docs/architecture.md / atom-tasks+workflows（coding 期重测，grep -oE 计词）。

## 命令清单

| # | 命令 | 职责 | 使用时机 | 引用密度 | 裁决 |
|---|---|---|---|---|---|
| 1 | list tasks | 原子任务注册表数据面（desc/相位/旋钮） | 冷启动与自定义流程选任务 | 1/1/0/2 | 保留 |
| 2 | list workflows | 预设清单（name/阶段链） | 选工作流、--workflows-dir 校验入口 | 0/2/0/0 | 保留 |
| 3 | run start | 物化 .state.json + 注册 index | 启动 run | 6/4/1/12 | 保留（保留集） |
| 4 | run finish | 归档→history→index 移除→收口 | 结束 run | 9/6/2/11 | 保留（保留集） |
| 5 | rollback | DAG 路径重置 + 产物归档 | 驳回/重做 | 3/3/1/14 | 保留（保留集） |
| 6 | exec | 组装恰好必需的 prompt | 每相位进入时 | 10/7/2/0 | 保留（保留集） |
| 7 | validate | 产出硬校验 | 每相位产物完成时 | 3/5/3/0 | 保留（保留集） |
| 8 | next | 纯状态推进（相位/跨阶段/DAG） | 校验通过后 | 14/9/4/19 | 保留（保留集） |
| 9 | resume | 跨 run 发现层（index 惰性校验）→加载 | 恢复中断 | 4/4/1/0 | 保留 |
| 10 | status | 运行内定位（位置/门/派生命令） | 中断后重定位 | 5/1/1/6 | 保留（吸收 subflow list） |
| 11 | gate present | 统一交互呈现 + 盖 presentedAt | 人工审核前 | 2/3/2/18 | 保留（保留集） |
| 12 | gate interact | in-phase 交互留痕（使呈现过期） | 相位内提问/修改 | 1/2/0/8 | 保留（保留集） |
| 13 | subflow start | 运行期创建嵌套子 state | 阶段下沉子流程 | 1/3/1/0 | 保留 |
| 14 | subflow list | 只读子流程清单（3 行薄包装） | — | 0/1/0/0 | **并入 status** |
| 15 | subflow close | 子流程终态校验收口 | 子流程完成 | 1/2/0/0 | 保留 |
| 16 | deps check | 依赖本机逐项执行（结果型） | 测试工作流预检 | 0/2/0/7 | 保留 |
| 17 | guide | 启动检查 + 五问引导单一 payload | 冷启动 | 8/2/1/0 | 保留 |

## 外部参照（双参照系，web search）

### A 线：agent 工具设计实践

| 条款 | 来源 | 对照本 CLI |
|---|---|---|
| 「building a few thoughtful tools targeting specific high-impact workflows」往往优于给每个任务加一件工具；「Tools can consolidate functionality」；「Too many tools or overlapping tools can also distract agents」；命名空间分组划定边界 | Anthropic Engineering,《Writing effective tools for agents》(2025-09-11), https://www.anthropic.com/engineering/writing-effective-tools-for-agents | 17 命令全部有唯一职责域且按域分组（run/gate/subflow/list/deps 顶层动词+域）；重叠项仅 subflow list ⊂ status 一处 → 支撑 CS-1 合并；分组习惯与 Anthropic 命名空间条款一致 |

### B 线：行业流程/编排引擎 CLI 标准做法

| 引擎 | 命令面事实 | 来源 | 对照本 CLI |
|---|---|---|---|
| Apache Airflow | 自述「very rich command line interface」；按名词域分组（airflow dags list/pause、airflow tasks test 等，数十条）；2.0 曾把扁平动词（airflow list_dags）重构为 `dags list` 分组形态 | https://airflow.apache.org/docs/apache-airflow/stable/cli-and-env-variables-ref.html ；重构记录 https://github.com/apache/airflow/issues/9952 | 命令数量远超 17 属行业常态；「名词域 + 动词」分组与本 CLI 两段式（domain + verb，cli.js main 统一拼 key）同构——数量本身不是问题 |
| Temporal CLI | 8 个命令组（activity/batch/env/operator/schedule/server/task-queue/workflow）；workflow 组内 10+ 动词（cancel/count/delete/describe/execute/list/query/reset/show/update…）；观测面惯例 = list（清单发现）+ describe/show（单件详情）分离 | https://docs.temporal.io/cli ；https://docs.temporal.io/cli/command-reference/workflow | resume（发现）与 status（定位）分离同构于 list/describe 惯例 → 支撑保留 status 与 resume；生命周期动词 cancel/reset 对应 rollback/run finish |
| GitHub CLI | `gh run` 组 13 个子命令（cancel/delete/download/list/rerun/resume/retry/view/watch…）；顶层 25+ 命令按名词域分组 | https://cli.github.com/manual/gh_run | gh run rerun/view/list 与本 CLI rollback/status/resume 职责一一对应——引擎类命令面与行业惯例同构，无过度 |

## 四维裁决矩阵（逐命令结论与证据链）

**默认保留集（DEC-4，执行循环骨架）**：run start / run finish / rollback / exec / validate / next / gate present / gate interact——SKILL.md 执行循环逐命令依赖（next 14、exec 10、run finish 9、gate present 2+atom 18），且与行业引擎生命周期动词（gh run rerun/view/list、temporal reset/cancel）同构。全部保留，不动。

其余逐命令裁决（四维 = 外部实践 × 引用密度 × 实现重叠 × 误选风险）：

| 命令 | 外部实践 | 引用密度 | 实现重叠 | 误选风险 | 裁决 |
|---|---|---|---|---|---|
| status / resume | Temporal list/describe、gh run list/view 分离惯例 | 5/1/1/6 与 4/4/1/0 | statusView 单实现两入口（cli.js:719 注释明示共用）——是复用不是冗余 | 名称区分度可，resume=跨 run、status=运行内 | 均保留 |
| list tasks / list workflows | airflow dags list、temporal workflow list 清单命令惯例 | list tasks 1/1/0/2；list workflows 0/2/0/0 | guide 内嵌消费两者（runGuide→listWorkflows、mode 问引导 list tasks） | 低（名词域清晰） | 保留；list workflows 密度低但引擎线惯例支持清单命令存在，无外部条款支撑删除 → 「保留并记录」 |
| guide | Anthropic「few thoughtful tools / consolidate」正例 | 8/2/1/0 | 内嵌 resume 只读发现层（信息面重叠但语义=冷启动单一数据源） | 低 | 保留（其本身即合并哲学的体现） |
| deps check | 结果型预检命令，engine 线无反对条款 | 0/2/0/7（atom-tasks 7 处引用，atom-tasks 不在改动范围 → 引用不可迁移） | 无 | 低频但名称独特 | 保留（证据不足以删） |
| subflow start / close | 生命周期对（创建/收口），同 temporal batch/operator 域 | 1/3/1/0 与 1/2/0/0 | 无 | 低 | 均保留 |
| subflow list | **Anthropic：overlapping tools distract agents / Tools can consolidate functionality** | **0/1/0/0**（全库唯一引用=README 命令表） | **cli.js:802-804 三行薄包装 → lib/subflow.js:163-167 一行函数；statusView 已渲染 subflows 视图（cli.js:765-777）** | status/subflow list 双入口观察同一数据 → 正是用户担心的「相近工具误选」形态 | **并入 status**（吸收方=信息超集者；名称保留引用密度高者 status；不在保留集，双证据齐备） |

## 代码检查（行级/符号级）

| # | 问题 | 位置 | 处置 |
|---|---|---|---|
| C-1 | exec/validate 前置五段重复：--task 正则校验、currentPosition 位置校验、--phase 缺省/一致性、任务目录存在性检查在两命令各写一份（错误文案仅一词之差），双份维护有漂移风险 | cli.js:289-313（runExec）vs cli.js:330-357（runValidate） | CS-2：提取共享 helper `phaseContext`，签名与全部错误文案不变（行为等价） |
| C-2 | runValidate 函数体内重复 require('path')/require('fs')，遮蔽顶层导入，无任何作用 | cli.js:350-351 | CS-3：删除两行 |
| C-3 | subflow list 薄包装：命令实现仅转调 lib 一行函数（命令面冗余的代码表征） | cli.js:801-804、cli.js:1282-1290（REGISTRY）；lib/subflow.js:162-167 | CS-1：随命令移除（lib 导出同步删，避免死代码） |
| C-4 | statusView 单函数承担位置视图/门选项/派生命令/子流程视图四职 | cli.js:719-779 | 记录不动：四职内聚于「状态视图」单一语义，且为 status/resume 共用出口；无外部条款支撑结构性重构（最小变更集 DEC-2） |
| C-5 | 正面确认：REGISTRY 注册表即文档源（--help 纯渲染，cli.js:1389-1431）+ options[].required 声明驱动必填校验（cli.js:1377-1385）——单一事实源设计合理；本次删命令后 help 与必填校验自动跟随，即该机制的直接收益 | cli.js:1127-1323 | 无需改动 |

## 三问结论

| 问题 | 结论 | 证据链 |
|---|---|---|
| 是否设计过度？ | **总体没有，局部有**。架构层（注册表驱动、四通道契约、两层解耦）与行业引擎做法同构且被自身演进验证（C-5）；局部过度集中在观测面薄包装（subflow list）与实现层重复（C-1/C-2），均已列入变更集 | 外部 B 线三引擎同构对照 + C-1/C-2/C-3 行级事实 |
| 是否太多？ | **不算**。17 → 16 后仍覆盖全部生命周期/观测/恢复职责域且无重叠；行业引擎命令面（Airflow 数十条、Temporal 8 组×10+ 动词、gh 25+ 顶层）远大于此；Anthropic 条款针对的是重叠与无思考的工具堆加，本 CLI 每命令有唯一职责 | A 线 Anthropic + B 线三引擎命令面事实 + §命令清单逐行职责 |
| 是否冗余？ | **存在两处，本 run 已消除**：① 命令面 subflow list ⊂ status（薄包装 + statusView 已渲染同数据 + 唯一引用是 README 表格）→ 并入；② 实现面 exec/validate 前置重复 + runValidate 冗余 require → 等价去重。其余疑似对（status/resume、guide 内嵌 resume）经查为「单实现、不同职责入口」的复用而非冗余 | CS-1/CS-2/CS-3 + 矩阵逐命令裁决 |

## 变更集（最小变更集，合并优先于删除、等价优先于行为变更）

| ID | 类型 | 被动命令 | 吸收方 | 参数映射 | 双证据 | 文档同步 |
|---|---|---|---|---|---|---|
| CS-1 | 合并 | subflow list | status | `subflow list --state <父path>` → `status --state <父path>`，读返回体 `subflows` 字段（statusView 补齐 workflow/startedAt/closedAt 字段成为信息超集） | 外部：Anthropic「Tools can consolidate functionality / overlapping tools distract agents」；仓库：薄包装实现 + statusView 既有渲染 + 引用密度 0/1/0/0 | README.md 命令表删行并补 status 行说明；docs/architecture.md §子流程编排（start/list/close → start/close + status 视图注记）；cli.js 头注释与 subflow close --id 提示文案；tools/tests/subflow.test.js 用例迁移（3 处 subflow list 调用 → status） |
| CS-2 | 简化（行为等价） | exec、validate（实现层） | — | 签名/输出/错误文案均不变 | 仓库：C-1 五段重复（简化类单证据即可，DEC-7） | 无文档引用变化 |
| CS-3 | 简化（行为等价） | validate（实现层） | — | 删除函数内冗余 require 两行 | 仓库：C-2（同上） | 无 |

命令数：17 → 16。atom-tasks/*、workflows/* 未动（spec Non-goals）。
