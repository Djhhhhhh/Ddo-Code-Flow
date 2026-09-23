# ddo-code-flow

**ddo-code-flow** 是一个面向 AI coding agent 的工程化流水线 skill：把「需求 → 规格 → 计划 → 编码 → 报告」拆成原子任务，由确定性 CLI 内核驱动，agent 每一步只拿到「恰好必需」的上下文（渐进式加载），产物按 schema 规范化。

## v2 核心思想

- **原子任务是积木**：每个任务自带指令（`prompt.md`）、相位声明与默认配置（`config.json`）、动态上下文钩子（可选 `<task>.js`）、输出契约（可选 `<task>.output.schema.json`）。
- **确认门是状态数据**：任务声明人审相位（含可选操作三元组），推进命令把门注册进 `stages[k].gate`，CLI 拦截「未决议就推进」，agent 只负责呈现与代跑。
- **workflow 只是预设**：预设（`workflows/*.json`）声明阶段顺序与 DAG 边；启动时物化进 `.state.json`，此后状态自包含，不再回指预设。
- **`.state.json` 是唯一事实源**：当前执行位置（`currentStage`，精确到相位）、阶段状态、run 级配置全部在此；命令现读现写。
- **确定性进内核，业务进 prompt**：DAG 推进、状态迁移、产物校验都在 `tools/cli.js`（Node，零依赖）；业务判断只存在于原子任务的指令里。
- **格式分界**：脚本读的一律 JSON，agent 读的一律 markdown——包括动态组装的 prompt。

## 快速开始

```bash
# 启动一个 run（读 workflows/basic.json，物化 state + 注册全局索引）
node tools/cli.js run start --title "实现某功能"

# 驱动循环（agent 每相位重复）：
node tools/cli.js exec --state <statePath> --task <stageId>   # 组装当前相位的 prompt（相位缺省=当前位置）
#   → agent 按组装出的 prompt 执行，产出/更新文档
node tools/cli.js validate --state <statePath> --task <stageId>   # 产物硬校验
node tools/cli.js next --state <statePath>                     # 推进（相位内 / 跨阶段）

# 确认门（next 输出 openedGates 时）：agent 呈现门的三元组（name/desc/action）→ 用户选择 → agent 代跑
node tools/cli.js next --state <statePath> --decision 同意       # 推进型决议（用户词汇）；转移型走声明的 rollback/finish；修改/提问为 in-phase 相位内交互

# 中断恢复（新会话接手：先发现，再加载）/ 回滚 / 结束 run
node tools/cli.js resume                                       # 全局列运行中的 run（位置/门概要）
node tools/cli.js resume --run-id <runId>                      # 加载选定 run 的完整状态（含 statePath）
node tools/cli.js status --state <statePath>                   # 已知 statePath 时：当前位置 + 门 + 可执行命令
node tools/cli.js rollback --state <statePath> --stage <stageId>
node tools/cli.js run finish --state <statePath> --status done
```

全局索引默认在 `~/.ddo/`（`index.json` 运行中指针 + `history/runs.jsonl` 追加式历史），可用 `DDO_HOME` 覆写。

## 命令集

| 命令 | 作用 |
|---|---|
| `run start` | 按预设装配启动 run：物化 `.state.json` + 注册 index（runId `YYYYMMDD-HHMMSS-<4hex>`）；首相位 human 即开门 |
| `exec` | 组装原子任务当前相位的 prompt（裸文本输出，渐进式加载；含 Output Contract 与交互硬约束注入）；**位置校验**：只服务 `currentStage` 内位置 |
| `validate` | 按任务 output 声明硬校验产物（存在性 / 必填 section / 列 / idPattern / 占位符 / jsonFields）；相位缺省 = 当前位置 |
| `next` | 纯状态推进：相位内前进（human 相位写门置 `waiting-human`）→ 阶段 done → DAG 就绪点亮；**门未关必须 `--decision <用户词汇>`**（如 同意；推进型决议留痕） |
| `rollback` | 回滚指定一个阶段：目标→当前路径上的节点重置为 pending，清除未关闭的确认门 |
| `run finish` | 生命周期收口：清 currentStage → history 追加一行 → index 移除 |
| `status` | 中断恢复定位（细节层，需 statePath）：当前位置 + 开着的门选项（gateOptions，含 in-phase）+ 派生的可执行命令（availableCommands） |
| `resume` | 断点重续入口（发现层，读全局 index）：惰性校验后列运行中 run 概要（多项目可见）；`--run-id` 加载完整状态视图 |

退出码：`0` 成功 · `1` 硬失败 · `2` 用法错误；stdout 输出 JSON（`exec` 为裸文本例外），stderr 输出人话。

## 仓库布局

```text
SKILL.md                          # agent 使用说明（skill 入口）
workflows/basic.json              # 预设：requirement → spec → plan → coding → reporting
atom-tasks/<name>/prompt.md       # 任务指令（<!-- @phase:NN --> 相位切片、@interact 标记）
atom-tasks/<name>/config.json     # 相位声明（type: action|human、可选 gate.options 三元组）、output 定位符、defaults
atom-tasks/<name>/<name>.js       # 可选 ctx 钩子：执行时基于 state 动态计算上下文
atom-tasks/<name>/<name>.output.schema.json   # 可选输出契约（meta-schema 管控）
atom-tasks/_schema/output-schema.schema.json  # 输出契约的 meta-schema
atom-tasks/_schema/task-config.schema.json    # 任务 config 标准格式（装配时校验，增量兼容）
tools/cli.js                      # 确定性执行内核（命令注册表即文档源）
tools/lib/                        # state / index-registry / history / assemble / output-schema / workflow / git-info …
tools/tests/                      # 沙箱隔离测试（64 用例）
.ddo/runs/feat/ddo-code-flow-v2/  # v2 设计文档（工作项 00–08）
```

## 配置分层

任务默认（`config.json.defaults`）< 用户级（`~/.ddo/atom-tasks.json`）< run 级（`state.atomTasks`）；标量覆盖、`rules` 数组逐层拼接。

## 测试

```bash
node tools/tests/cli.test.js && node tools/tests/start.test.js && node tools/tests/next.test.js \
  && node tools/tests/exec.test.js && node tools/tests/validate.test.js && node tools/tests/gate.test.js
```

## 设计文档

v2 的需求与定版方案按工作项归档在 `.ddo/runs/feat/ddo-code-flow-v2/`：00 总览、01 预清理、02 索引结构、03 工具框架、04 命令集、05 原子任务改造、06 工作流预设、07 执行节律与确认门、08 断点重续。后续规划中的轮次（并行多门决议粒度 / 严格用户亲跑通道 / 窗口绑定登记 / rollback 文档归档 / 用户级预设）见各工作项开放问题表。
