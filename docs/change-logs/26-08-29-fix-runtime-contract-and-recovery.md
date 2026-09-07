# 修复运行时契约与恢复链路

## 背景

历史文档曾承诺 worktree 创建前支持延迟产物，但旧 runtime 没有完整实现 bootstrap state、pending output 刷写与迁移。本次按 Issue #42 补齐该链路，并统一任务、workflow、schema 与运行时之间的职责边界。

## 行为变化

- `register-artifact` 不再等同于节点完成。它只校验并登记产物，history 事件为 `artifact-registered`。
- 新增 `complete-node`。节点全部声明产物登记完成后才能写入 `node-done`；单产物、多产物和零产物任务使用同一规则。
- 新增 `attach-worktree`。它接入最终 worktree 字段、刷写 pending outputs、登记 `worktree-info`，并将 bootstrap state 迁移到最终 artifactDir。
- `init-state` 新增 `bootstrapId`，输出改为 `{ statePath, state }`，并持久化到 `<projectRoot>/.ddo/runs/.pending/<bootstrapId>/.state.json`。
- `find-resumable` 同时支持 bootstrap 与 worktree 两种恢复候选，并按 `bootstrapId` 去重。
- `state.schema.json` 将 `pendingOutputs` 改为带 base64 内容、hash 和来源信息的结构化记录；artifact record 可记录 task；所有顶层字段必须有唯一非空 writer。
- issue-driven 删除重复的 `gate-result` 业务产物；remote-gate 改为零产物任务，`gate` CLI 负责状态持久化。
- issue-driven 使用真实 `cleanup` stage 收尾；`done` 仅保留为 runtime 终态。
- `--model` 只接受已登记 workflow id；未知值（包括 `research`）明确失败，不再按关键词降级。
- output schema 新增 meta-schema 与内容 validator，登记前检查 JSON、Markdown 和特定跨字段约束。
- `skill://`、`project://`、`run://` 拒绝缺失根目录和 `..` 路径越界。

## 迁移说明

本次变更升级到 `5.0.0`，不兼容依赖旧 `init-state` 裸 state 输出、旧 pendingOutputs 字符串值、登记产物即完成节点、或 workflow 内 `done` stage 的调用方。调用方需要保存 `init-state.statePath`，在 worktree 创建后改用 `attach-worktree` 返回的新路径，并在登记全部产物后显式调用 `complete-node`。

历史 change log 不作改写；旧的延迟写入描述作为当时设计记录保留，本次才由 runtime 完整实现。
