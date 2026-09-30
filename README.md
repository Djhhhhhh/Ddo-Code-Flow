# ddo-code-flow

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) ![Node](https://img.shields.io/badge/node-%E2%89%A518-blue) ![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)

**ddo-code-flow** 是一个显式调用的分阶段任务执行 skill。用户交付任务并选择工作流后，代理依次完成其中的任务，在人工审核点等待用户决议，保存执行状态，支持中断恢复。

它不替代理写代码，而是组织和约束代理的工作过程：CLI 提供当前指令、校验产物并管理状态；代理完成实际工作；用户审核关键交付。最终生成哪些文档和代码，由所选工作流决定。

本 README 面向使用者和维护者；[SKILL.md](SKILL.md) 是代理的执行入口。

## 为什么需要它

直接让 AI 完成开发任务，容易出现需求尚未对齐就开始实现、方案没有审核、过程缺少留档、中断后无法接续等问题。

ddo-code-flow 将任务组织成可审核、可恢复的流程，并使用 CLI 对执行位置、输出契约和确认门进行检查：

| 需要解决的问题 | 提供的机制 |
|---|---|
| 需求和方案缺少审核 | 工作流中的人工审核点；呈现和用户决议留痕 |
| 一次加载全部指令和历史 | 每个相位按当前状态组装指令、配置、上下文和输出契约 |
| 代理只口头声称完成 | 通过 validate 检查声明的产物；实际执行和验证证据仍由代理提供 |
| 重做时新旧产物混在一起 | 阶段回滚，失效产物移动到 `_del/`，重做生成新文件 |
| 会话中断后失去执行位置 | `.state.json` 保存状态，resume 从选定运行的当前位置接续 |

这些机制不等于代理会自动做对所有事情。代理仍须完成实际工作、校验产物并等待用户决议；`next` 负责状态推进，不代替产物校验。

> **Dogfooding**：本仓库 v2 的需求与定版方案保存在 `.ddo/runs/feat/ddo-code-flow-v2/`，开发过程也使用了这套流程。

## 调用契约

**只接受显式调用，不按任务内容或关键词自动激活。** 普通对话中出现“使用工作流”“分阶段开发”等表达，不等于调用本 skill。

显式调用方式包括宿主提供的斜杠命令，或显式引用 `SKILL.md` 作为执行入口。请求审阅、解释或修改这个文件本身，不视为执行调用。

| 调用方式 | 启动行为 |
|---|---|
| `/ddo-code-flow <需求或 bug 描述>` | 新开 run。已有目标，不询问 resume，也不重复询问目标；继续询问其他启动配置。 |
| `/ddo-code-flow` | 先询问恢复已有 run 还是新开 run，然后进入用户选择的分支。 |

显式调用后，无论任务多简单都必须进入流程，不以问答、小改动或单文件修复为由绕过。

带描述调用不因存在旧 run 而改变新建意图。不带描述调用不因没有旧 run 而跳过首次选择，也不因只有一个 run 而自动恢复。

## 安装

前置要求：

- 一个宿主 AI coding agent，例如 Claude Code、Codex，或其他能加载 skill 指令并执行命令的工具。
- Node.js ≥ 18。流水线内核是零依赖的 Node CLI，无需 `npm install`。

**作为 skill 安装**：把本仓库放入宿主的 skills 目录。Claude Code 通常使用 `~/.claude/skills/ddo-code-flow/` 或项目内 `.claude/skills/ddo-code-flow/`；其他宿主按其规范放置并显式加载。

安装后，通过宿主支持的显式调用方式启动。不同宿主的命令形式可以不同，但必须遵循同一调用契约，并把用户附带的描述传给执行入口。不能仅因宿主自动发现了 skill，就未经用户显式调用执行流程。

**clone 仓库用于开发与调试**：

```bash
git clone https://github.com/Djhhhhhh/Ddo-Code-Flow.git
```

克隆后可在仓库根目录直接运行 CLI。手动调用 CLI 是调试方式，不等于允许代理在普通对话中自动启动 skill。

## 快速开始

### 带描述：新开运行

```text
你      /ddo-code-flow 修复导出函数的边界处理
agent   （接收目标，不询问恢复或重复询问目标）
        是否使用 worktree？
你      不使用
agent   选择哪个工作流？
你      basic
agent   run 类型？
你      fix
agent   运行材料使用正常存储还是临时存储？
你      正常存储
agent   （按已确认的配置启动，告知预填的可配置项，执行当前任务）
        （固化原始需求，生成 spec，并在人工审核点展示待审内容）
你      修改：验收标准里加上边界值说明
agent   （记录交互，修改相关内容，再次呈现审核选项）
你      同意
agent   （在满足推进条件后继续 plan、coding、reporting，最后收口）
```

上例只说明交互顺序，不是固定问题或审核选项清单。实际工作流、选项、默认值和条件追问来自当次 CLI 返回内容；人工审核选项来自 `gate present`。

用户需要参与启动配置和人工审核，不需要手动记忆内部命令。确认配置前不会仅凭任务描述直接创建 run；选择 worktree 时，会先完成创建，再启动运行。

### 不带描述：先选择恢复或新建

```text
你      /ddo-code-flow
agent   希望恢复已有 run，还是新开 run？
你      恢复已有 run
agent   （列出运行中的 run，请你选定）
你      （选择要继续的运行）
agent   （加载状态，重新获取当前步骤指令，从选定位置接续）
```

若选择新开，代理从目标问题开始询问完整启动配置。若选择恢复但没有可恢复的运行，代理说明情况并等待你的决定，不擅自改为新建。

恢复入口是无描述调用后选择“恢复”，不使用 `/ddo-code-flow 继续` 作为特殊恢复语法。

### 原始输入与恢复

带描述调用的原始内容作为任务输入保留，提取一句话 title 不等于已经保存了完整需求。工作流包含 requirement 任务时，由该任务及时固化原始输入。

若在原始输入落盘前中断，恢复时又缺少原始上下文，代理应向用户重新索取，不从 title 或模型记忆重建需求。没有 requirement 任务的工作流，不承诺生成 requirement.md。

## 工作流与扩展范围

内置工作流包括：

- **basic**：轻量开发链，requirement → spec → plan → coding → reporting。
- **standard**：完整开发链，增加测试计划、任务拆分、验证、复审和复盘。
- **pr-delivery**：PR 交付收尾链，deliver-pr → closeout-worktree。
- **pr-delivery-issue**：交付链的 issue 关联变体，增加 link-issue。

实际预设清单和任务链以 `list workflows` 为准。启动时也可以选择自定义流程：列出任务，与代理确定阶段及依赖，再通过临时预设启动。

当前阶段链支持 DAG 依赖，但状态推进有以下边界：

- `next` 推进所有当前位置，不是只推进刚完成的任务。
- 一轮出现多个普通执行位置时，必须全部执行并校验成功后再推进。
- 一次 `next --decision` 将同一个决议用于所有当前确认门，不支持逐门独立推进。
- 多门同时出现时，不能把某一个门的批准当成全部批准。只有用户明确批准全部待审内容，且同一推进决议对所有门都合法时，才能统一推进。
- 需要不同决议或独立审核时，相关步骤应串行编排；代理不能伪造逐门推进命令。

## 它是怎么工作的

skill 运行在宿主代理中，不是独立的开发代理。几个核心概念如下：

| 概念 | 含义 |
|---|---|
| 原子任务 | `atom-tasks/<name>/` 中的任务单元，包含指令、相位与产物声明，以及可选的上下文钩子和输出 schema |
| workflow 预设 | 声明阶段及 `dependOn` 依赖；启动时物化进 state |
| run | 一次运行，包含所选任务链、状态和流程产物 |
| 相位 | 一个任务中的步骤，当前位置以 `spec:01` 等形式表示 |
| 确认门 | 人工审核位置，先呈现选项，获得用户明确决议后才能推进 |

三方分工：

| 角色 | 职责 | 边界 |
|---|---|---|
| CLI | 提供指令、校验产物、检查位置与确认门、推进状态、处理归档 | 不代替代理完成业务任务，不代替用户决议 |
| 代理 | 完成当前指令要求的工作，校验产物，呈现选项并执行合法命令 | 不手改 state，不自造选项，不跳过任务或替用户批准 |
| 用户 | 显式调用、选择配置、审核交付并作出决议 | 不需要手动操作内部状态文件 |

### 普通执行循环

1. 读取完整 `currentStage`；每个当前步骤都先通过 exec 获取本次指令，包括人工审核步骤。
2. 完整阅读指令、Context 和 Output Contract，完成本轮所有普通执行位置的实际工作。
3. 分别 validate。失败则修正并重试；任一普通执行位置未完成或未通过校验，不调用推进命令。
4. 没有人工审核时，统一执行一次 next；有审核时，按当前指令与 gate payload 呈现内容，等待用户决议，再执行合法 dispatch。
5. 每次状态改变后重新读取位置；普通流程全部完成后执行 run finish，不把 completed 当成已经收口。

相位内修改、提问或回答问题不等于批准。交互先通过 gate interact 留痕，处理后重新 gate present，再取得用户选择。多门交互使用 `--stage` 指定目标。

### 交付链的特殊收尾

`closeout-worktree` 是交付预设末段的专用收尾任务，进入时须为唯一当前位置。它通过当前 exec 指令自行完成：产物入库、next、run finish、终态入库、worktree 清理。

正常模式固定使用 `--no-archive`；临时模式使用其指定的临时收口命令，并跳过材料入库步骤。外层不重复 validate、next、finish 或 cleanup-worktree。

该例外只针对收尾顺序，不取消用户确认、安全约束和失败处理。开发链需要清理 worktree 时，仍按 cleanup-worktree 任务处理。

## 命令参考

日常使用时，代理按 [SKILL.md](SKILL.md) 调用这些命令；以下供手动调试和维护参考。

代理统一使用 `node "<skillRoot>/tools/cli.js" <命令>` 的绝对入口。仓库根目录中手动调试时可使用 `node tools/cli.js <命令>`。

| 命令 | 作用 |
|---|---|
| `guide` | 返回运行清单、完整启动问题、选项和参数映射；启动分支由 SKILL.md 根据显式调用是否附带描述决定，不机械执行旧的 resume 优先提示 |
| `run start` | 按预设创建 state 并注册运行；支持正常或 `--ephemeral` 临时存储，后者与 `--dir-name` 互斥 |
| `exec` | 返回当前相位的组装指令；校验执行位置，但不完成实际任务 |
| `validate` | 检查当前任务声明的产物、必填结构和输出 schema |
| `next` | 推进全部当前位置、激活后继阶段；不自动 validate；有确认门时须有合法决议和有效呈现 |
| `gate present` | 返回当前审核选项及 dispatch，记录呈现时间；选项来自静态声明与动态钩子 |
| `gate interact` | 记录相位内交互，使既有呈现过期；处理后必须重新呈现，多门时用 `--stage` 指定目标 |
| `rollback` | 重置指定阶段及相关依赖路径，清除相关确认门，将已声明旧产物移到 `_del/rollback-<n>/` |
| `run finish` | 结束运行并移出运行索引；正常模式默认归档且保留原目录，`--no-archive` 跳过归档和结束历史；临时模式删除运行材料 |
| `status` | 已知 statePath 时，返回当前位置、确认门选项及可用命令 |
| `resume` | 无参列出运行中 run；`--run-id` 加载选定运行的完整状态视图 |
| `list tasks` | 列出任务、相位、审核位置和可配置项 |
| `list workflows` | 列出预设、描述和阶段链 |

命令 stdout 通常为 JSON，exec 为裸文本指令；stderr 是人类可读提示。退出码 0 表示成功，1 表示执行失败或被拦截，2 表示用法错误。命令错误不能当成已完成。

恢复后若当前位置已为空，按可用命令收口，不再尝试 exec 或 next。专用收尾已开始但未完成时，继续其专属协议，不用默认 finish 覆盖指定参数，也不重复已成功执行的动作。

## 目录与产物生命周期

### 执行位置

| 位置 | 用途 | 来源 |
|---|---|---|
| skillRoot | 本 skill 的任务、预设和 CLI；运行期只读 | SKILL.md 所在目录 |
| projectRoot | 本次运行的项目位置；使用 worktree 时为该工作树 | `state.dirs.projectRoot` |
| 代码工作目录 | 代码创建、修改和项目命令执行的位置 | `git.worktreePath` 非空时使用该目录，否则使用 projectRoot |
| runDir | `.state.json` 与流程文档产物的统一存放位置 | `state.dirs.runDir` |
| DDO_HOME | 全局运行索引、临时运行材料和历史归档 | 环境变量 DDO_HOME，默认 `~/.ddo` |

有效任务目录在启动前取本次 `--tasks-dir`，未指定时取内置目录。启动或恢复后，取值优先级为：命令显式指定的目录 → `state.dirs.tasksDir` → 内置目录。所有按需直接读取的前置和收尾任务也使用这个目录，不因恢复未附带参数而回落默认。

选择 worktree 时，在 run start 前创建，再使用 `--project <工作树绝对路径>` 启动。创建失败不继续启动；git-worktree 是启动前置任务，不加入运行中的阶段链。

### 存放与回滚

- 正常模式：运行材料位于 `<projectRoot>/.ddo/runs/<type>/<dirName>/`；默认 dirName 为 runId，也可显式指定 `--dir-name`。
- 临时模式：运行材料位于 `<DDO_HOME>/tmp/<type>/<runId>/`，不在项目内创建运行目录。
- 具体产物文件名和格式以当前 exec 的 Output Contract 为准，不自行搬移 state 或流程文档。
- 声明的文档输出路径必须位于 runDir 内，不能使用绝对路径或 `..` 逃逸。
- 正常模式的材料可以随项目版控管理，但保存文件不等于已自动提交。
- 回滚时，CLI 将本次重置阶段已声明且存在的产物移动到 `<runDir>/_del/rollback-<n>/`。旧文件从原位置移走，重做生成新文件，以返回的 archived/archivedTo 为准，不手工搬删。

### 结束

`run finish` 的材料处理规则对 done、aborted、failed 均适用：

| 模式 | 原 runDir | 历史 |
|---|---|---|
| 正常模式 | 保留，不搬移、不自动删除 | 默认整目录 ZIP 到 `<DDO_HOME>/history/<runId>.zip`，并写入 `history/runs.jsonl` |
| 正常模式加 `--no-archive` | 保留 | 不生成 ZIP，不记录结束历史 |
| 临时模式 | 删除整个目录，包括 state 和流程产物 | 不生成 ZIP，不记录结束历史 |

需要保留临时材料时，在 finish 前确认保留位置并完成保存。临时模式成功收口后，原 state 已不存在，不能再通过原 statePath 重跑 finish。

run finish 不撤销代码修改，也不等于删除 worktree。worktree 清理可能影响保留在其中的运行材料，是单独的收尾动作；不能擅自丢弃未提交变更或删除未合并分支。

## 配置分层

原子任务配置按三层取值，标量覆盖，rules 数组逐层拼接：

```text
任务默认（atom-tasks/<name>/config.json 的 defaults）
  < 用户级（<DDO_HOME>/atom-tasks.json）
  < run 级（state.atomTasks，run start 时预填可配置项）
```

启动后代理告知预填配置。配置分层不意味着代理可以任意手改 state；运行状态仍只通过 CLI 更新。

## 扩展

新增原子任务时，在 `atom-tasks/<name>/` 下创建：

| 文件 | 必选 | 说明 |
|---|---|---|
| `prompt.md` | 是 | 任务指令；`<!-- @phase:NN -->` 切分相位，`@interact` 标记交互要求 |
| `config.json` | 是 | 相位类型、审核选项、输出声明、默认配置；受任务配置 schema 管控 |
| `<name>.js` | 否 | 基于当前 state 组装上下文的钩子 |
| `<name>.output.schema.json` | 否 | 文档输出契约 |

自定义工作流使用 JSON 的 stages 数组声明任务和 dependOn 依赖，按现有预设结构编写。启动问询选择自定义时，临时预设写到系统临时目录，通过 `--workflows-dir` 和 `--workflow` 启动，不写入 skillRoot。

编排时遵守完整位置清单的统一推进规则；需要独立审核的分支串行安排。git-worktree 不作为链内阶段；closeout-worktree 仅放在交付预设末段，并保证它是唯一当前位置。

新增跨完成边界的收尾任务时，应明确更新入口协议，不依靠代理猜测是否跳过通用循环。脚本读取的结构数据使用 JSON；代理读取的任务指令使用 Markdown。

## 仓库结构

```text
SKILL.md                         # 代理执行入口：显式调用、启动分流、执行及审核规则
README.md                        # 用户与维护者说明
workflows/basic.json             # 轻量开发链
workflows/standard.json          # 完整开发链
workflows/pr-delivery.json       # PR 交付收尾链
workflows/pr-delivery-issue.json # issue 关联交付链
atom-tasks/<name>/               # 任务指令、配置、上下文钩子与输出契约
atom-tasks/_schema/              # 任务和输出契约的 meta-schema
tools/cli.js                     # Node CLI
tools/lib/                       # state、索引、归档、组装和 schema 校验
tools/tests/                     # node:test 沙箱隔离测试
.ddo/runs/                       # 正常模式运行材料
```

## PR 格式

`pr-delivery` 与 `pr-delivery-issue` 共用 `deliver-pr` 的 [PR 内容格式](atom-tasks/deliver-pr/prompt.md#pr-内容格式)：标题使用 `【type】(scope):<中文摘要>`（scope 可省略），正文固定为变更摘要、主要变更、验证结果、风险与兼容性、关联事项五个栏目。

交付任务依据实际变更生成内容，以 `--title` 和 `--body-file` 显式传给 `gh pr create`；验证结果必须如实区分已通过、失败与未执行。仓库的 [GitHub PR 模板](.github/pull_request_template.md) 同步该栏目结构。这是流水线生成协议，不是 CLI 或 CI 对远端 PR 的格式硬校验；不改写已有 PR，也不改变原有合并确认门。

## 开发与测试

在仓库根目录使用支持 glob 展开的 shell 执行：

```bash
node --test tools/tests/*.test.js
```

测试在临时目录沙箱内隔离运行，不影响真实项目运行材料和默认 DDO_HOME。测试失败时应区分实现问题、断言问题和环境差异，不跳过失败或未经确认修改用户配置。

CLI 测试不等于 skill 行为测试。入口修改后，还应在独立会话中检查：

- 带描述调用不询问恢复、不重复询问目标，并完成其余配置问询。
- 不带描述调用始终先选择恢复或新建，无论旧 run 的数量如何。
- 显式调用简单任务仍进入流程；普通对话和文件审阅不会启动流程。
- 恢复自定义任务目录的运行时，exec 与手动加载的任务来自同一目录。
- 多当前位置不会因只完成一项而被提前推进。
- 审核未回复不推进，修改后重新呈现；交付收尾不被外层重复执行。

跨宿主使用时还需验证显式加载、调用参数传递和用户问询能力，不把单个宿主的一轮成功当成跨宿主保证。

## 设计文档与路线图

v2 的需求与定版方案保存在 `.ddo/runs/feat/ddo-code-flow-v2/`，涵盖状态、索引、命令、原子任务、预设、确认门、恢复、启动引导和产物生命周期。

后续方向包括：

- 并行多门独立决议粒度与更严格的用户决议来源约束。
- 用户级预设，以及基于历史运行分析的预设改进。
- 产物快照与非回滚的显式失效标记。

尚未实现的能力不作为当前入口承诺。

## 参与贡献

欢迎 Issue 与 PR，模板位于 `.github/`。涉及流程语义的改动应先对齐需求与方案，再实现和验证。命令行为变化须同步 CLI 命令注册表、README 和 SKILL.md；入口行为变化也须同步用户示例，并核对当前 CLI 和任务指令是否能够承接。

## 许可证

[MIT](LICENSE) © 2026 Djhhhhhh
