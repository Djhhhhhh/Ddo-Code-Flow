# Ddo-Code-Flow v5 执行示例

本文以一次 issue-driven run 展示 v5 的实际执行路径。schema、仓库规则与 runtime 是行为事实源；本文是受仓库契约测试保护的衍生示例。

## 1. 场景

| 项目 | 示例值 |
|---|---|
| projectRoot | `D:/work/demo-app` |
| 用户输入 | `按 issue #42 完成整改` |
| workflow | `issue-driven` |
| run type | `fix` |
| 分支 | `fix/2026-08-29-runtime-contract` |
| worktreePath | `D:/work/demo-app-fix-2026-08-29-runtime-contract` |

显式选择只能使用已登记 id：`standard`、`lightweight`、`guarded`、`issue-driven`。例如 `--model research` 会失败，不会按关键词降级。

## 2. 配置与 bootstrap

runtime 校验并在内存中合成 `config.default.json`、项目 `.ddo/config.json` 与显式 run 配置 override。`model`、`feature`、`bugfix`、`ctx` 和 `atom` 属于 run 参数，不会被合并到配置根。

worktree 创建前，`init-state` 返回 state 与持久化路径：

```text
D:/work/demo-app/.ddo/runs/.pending/<bootstrapId>/.state.json
```

初始状态的关键字段如下：

```json
{
  "runId": null,
  "bootstrapId": "<uuid>",
  "workflowId": "issue-driven",
  "projectRoot": "D:/work/demo-app",
  "worktreePath": null,
  "skillName": "ddo-code-flow",
  "skillVersion": "5.0.0",
  "type": "fix",
  "dateDescription": null,
  "artifactDir": null,
  "currentStage": "context",
  "pendingOutputs": {},
  "artifacts": {}
}
```

context 在 worktree 前生成 `context-summary`。`register-artifact` 先校验内容，再由 runtime 写入结构化 pending output：

```json
{
  "context-summary": {
    "role": "context-summary",
    "producer": "context",
    "task": "context",
    "stage": "context",
    "encoding": "base64",
    "content": "PGJhc2U2NCBjb250ZW50Pg==",
    "contentHash": "<sha256>",
    "outputSchemaRef": "skill://atom-tasks/context/context.output.schema.json",
    "createdAt": "2026-08-29T10:00:00.000Z"
  }
}
```

调用方不自行编辑 `pendingOutputs`。

## 3. worktree 接入

git-worktree atom-task 负责执行 `git worktree add` 并生成 `worktree-info` JSON，然后调用：

```text
node <skillRoot>/scripts/runtime/ddo.js attach-worktree \
  --skill-root <skillRoot> \
  --state <bootstrapStatePath> \
  --run-id demo-app-fix-2026-08-29-runtime-contract \
  --worktree-path D:/work/demo-app-fix-2026-08-29-runtime-contract \
  --date-description 2026-08-29-runtime-contract \
  --artifact-dir D:/work/demo-app-fix-2026-08-29-runtime-contract/.ddo/runs/fix/2026-08-29-runtime-contract
```

runtime 验证绝对路径和目录边界，更新 git-worktree owned 字段，按创建时间刷写 pending outputs，登记 `worktree-info`，并把 state 迁移到：

```text
<worktreePath>/.ddo/runs/fix/2026-08-29-runtime-contract/.state.json
```

同一 `bootstrapId` 的重复 attach 会复用最终 state，不会让旧 bootstrap 覆盖较新的执行进度。

## 4. issue-driven pipeline

| stage | 节点 | 主要输入 | 产出 |
|---|---|---|---|
| context | context | runtime 上下文 | `context-summary` |
| requirement | issue-fetch | issue 参数 | `issue-context` |
| requirement | requirement | `issue-context` | `requirement` |
| requirement | git-worktree | `requirement` | `worktree-info` |
| spec | spec | `requirement`、可选 `context-summary` | `spec` |
| spec | remote-gate-spec | 当前 stage primary 产物 | 无业务产物 |
| planning | plan | `spec`、可选 `context-summary` | `plan`、`plan-parts`、`tech-design` |
| planning | remote-gate-plan | 当前 stage primary 产物 | 无业务产物 |
| test-plan | test-plan | `spec` | `test-plan` |
| test-plan | remote-gate-test-plan | 当前 stage primary 产物 | 无业务产物 |
| tasking | tasking | `plan`、`test-plan` | `tasks-dir`、`task-group` |
| coding | coding | 计划、任务和可选验证记录 | `code-change` |
| verification | verification | `spec` 与测试计划 | `verification-log` |
| delivery | delivery-doc、create-pr | 已登记交付产物 | `delivery-doc`、`pr-info` |
| cleanup | cleanup-worktree | `worktree-info`、可选 `pr-info` | 无业务产物 |

`cleanup` 是最后一个真实 stage。`done` 只可能出现在 state 的 `currentStage`，不出现在 workflow pipeline。

## 5. 节点生命周期

每个节点都遵循“注入、执行、登记、完成”：

1. `next-node` 使用统一 effective-node 结果，按“workflow override > project/effective config override > node > task default”合并 `enabled` 与 options。
2. required role 缺失时硬失败；optional role 缺失时注入空字符串并记录审计事件。
3. `register-artifact` 在原子写入前校验 output schema，成功后写 `artifact-registered`；worktree 未就绪时写 `artifact-pending`。
4. 所有声明 role 登记后调用 `complete-node`，由它单独写入 `node-done`。

多产物节点只登记第一个 role 时不会提前完成；`remote-gate` 和 `cleanup-worktree` 的 `produces: []` 也必须调用 `complete-node`。

典型 history 顺序：

```json
[
  { "event": "artifact-registered", "stage": "spec", "node": "spec", "role": "spec", "at": "..." },
  { "event": "node-done", "stage": "spec", "node": "spec", "task": "spec", "at": "..." },
  { "event": "gate-pending", "stage": "spec", "cycleId": "...", "at": "..." },
  { "event": "gate-approved", "stage": "spec", "cycleId": "...", "at": "..." }
]
```

## 6. 远端确认门

三个 remote-gate 节点复用同一个零产物 atom-task。任务只判断应调用 `approved`、`rejected` 还是 `pending`；真正的 `gatePending`、stage status 和 history 由 `gate` CLI 持久化。

- `approved`：清理 pending gate 并允许推进。
- `rejected`：保存反馈并进入 rework，反馈仅作为数据，不作为命令执行。
- `pending`：写入 pending 状态并返回 exit `77`，`currentStage` 仍保持真实 stage。

## 7. 状态写入与恢复

所有顶层字段都在 `state.schema.json` 中声明唯一非空 `x-ddo-writer`。atom-task 通过 `set-issue-context`、`record-node-progress`、`request-retry`、`record-cleanup-result` 等 runtime 命令提交受限意图，不直接编辑 `.state.json`。

`find-resumable` 返回两种候选：

- `bootstrap`：位于项目 `.pending`，允许 `worktreePath=null`。
- `worktree`：位于最终 artifactDir，worktree 路径存在。

两类候选按 `bootstrapId` 去重，最终 state 优先。

## 8. 收尾

cleanup-worktree 默认只允许非强制的 `git worktree remove` 和 `git branch -d`。dirty worktree、未合并分支或无需清理时记录 `cleanup-skipped`；只有 `forceCleanup=true` 且获得明确批准时才允许强制清理。

cleanup 节点完成后，`advance-stage` 再检查：

- 所有 enabled stage 已完成。
- 全局 `pendingOutputs` 为空。
- `gatePending` 不处于 pending。
- 没有 running、failed、waiting-human 状态。
- 已完成节点的声明产物仍有正确登记且路径可解析。

全部满足后，runtime 才写入 `currentStage: "done"`。这表示 run 终止，不代表存在名为 `done` 的 stage。
