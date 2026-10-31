---
name: ddo-code-flow
description: |
  显式调用的分阶段任务执行流程。按所选工作流推进任务，在人工审核点等待
  用户确认，保存执行状态，支持中断恢复。仅在用户显式调用本 skill，或显式
  引用本 SKILL.md 作为执行入口时启动；不根据普通对话中的关键词自动激活。
  显式调用后，无论任务复杂度如何，都必须进入流程。带需求或 bug 描述时
  新开 run 并询问其余配置；不带描述时先询问恢复已有 run 还是新开 run。
metadata:
  authors:
    - "djhhhhhh"
  version: "2.2.1"
---

# ddo-code-flow

本 skill 将用户交付的任务放入选定的工作流中执行，而不是收到需求后直接写代码。
代理依次完成工作流中的任务，在人工审核点暂停，得到用户决议后继续。
最终交付哪些文档和代码，由所选工作流决定。

CLI 提供当前任务指令、校验产物并管理状态；代理完成实际工作；用户负责审核和决议。

## 引用关系

本文件是唯一调用入口，只承载：调用契约、启动分流规则、执行循环节律、安全红线。
细节以引擎侧为权威来源，与本文件不一致时按引擎侧修正本文件：

- 命令用法与参数细节：`node "<skillRoot>/tools/cli.js" --help` 及各命令 `--help`；
- 启动问询序列（问题、选项、条件追问、参数映射）：`guide` 输出；
- 各任务的指令与产出契约：`exec` 组装返回的指令文本（含其 Output Contract）；
- 启动前置与收尾动作（worktree、交付链等）：所属 atom-tasks 任务文件
  （`<有效任务目录>/<任务名>/prompt.md` 与 `config.json`）；
- 运行位置、开门状态与可恢复 run：`status` / `resume` / `gate present` 输出与 state。

上述权威来源已承载的内容，不在本文件重复自述。

## 调用契约

仅接受用户显式调用本 skill，或显式引用本 SKILL.md 作为执行入口。
斜杠命令是调用形式之一；其他宿主显式引用本文件执行时，遵循同一契约。
仅要求审阅、解释或修改本文件，不视为执行调用。

不根据“使用工作流”“分阶段开发”等普通对话表达自动激活。
显式调用后，不判断任务是否值得启动流程：简单需求、问答、单文件修改和复杂开发任务都必须进入。

先读取本次调用是否附带需求或 bug 描述，再选择启动分支。
不得用已有运行、任务复杂度或代理自己的推断改变该分支。

## 执行位置

- `skillRoot`：本 SKILL.md 所在目录，运行期只读；CLI 以绝对路径调用：
  `node "<skillRoot>/tools/cli.js" <命令>`。
- 启动项目：用户调用本 skill 时的项目；使用 worktree 时，改为创建后的工作树。
- 启动后路径以 state 为准：文档产物统一放 `state.dirs.runDir`（目录布局与临时模式
  语义见 `run start --help`，归档与收口语义见 `run finish --help`）；
  代码工作目录为 `git.worktreePath`，未设置时用 `dirs.projectRoot`；
  多仓库隔离 run 以 `git.repos` 为准（容器根 `git.container`）。
- 有效任务目录：本次命令显式指定的 `--tasks-dir` 优先，其次 `state.dirs.tasksDir`，
  再次 `<skillRoot>/atom-tasks`；所有直接读取的任务文件均使用其下的绝对路径。
- `.state.json` 是执行状态的唯一事实源，只通过 CLI 更新，不手工编辑。

## 启动分流

### 带描述调用：新开 run

例如：`/ddo-code-flow 修复登录后跳回首页的问题`。

1. 将附带描述作为本次任务的目标输入，保留原始内容；需要提取一句话 title 时，
   不丢弃原始需求或 bug 信息。
2. 运行 `guide`，按其输出的问题序列、选项与参数映射，询问其余启动配置及适用的
   条件追问；不呈现恢复已有运行的询问，不重复询问已提供的目标。
3. 完成下方适用的前置动作后，按确认的配置执行 `run start`。

即使发现已有运行，本次调用仍进入新建分支；附带描述不等于已完成启动配置。

### 不带描述调用：先选择恢复或新建

先通过宿主提问工具询问用户：恢复已有 run，还是新开 run。
不得因为没有发现运行或只发现一个运行而跳过询问或自动恢复。

- **恢复**：执行 `resume` 获取运行中的 run 清单，呈现清单请用户选定，再执行
  `resume --run-id <runId>`；没有可恢复的运行时说明情况、等待用户决定，
  不擅自转为新建。
- **新建**：运行 `guide`，从目标问题开始询问全部启动配置，再完成前置动作并
  `run start`。

### 启动前置动作

仅在 guide 输出中选中相应能力时加载：

- **worktree**：在 `run start` 前读取有效任务目录中的 `git-worktree/config.json`
  与 `git-worktree/prompt.md`，按确认的配置执行（single / release-dev 创建成功后以
  `run start --project "<工作树绝对路径>"` 启动；multi 先建隔离容器再以
  `--multi-repos "<主检出列表>"` 启动，首位=主仓库）；创建失败立即暂停报告。
  不把 git-worktree 加入运行中的阶段链。
- **自定义工作流**：按 guide 指引执行 `list tasks`，与用户确定任务链；在系统临时
  目录写预设，通过 `--workflows-dir` 与 `--workflow` 启动；不得写入 skillRoot。

启动成功后保存 statePath，告知用户 `state.atomTasks` 中预填的可配置项，再进入执行循环。
恢复成功后重新获取当前步骤指令，不凭会话记忆继续。

## 执行循环

一次执行称为一个 run。工作流由任务组成，每个任务可含多个相位；`state.currentStage`
是当前位置清单，每项形如 `<任务名>:<相位>`。每轮读取完整清单；为空时转入「结束与异常」。

每次进入一个步骤（包括人工审核步骤），都先获取本次指令：

```bash
node "<skillRoot>/tools/cli.js" exec --state "<statePath>" --task <任务名> --phase <相位>
```

相位为两位数字（如 `01`），缺省可省略。`exec` 只组装并返回指令，必须完整阅读
（包括 Context 和 Output Contract）再执行实际工作；不得跳过 exec，不得用之前步骤
或之前运行的指令代替，不预先通读全部任务文件。

### 普通执行与统一推进

1. 对本轮所有普通执行位置，分别获取指令、完成工作并生成要求的产物。
2. 分别校验各位置的产物：与 exec 同形，把命令换为 `validate`。
3. 全部校验成功后，才处理本轮的人工审核；任何一项未完成或校验失败，
   都不得调用推进命令（包括审核选项中的 `next --decision`）。
4. 本轮没有待决议的人工审核时，统一执行一次 `next --state "<statePath>"`。
   `next` 推进所有当前位置；有多个位置时不能只完成其中一个就调用 next。
5. 每次推进或回滚后重新读取完整位置清单，开始下一轮。
   校验失败时按错误说明修正产物并重新校验，不带错推进。

### 人工审核步骤

1. 按当前 exec 指令展示待审内容，并获取审核选项：`gate present --state "<statePath>"`。
2. 通过宿主提问工具呈现 payload 中的选项，等待用户明确选择，不自造选项，
   不替用户批准。
3. 按用户所选项的 `dispatch` 执行：推进型选择须在所有普通位置校验成功后执行；
   回滚或中止型选择按返回命令执行，不额外调用 next。
4. 相位内交互（提问、修改、回答 BQ 等）：先通过 `gate interact` 记录，再按当前
   步骤指令处理；处理完成后重新执行 `gate present` 请求用户选择，修改或提问
   不等于批准。多个门同时开启时，用 `--stage <stageId>` 指定交互目标；
   一次 `next --decision` 会把同一决议用于所有当前确认门，仅当用户明确批准
   全部待审内容且决议对各门都合法时才统一推进。

### 子流程与交付链收尾

- 任务执行中需要下沉子目标（如补充调研）时，以 `subflow start` 运行期创建；
  子流程复用同一执行循环（以返回的子 statePath 驱动）。存在 active 子流程时，
  父流程的 `next` 与 `run finish` 被拦截；子流程完成后以 `subflow close` 收口。
  命令细节与三层深度上限见 `subflow --help` 与 `status`。
- `closeout-worktree` 仅用于交付预设末段，进入时须为唯一当前位置；按该任务
  exec 指令的专属顺序完成产物入库、推进收口与 worktree 清理，外层不再重复
  validate、next、run finish 或 cleanup。

## 结束与异常

- `next` 返回 `completed: true` 且任务未自行收口时，执行
  `run finish --state "<statePath>" --status done`，再报告交付结果；
  不把阶段完成误当成已结束运行。
- 恢复时当前位置已为空：按 `status` / `resume` 返回的可用命令收口，
  不再调用 exec 或 next。
- 用户要求中止时以 `--status aborted` 收口；确定无法继续时说明原因并以
  `--status failed` 收口；普通校验失败先进入修正循环，不直接结束运行。
- 回退使用 `rollback --state "<statePath>" --stage "<stageId>"`，每次一个阶段，
  按返回的新位置重新执行（产物归档语义见其 `--help`）。
- 检查退出码与 stderr：0 成功、1 失败或被拦截、2 用法错误；普通命令 stdout 为
  JSON，exec stdout 为指令文本。
- 非 closeout-worktree 的 worktree 清理：finish 前读取有效任务目录中的
  `cleanup-worktree/prompt.md` 并保留必要路径与分支信息，finish 后按该任务清理；
  不擅自丢弃未提交变更或删除未合并分支。
- 执行 finish 前处理需保留的材料（临时模式的 runDir 在 finish 后会被删除）。

## 不可越界

- 声明的文档输出路径必须位于 runDir 内，不使用绝对路径或 `..` 逃逸；
  不手工搬移或删除 state 与产物。
- 不修改 skillRoot、`.gitignore` 或 git exclude。
- 不绕过校验、人工审核或 CLI 的位置检查。
- 不把用户未回复、代理推断或工具事件当成用户决议。
- 需要认证或交互式终端的命令交给用户执行，不代跑登录。
