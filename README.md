# ddo-code-flow

**ddo-code-flow** 是一个可配置的 AI 编码流水线 skill。v5 将业务任务、编排、配置与运行时状态分开管理：

- atom-task 只声明业务指令、输入/输出 artifact role 和任务选项。
- workflow 负责 stage 顺序、DAG、`taskRef`、节点选项与确认门。
- config 只参与运行时内存合成，不生成每次 run 的有效配置副本。
- runtime 负责 DAG 校验、输入注入、产物登记、节点完成、状态写入、worktree 状态接入与恢复。
- git worktree 的创建和清理由对应 atom-task 执行，runtime 只校验并接入最终路径。

![Studio 截图](assets/image.png)

## v5 变化

- `register-artifact` 只登记产物并写入 `artifact-registered`，不再隐式完成节点。
- 所有已声明产物登记完成后，由 `complete-node` 统一写入 `node-done`；零产物任务也走同一完成流程。
- worktree 创建前的 state 位于项目内 `.ddo/runs/.pending/<bootstrapId>/.state.json`。
- `attach-worktree` 接入最终路径、刷写 pending outputs、登记 `worktree-info`，再迁移 state。
- `done` 是 runtime 保留终态，不是 workflow stage；issue-driven 的最后一个真实 stage 是 `cleanup`。
- `--model` 必须精确匹配已登记 workflow id，未知值直接失败。
- output schema 先通过 meta-schema 校验，产物内容也必须在原子登记前通过校验。

## 仓库布局

```text
SKILL.md                                  # v5 运行协议
config.default.json                       # 只读默认配置与 workflow 索引
config.schema.json                        # 默认、项目配置与 workflow schema
state.schema.json                         # run state 与唯一 writer 契约
show_case.md                              # 受契约测试保护的衍生执行示例
workflows/*.json                          # pipeline 定义
atom-tasks/artifacts.json                 # artifact role 目录
atom-tasks/<name>/<name>.md               # atom-task frontmatter 与业务指令
atom-tasks/<name>/*.output.schema.json    # 输出结构与内容契约
scripts/runtime/                          # 确定性运行时与测试
scripts/metrics/                          # 可选 run 级 metrics 插件
ui/                                       # 设计时 Studio
```

schema、仓库规则和 runtime 是行为事实源；`show_case.md` 仅用于展示一条符合契约的完整执行路径。

## Run 模型

worktree 创建前，runtime 先持久化 bootstrap state：

```text
<projectRoot>/.ddo/
|-- config.json
`-- runs/
    `-- .pending/
        `-- <bootstrapId>/
            `-- .state.json
```

此时生成的产物由 runtime 以 base64 结构写入 `pendingOutputs`。git-worktree 任务创建 worktree 后调用 `attach-worktree`，最终结构为：

```text
<worktreePath>/
|-- source files
`-- .ddo/runs/<type>/<dateDescription>/
    |-- .state.json
    |-- worktree-info.json
    |-- context-summary.md
    |-- requirement.md
    |-- spec.md
    |-- plan.md
    |-- test-plan.md
    |-- tasks/task-group.json
    |-- tasks/task-01.md
    |-- code-change.json
    |-- verification.log
    |-- execution-report.md
    `-- reflection-report.md
```

attach 成功后，runtime 刷写全部 pending outputs、写入最终 state，并在 bootstrap 目录留下 relocation marker 后删除旧 state。产物随分支合并回项目的 `.ddo/runs/<type>/<dateDescription>/`；skill 不修改 `.gitignore` 或 git exclude。

## 项目配置

项目只维护 `<projectRoot>/.ddo/config.json`。示例：

```json
{
  "worktreeDir": "",
  "defaultRunType": "feat",
  "contextPaths": [],
  "atomTaskOverrides": {
    "coding": {
      "model": "sonnet"
    }
  }
}
```

runtime 使用 skill 内的 `config.schema.json#/$defs/projectConfig` 校验该文件，然后按“默认配置 < 项目配置 < 显式 run 配置 override”合成。项目扁平字段会映射到有效配置的 `base`；选择参数不会混入配置根。

## 入口参数

- `--model <workflow-id>`：精确选择 `standard`、`lightweight`、`guarded` 或 `issue-driven`；未知 id 失败。
- `--feature`：将 run type 设为 `feat`。
- `--bugfix`：将 run type 设为 `fix`；不能与 `--feature` 同时使用。
- `--ctx <path>` / `--context <path>`：为当前 run 追加上下文，不写入项目配置。
- `--atom <task-name>`：只执行指定 atom-task，不运行完整 pipeline。

未提供 `--model` 时，selection rules 只匹配用户需求文本，之后回退到默认 workflow。`--feature` 和 `--bugfix` 只决定 run type，不参与 workflow 选择。

## Workflows

- `standard`：完整 requirement、spec、planning、test-plan、tasking、coding、verification、reporting、reflection 流程。
- `lightweight`：省略 test-plan 和 tasking，适合小修或文档更新。
- `guarded`：启用 review，适合安全、迁移、公开接口或性能敏感变更。
- `issue-driven`：读取 issue，经过三个远端确认门，生成交付文档和 PR 元数据，最后执行真实 `cleanup` stage。

仓库没有 `research` workflow；`--model research` 会明确失败。需求文本中的“调研”仍可由规则选择 `lightweight`。

## 状态与产物

- atom-task 通过 `produces` 和 `consumes` 声明 role；`produces` 必填但允许 `[]`。
- `atom-tasks/artifacts.json` 将 role 映射到固定文件；`stage-artifact` 是 runtime 解析的动态输入 role。
- required 输入缺失会阻止节点执行；optional 输入缺失会注入空值并记录 `optional-input-missing`。
- `register-artifact` 先校验内容，再原子落盘或进入 `pendingOutputs`，并记录 `artifact-registered` 或 `artifact-pending`。
- `complete-node` 独立检查节点全部声明产物的 producer、stage、路径和 pending 状态，成功后才记录 `node-done`。
- `advance-stage` 校验节点、确认门、pending outputs、required binding 和终态不变量后推进。

所有 state 写入都经过 `applyMutation(state, patch, writer)`。`type`、`gatePending`、`currentStage`、`stages`、`artifacts`、`pendingOutputs` 和 `history` 由 runtime 持有；`runId`、`worktreePath`、`dateDescription` 与 `artifactDir` 由 git-worktree writer 通过 `attach-worktree` 更新；`issueContext` 和 `prInfo` 分别归 issue-fetch 与 create-pr writer。atom-task 不直接编辑 `.state.json`。

## Atom-Task 契约

```yaml
---
name: spec
version: "5.0.0"
enabled: true
timeoutSec: 0
concurrency:
  parallelizable: false
confirmation:
  rejectAction: regenerate-with-feedback
consumes:
  - role: requirement
    required: true
produces:
  - role: spec
    kind: markdown
    primary: true
outputSchemaRef: "skill://atom-tasks/spec/spec.output.schema.json"
---
```

frontmatter 使用零依赖受限 YAML：支持 block 结构以及精确的空容器 `[]`、`{}`，拒绝其他 flow-style 写法并报告文件与行号。任务名、目录名、文件名和 `frontmatter.name` 必须一致；同一任务最多有一个 primary 产物。

## 恢复与终态

`find-resumable` 同时识别：

- `bootstrap`：state 位于项目 `.ddo/runs/.pending/`，worktree 尚未接入。
- `worktree`：state 位于最终 `artifactDir`，且 worktree 路径存在。

候选按 `bootstrapId` 去重并优先最终 state。只有所有 enabled stage 已完成、全局没有 pending output 或 pending gate、没有运行中/失败/等待人工的 stage，且已完成节点的产物仍可解析时，runtime 才把 `currentStage` 设为 `done`。

## Metrics 与 Studio

Metrics 是可选的 run 级能力，不属于 atom-task 或 workflow stage，详见 [docs/metrics.md](docs/metrics.md)。Studio 是设计时工具，用于编辑默认配置和 workflow，不参与运行期状态写入。

## 贡献规则

- schema、默认配置、任务定义、测试和文档必须同步。
- 使用新 role 前先登记到 `atom-tasks/artifacts.json`。
- 新增 state 顶层字段前先声明唯一非空 `x-ddo-writer`。
- runtime 机制保留在 `SKILL.md`；atom-task 只保留业务指令和 runtime 命令调用。
- 运行时不得写入 `skillRoot`，也不得修改 git 可见性设置。

## License

[MIT License](LICENSE)
