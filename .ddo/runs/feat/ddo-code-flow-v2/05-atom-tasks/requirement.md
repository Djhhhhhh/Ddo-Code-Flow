# 工作项 05 · atom-tasks — 原子任务改造

> 状态：**改造完成**（2026-09-22 定版 plan v1.2；样例验收通过后全量迁移 17 个任务完毕，冒烟 22 项 exec 全通过，测试 26/26）

关联：
- [../00-overview/overview.md](../00-overview/overview.md) —— 定位（原子任务是积木）
- [../04-cli-commands/plan.md](../04-cli-commands/plan.md) v1.1 —— `exec` 契约（裸文本 prompt 输出、渐进式加载）
- `atom-tasks/` —— v4 遗留 18 个原子任务（改造对象）

## 已确认决策

| # | 决策 | 依据 |
|---|---|---|
| D1 | **原子任务标准结构三件套**：`prompt.md`（原始 prompt）+ `config.json`（默认配置注册）+ `<task>.js`（组装逻辑，输出组装好的 prompt） | 用户定版 |
| D2 | `config.json` 必须支持两个用户可配项：**`extra_ctx`**（注入 prompt 的扩展 prompt）、**`rules`**（针对该原子任务的自定义要求与注意事项） | 用户定版 |
| D3 | `<task>.js` 与 tools/ 的配合方式待设计：倾向「tools/ 提供通用组装器，读取原子任务配置即可执行；task.js 作为任务特定组装逻辑（尤其分阶段任务）的挂接点」——具体抽象分层本轮定 | 用户定版（方向） |
| D4 | **stages = 组装原子任务集成工作流**，属 workflow 设计轮，本轮不做 | 用户定版 |
| D5 | **重写节奏**：先挑代表性任务改造 → 用户验收 → 再执行全部 | 用户定版 |
| D6 | **配置覆盖层级：任务默认 < 用户级 < run 级**，**不存在项目级**——工具没有项目级概念；即便出现项目语义，也在用户级中维护，不为它多抽象一层 | 用户定版（2026-09-22 修订） |
| D7 | **内容格式判据**：仅非 agent 读取/脚本使用的内容用 JSON 等结构化格式；**agent 读取的一概 md**（prompt.md、注入的上下文、最终组装产物）；动态组装按 prompt 文本进行（相位切段、md 拼接），不把 prompt 结构化 | 用户定版（2026-09-22 修订） |
| D8 | **相位表达 = 单文件 + 标记切片**：prompt.md 内 `<!-- @phase:XX -->…<!-- /phase:XX -->` 标记，exec 只输出当前相位段（不全量喂）；未包裹内容为共享前言每次携带；指令渐进与上下文渐进是两条独立通道（`:02` 不重喂 `:01` 指令，但 `:01` 产物可按 ctx 声明注入） | 用户确认（2026-09-22） |
| D9 | **配置快照原则**：用户级配置（`~/.ddo/atom-tasks.json`）在 run 启动时合并快照进 `state.atomTasks`，exec 只读 state；run start 未落地前，exec 过渡为三层现读（defaults < 用户级 < state.atomTasks 若存在） | 待评审确认 |
| D10 | **交互保证分级**：L1 相位段内交互指令 / L2 exec 检测 `@interact:required` 标记→输出顶部硬约束块+指定宿主提问工具 / L3 状态机门（human 相位推进只接受用户侧信号）。本轮落 L1+L2，L3 归执行循环轮。覆盖两类交互：与用户交互（ask-user）、与终端交互（user-shell，命令交用户执行） | 用户确认（2026-09-22） |
| D11 | **架构原则：预设与事实源分离**——workflow 只是预设；原子任务间**不做强制依赖**，任务关联只在 workflow 定义中；预设装配后的具体信息落到 `.state.json`，**`.state.json` 是运行过程中的唯一事实来源**（运行期一切读取以 state 为准） | 用户定版（2026-09-22） |
| D12 | **ctx 执行时动态计算（P1=b）**：config.json 不含静态 ctx 声明；「哪些上下文进入下一步 prompt」由 `<task>.js` 钩子在执行时基于 state 现算并追加 | 用户定版（2026-09-22） |
| D13 | **评审定稿**：P2 输出模板指令在前（前言→指令→ctx→extra_ctx→rules）；P3 rules 数组三层拼接（不覆盖）；P4 `phases[].type` 进 config；P5 样例 spec/coding/git-worktree；P6 样例改造即删旧 v4 文件 | 用户确认（2026-09-22） |
| D14 | **产出规范化采用 `.output.schema.json` 方式**（v1.2）：沿用 v4 schema 资产结构（sections required/format/columns/idPattern/subsections + rules + example），meta-schema 约束 schema 本身；config.json 的 output 只做定位（字符串=产出文件 / {updates}=写回）；exec 渲染 md 契约块注入生成侧，validate 做 schema 驱动硬校验 | 用户定版（2026-09-22：简化版不足以保证稳定输出，明确要求用 .output.schema 方式） |

## 待验收（D5 流程）

三个样例任务（spec / coding / git-worktree）已按 v1.2 契约完成改造并通过 26 项测试，等待用户验收后执行剩余 15 个任务的全量迁移。
