# ddo-code-flow

**ddo-code-flow** 是一个可配置的 AI 编码流水线 skill。v4 的核心目标是把职责边界拆清楚：

- atom-task 只声明自己消费和产出的 artifact role。
- workflow 是唯一集成层，负责 stage 顺序、DAG 边、`taskRef`、节点 options 和确认门。
- config 只在运行时内存合成，来源是只读 skill 默认配置、项目配置和 run 参数。
- runtime 负责状态、artifact role 注入、worktree 创建、恢复和 metrics hook。

![Studio 截图](assets/image.png)

## v4 变化

- `config.json` 重命名为 `config.default.json`，作为只读 skill 默认配置，只在设计时编辑。
- 每个项目只维护一份 `.ddo/config.json`；首次 run 会自动创建 `.ddo/` 和 `.ddo/runs/`。
- worktree 创建在 `worktreeDir` 下；空 `worktreeDir` 表示项目父目录，因此默认 worktree 与项目同级。
- run 产物在运行期写入 worktree 内 `.ddo/runs/<type>/<dateDescription>/`，随分支合并回项目。
- atom-task frontmatter 使用 `produces` 和 `consumes`；具体路径由 runtime 通过 `atom-tasks/artifacts.json` 解析。
- skill 不写 `.gitignore` 或 git exclude；`.ddo/` 的 git 可见性完全交给用户控制。

## 仓库布局

```text
SKILL.md                                  # v4 指令型 runtime
config.default.json                       # 只读全局默认配置
config.schema.json                        # 默认配置、workflow、项目配置 schema
state.schema.json                         # run state schema 与字段归属
show_case.md                              # 当前 v4 端到端执行示例
workflows/*.json                          # pipeline 定义
atom-tasks/artifacts.json                 # artifact role 目录
atom-tasks/<name>/<name>.md               # atom-task v4 frontmatter + 指令
atom-tasks/<name>/*.output.schema.json    # 文档或 JSON 输出契约
scripts/metrics/                          # 可选 run 级 metrics 插件
ui/index.html + ui/studio.js              # 设计时静态 Studio
.claude/rules/                            # 仓库编码规则
```

## Run 模型

默认 run 结构：

```text
<project-parent>/
|-- <projectName>/                         # projectRoot
|   `-- .ddo/
|       |-- config.json                    # 项目级配置
|       `-- runs/                          # 合并回项目后的 run 产物，不含 worktree/src
|           `-- feat/YYYY-MM-DD-slug/
|               |-- worktree-info.json
|               |-- context-summary.md
|               |-- requirement.md
|               |-- spec.md
|               |-- plan.md
|               |-- test-plan.md
|               |-- tasks/task-group.json
|               |-- tasks/task-01.md
|               |-- verification.log
|               |-- execution-report.md
|               `-- reflection-report.md
`-- <projectName>-feat-YYYY-MM-DD-slug/    # worktreePath
    |-- source files
    `-- .ddo/runs/feat/YYYY-MM-DD-slug/
        |-- .state.json
        |-- worktree-info.json
        |-- context-summary.md
        |-- requirement.md
        |-- spec.md
        |-- plan.md
        |-- test-plan.md
        |-- tasks/task-group.json
        |-- tasks/task-01.md
        |-- verification.log
        |-- execution-report.md
        `-- reflection-report.md
```

通过 `.ddo/config.json` 修改 worktree 落点：

```json
{
  "$schema": "../config.schema.json#/$defs/projectConfig",
  "worktreeDir": "",
  "defaultRunType": "feat",
  "contextPaths": [],
  "atomTaskOverrides": {}
}
```

`show_case.md` 是当前 v4 布局的权威端到端示例。`docs/feat/2026-08-05-project-consistency-audit/show-case.md` 是本次需求交付物副本，并由契约测试保证与根目录 `show_case.md` 保持一致。

## 状态与产物

运行时产物流是 role-based：

- atom-task 通过 `produces` 和 `consumes` 声明 artifact role。
- `atom-tasks/artifacts.json` 把每个 role 映射到 `.ddo/runs/<type>/<dateDescription>/` 下的文件或目录。
- `.state.json.artifacts` 是 artifact blackboard，记录实际 role 路径，例如 `run://.ddo/runs/feat/YYYY-MM-DD-slug/spec.md`。
- 下游任务通过 `{{inputs.<role>}}` 接收路径，不应该猜测上游文件名。

运行时状态单独归属：

- `state.schema.json` 定义每个 `.state.json` 顶层字段。
- 每个 state 字段必须且只能有一个 `x-ddo-writer`。
- `runId` 初始为 `null`，由 `git-worktree` 设置为 `<projectName>-<branchName-with-slashes-replaced>`。
- `createdAt`、`workflowId`、`args`、`currentStage`、`stages`、`artifacts`、`pendingOutputs` 和 `history` 归 runtime 所有。
- `issueContext`、`gatePending` 和 `prInfo` 是仅有的 task-owned 顶层 state 字段，分别由 `issue-fetch`、`remote-gate` 和 `create-pr` 写入。

## 调用参数

- `--model <workflow-id>`：显式选择 workflow。
- `--feature`：将 run 标记为 `feat`。
- `--bugfix`：将 run 标记为 `fix`。

`--model` 是唯一的 workflow 选择参数。`--feature` 和 `--bugfix` 不参与 workflow 选择，只决定 run type，也就是分支前缀和 `.ddo/runs/<type>/...` 产物目录。如果 `--model` 不是精确 workflow id，则按 selection rules 匹配，再回退到默认 workflow。如果没有传 run type 标志，则从文本推断或使用 `defaultRunType`。

## Workflows

当前 workflows：

- `standard`：完整 requirement / spec / plan / test-plan / tasking / coding / verification / reporting / reflection 流程。
- `lightweight`：跳过 test-plan 和 tasking，适合小修、文档更新或快速迭代。
- `guarded`：启用 review，适合安全、迁移、公开接口或性能敏感变更。
- `issue-driven`：拉取 issue、使用远端确认门，然后生成交付文档和 PR 元数据。

## Atom-Task 契约

示例：

```yaml
---
name: spec
version: "4.0.0"
enabled: true
timeoutSec: 0
concurrency:
  parallelizable: false
confirmation:
  rejectAction: regenerate-with-feedback
consumes:
  - role: requirement
    required: true
  - role: context-summary
    required: false
produces:
  - role: spec
    kind: markdown
    primary: true
outputSchemaRef: "skill://atom-tasks/spec/spec.output.schema.json"
---
```

规则：

- atom-task frontmatter 不允许 `stage` 字段。
- atom-task frontmatter 和任务指令不允许具体 `run://...` 路径。
- atom-task 指令不允许点名上游 atom-task。
- 确认门只属于 workflow JSON。
- 新增 `.state.json` 顶层字段前，必须先在 `state.schema.json` 中声明。

## Metrics

Metrics 是可选的 run 级能力，不是 atom-task。详见 [docs/metrics.md](docs/metrics.md)。

## Studio

在 Chromium 系浏览器中打开 `ui/index.html`，然后选择 skill 目录。Studio 仅用于设计时编辑：它编辑 `config.default.json` 和 workflow JSON，不编辑项目 `.ddo/config.json`，也还没有实现完整 v4 role 可视化。

## 版本说明

- `SKILL.md` metadata version 是主 runtime 契约版本。
- `config.default.json` version 是默认配置契约版本。
- workflow `version` 跟踪 workflow 定义修订。
- atom-task `version` 跟踪单个任务的 frontmatter / 指令契约。

## 贡献规则

- schema、默认配置、任务定义、测试和文档需要同步修改。
- 使用新 artifact role 前，先添加到 `atom-tasks/artifacts.json`。
- 新增或修改 `.state.json` 顶层字段前，先更新 `state.schema.json`。
- runtime 机制留在 `SKILL.md`，不要复制进 atom-task 指令。
- `.ddo/` 的 git 可见性由用户控制；skill 永远不写 `.gitignore` 或 git exclude。

## License

[MIT License](LICENSE)
