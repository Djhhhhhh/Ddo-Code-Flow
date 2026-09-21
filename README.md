# ddo-code-flow

**ddo-code-flow** 是一个面向 AI coding agent 的工程化流水线 skill：把「需求 → 规格 → 计划 → 编码 → 报告」拆成原子任务，由确定性 CLI 内核驱动，agent 每一步只拿到「恰好必需」的上下文（渐进式加载），产物按 schema 规范化。

## v2 核心思想

- **原子任务是积木**：每个任务自带指令（`prompt.md`）、相位声明与默认配置（`config.json`）、动态上下文钩子（可选 `<task>.js`）、输出契约（可选 `<task>.output.schema.json`）。
- **workflow 只是预设**：预设（`workflows/*.json`）声明阶段顺序与 DAG 边；启动时物化进 `.state.json`，此后状态自包含，不再回指预设。
- **`.state.json` 是唯一事实源**：当前执行位置（`currentStage`，精确到相位）、阶段状态、run 级配置全部在此；命令现读现写。
- **确定性进内核，业务进 prompt**：DAG 推进、状态迁移、产物校验都在 `tools/cli.js`（Node，零依赖）；业务判断只存在于原子任务的指令里。
- **格式分界**：脚本读的一律 JSON，agent 读的一律 markdown——包括动态组装的 prompt。

## 快速开始

```bash
# 启动一个 run（读 workflows/basic.json，物化 state + 注册全局索引）
node tools/cli.js run start --title "实现某功能"

# 驱动循环（agent 每阶段重复）：
node tools/cli.js exec --state <statePath> --task <stageId> --phase <NN>   # 组装当前相位的 prompt
#   → agent 按组装出的 prompt 执行，产出/更新文档
node tools/cli.js validate --state <statePath> --task <stageId>            # 产物硬校验
node tools/cli.js next --state <statePath>                                 # 推进（相位内 / 跨阶段）

# 回滚一个阶段（DAG 路径重置）/ 结束 run（迁移历史）
node tools/cli.js rollback --state <statePath> --stage <stageId>
node tools/cli.js run finish --state <statePath> --status done
```

全局索引默认在 `~/.ddo/`（`index.json` 运行中指针 + `history/runs.jsonl` 追加式历史），可用 `DDO_HOME` 覆写。

## 命令集

| 命令 | 作用 |
|---|---|
| `run start` | 按预设装配启动 run：物化 `.state.json` + 注册 index（runId `YYYYMMDD-HHMMSS-<4hex>`） |
| `exec` | 组装原子任务当前相位的 prompt（裸文本输出，渐进式加载；含 Output Contract 与交互硬约束注入） |
| `validate` | 按任务 output 声明硬校验产物（存在性 / 必填 section / 列 / idPattern / 占位符 / jsonFields） |
| `next` | 纯状态推进：相位内前进（human 相位置 `waiting-human`）→ 阶段 done → DAG 就绪点亮 |
| `rollback` | 回滚指定一个阶段：目标→当前路径上的节点重置为 pending |
| `run finish` | 生命周期收口：清 currentStage → history 追加一行 → index 移除 |

退出码：`0` 成功 · `1` 硬失败 · `2` 用法错误；stdout 输出 JSON（`exec` 为裸文本例外），stderr 输出人话。

## 仓库布局

```text
SKILL.md                          # agent 使用说明（skill 入口）
workflows/basic.json              # 预设：requirement → spec → plan → coding → reporting
atom-tasks/<name>/prompt.md       # 任务指令（<!-- @phase:NN --> 相位切片、@interact 标记）
atom-tasks/<name>/config.json     # 相位声明（type: action|human）、output 定位符、defaults
atom-tasks/<name>/<name>.js       # 可选 ctx 钩子：执行时基于 state 动态计算上下文
atom-tasks/<name>/<name>.output.schema.json   # 可选输出契约（meta-schema 管控）
atom-tasks/_schema/output-schema.schema.json  # 输出契约的 meta-schema
tools/cli.js                      # 确定性执行内核（命令注册表即文档源）
tools/lib/                        # state / index-registry / history / assemble / output-schema / workflow / git-info …
tools/tests/                      # 沙箱隔离测试（41 用例）
.ddo/runs/feat/ddo-code-flow-v2/  # v2 设计文档（工作项 00–06）
```

## 配置分层

任务默认（`config.json.defaults`）< 用户级（`~/.ddo/atom-tasks.json`）< run 级（`state.atomTasks`）；标量覆盖、`rules` 数组逐层拼接。

## 测试

```bash
node tools/tests/cli.test.js && node tools/tests/start.test.js && node tools/tests/next.test.js \
  && node tools/tests/exec.test.js && node tools/tests/validate.test.js
```

## 设计文档

v2 的需求与定版方案按工作项归档在 `.ddo/runs/feat/ddo-code-flow-v2/`：00 总览、01 预清理、02 索引结构、03 工具框架、04 命令集、05 原子任务改造、06 工作流预设。后续规划中的轮次（执行循环 / L3 交互状态机门 / rollback 文档归档 / 用户级预设）见各工作项开放问题表。
