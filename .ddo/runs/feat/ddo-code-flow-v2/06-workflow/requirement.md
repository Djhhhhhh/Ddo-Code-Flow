# 工作项 06 · workflow — 工作流预设与 run 启动装配

> 状态：**已定版**（2026-09-22，plan v1.0，本轮实现 basic 预设 + run start + next）

关联：
- [../00-overview/overview.md](../00-overview/overview.md) —— 产品背景与定位（v2 共识起点）
- [../02-index-structure/plan.md](../02-index-structure/plan.md) v1.0 —— run 生命周期契约（runId 生成 / index 注册 / history 迁移 / `.state.json` 结构）
- [../04-cli-commands/requirement.md](../04-cli-commands/requirement.md) —— D2：`run start` 移交本轮（需动态组装/使用预设 workflow）；D9：`next` 推进语义
- [../05-atom-tasks/plan.md](../05-atom-tasks/plan.md) v1.4 —— D11 预设与事实源分离（workflow 只是预设，物化后 `.state.json` 是唯一事实源）；原子任务 v2 三件套（taskRef 的指向目标）

## 背景缺口

- 当前无法启动一个 run：`run start` 挂起（前置依赖本轮），index 注册随之缺失。
- `stages` 的产生方式未定义：谁定义、以什么形态定义、如何物化进 `.state.json`。
- `next`（O-C）挂起：需要 stages ↔ task 映射与 DAG 推进依据。

## 待设计问题（开放）

| # | 问题 | 状态 |
|---|---|---|
| Q1 | workflow 预设的定义结构（DAG 节点 / taskRef / dependOn / 节点选项）——确认门已排除（D2） | 结构提案已确认方向（stageId=任务名的最小 stages 数组），随 plan 定稿 |
| Q2 | ~~预设存放位置与作用域~~ | **已关闭（D3）**：仓库级 `workflows/` |
| Q3 | `run start` 的装配流程（预设 → stages 物化 → index 注册 → 运行目录创建） | 方向已定，细节随 plan |
| Q4 | ~~`next` 的推进语义~~ | **已关闭（D4）**：纯状态推进，依据全在任务 config；L3 状态机门仍归执行循环轮 |
| Q5 | start 参数：`--title` 必填；任务级参数（issue 号等）经 `state.atomTasks` 透传（05 配置层） | 已定；git 字段推断链见 D5，细节随 plan |

## 已确认决策

| # | 决策 | 依据 |
|---|---|---|
| D1 | **本轮目标：基础工作流打通整体链路**——仅 requirement → spec → plan → coding → reporting 五个阶段的线性链 | 用户定版（2026-09-22） |
| D2 | **确认门归属原子任务，workflow 不配置确认门**——确认语义由 taskRef 指向任务的自身配置携带（05 的 `phases[].type: human` + `@interact` 标记）；workflow 只管编排（顺序/DAG/taskRef），修正 v4 责任矩阵中「确认门属于 workflow JSON」的表述 | 用户定版（2026-09-22） |
| D3 | **预设存放仓库级 `workflows/` 目录**（与 atom-tasks 并列）——预设引用本仓任务，随版本走；用户级自定义等真实需求出现再加 | 用户确认（2026-09-22） |
| D4 | **next 不携带任何相位/状态配置**——推进依据（相位序列、`type: action\|human`）全部来自原子任务 config 自带的声明；next 只是按任务声明驱动的纯状态操作 | 用户定版（2026-09-22） |
| D5 | **git 字段的注册归属与推断链**：`git.*` 信息由 **git-worktree 任务负责注册**；未使用 worktree 时由 `run start` 用当前仓库信息推断；非 git 环境置空（02 契约「`git.mainBranch` 必填」相应放宽为**字段必存、值可空**）。判断链：worktree 注册值 → 当前仓库推断 → 置空 | 用户定版（2026-09-22） |

## 变更记录

| 版本 | 日期 | 说明 |
|---|---|---|
| v0.1 | 2026-09-22 | 立项：目录与骨架，梳理背景缺口与开放问题，等待需求描述 |
| v0.2 | 2026-09-22 | 需求输入定版 D1/D2：基础五阶段线性链（requirement→spec→plan→coding→reporting）打通链路；确认门归属原子任务自带配置，workflow 只管编排 |
| v0.3 | 2026-09-22 | 定版 D3/D4/D5：预设存仓库级 `workflows/`；next 零自带配置（推进依据全在任务 config 声明）；git 字段由 git-worktree 注册、start 推断链（worktree 注册值 → 仓库推断 → 置空，02 契约 mainBranch 放宽为字段必存值可空）；预设结构提案（stageId=任务名）方向确认 |
| **v1.0** | 2026-09-22 | **定版**：plan v1.0（P1–P4 定稿），进入实现 |
