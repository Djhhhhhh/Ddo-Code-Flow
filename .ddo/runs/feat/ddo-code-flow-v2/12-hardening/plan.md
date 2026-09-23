# 工作项 12 · hardening — 设计方案

> 版本：**v1.1（2026-09-24 已实现）**——D1–D4 全部来自用户指令（审计反馈），无遗留评审点；v1.0 定稿后完成实现与测试
> 需求依据：[requirement.md](./requirement.md)
> 契约基线：[../02-index-structure/plan.md](../02-index-structure/plan.md) v1.5（本轮升 v1.6）

## 1. A1 · 自定义链自包含（D1）

```text
run start    dirs 增记 tasksDir（绝对路径 = 启动时 --tasks-dir 的 resolve 值，缺省 = skillRoot
             的 atom-tasks——标准链与自定义链统一记录，resume 后不再猜）
消费方       exec / validate / next / rollback 四命令的 tasksDir 取值改为三级：
               ① --tasks-dir flag（显式覆盖，测试与临时替换用）
               ② state.dirs.tasksDir（run 的既定任务目录）
               ③ ATOM_TASKS_DIR（历史 state 无此字段时回落）
校验         assertDirs 增可选校验：出现即须绝对路径
效果         availableCommands 无需带 --tasks-dir（缺省链已指对目录）；
             自定义任务目录的 run 中断重续后按提示执行不再 ENOENT
```

不做的：workflowsDir 不记（预设启动时已物化进 state，后续无消费方——与 02 D8 一致）。

## 2. A2 · standard 预设（D2）

`workflows/standard.json`：00-overview 权威链（2026-09-22 与用户对齐）逐字落地，10 阶段线性：

```text
requirement → spec → plan → test-plan → tasking → coding
  → verification → review → reporting → reflection
```

- 与 basic 的关系：basic 是轻量链（无测试计划/验收/复审/复盘），standard 是全链；二者并存，
  `run start --workflow standard` 触达，`list workflows` 自然呈现；
- 不新造 DAG 结构（线性）；不加参数。

## 3. A3 · 不做（D3）

数据存储现状即满足（runs.jsonl + `~/.ddo/history/<runId>/.state.json`），零改动；
`list history` 挂账（08 O1 / 10 O2）。

## 4. D4 · 卫生包（变更范围评估）

| 项 | 范围 | 动作 |
|---|---|---|
| ~~package.json~~ | ~~engines/test 脚本~~ | **v1.2 移除（用户定版：保持纯目录零 npm 假设，`npm test` 无不可替代性）**；README / PR 模版回退裸命令 |
| ~~CI~~ | ~~单 workflow~~ | **不做（用户定版：快速迭代期不上 CI，提交前本地跑绿）** |
| PR / issue 模版 | `.github/` 三个 markdown（PR 检查单 + bug/feature issue 模板，含 ddo 流程符合性自查） | 新增 |
| 死枚举 | state.js 一行（grep 证实无写入方/消费方/测试断言） | 收敛 STATUS_ENUM 至实际 5 值 |
| 04 O4 | 一行（11 轮已定 runDir） | 关闭 |
| 全链 E2E 自动化 | 大（9+ 阶段产物夹具） | **不做**（dogfooding 即持续 E2E） |

## 5. 实现清单

| 文件 | 动作 |
|---|---|
| `tools/cli.js` | `tasksDirFor(f, state)` 助手；runStart `dirs.tasksDir`；四命令取值改三级 |
| `tools/lib/state.js` | assertDirs 增可选 tasksDir 校验；STATUS_ENUM 收敛 |
| `workflows/standard.json` | 新增（10 阶段线性） |
| `package.json` / ~~`.github/workflows/ci.yml`~~ | ~~新增~~（v1.2 起均移除/不做） |
| `tools/tests/lifecycle.test.js` | 增 1 用例：--tasks-dir 启动 → dirs.tasksDir 记录 → 后续命令免 flag 走 state |
| 台账 | 02 → v1.6；04 O4 关闭；README（standard 预设 / 仓库结构）；本工作项收尾记录 |

## 6. 测试计划

| 对象 | 用例 |
|---|---|
| tasksDir 自包含 | 自定义任务目录启动 → state 记录绝对路径；next（经门决议）免 flag 推进成功；flag 显式覆盖仍最高优 |
| standard 预设 | loadWorkflow 校验通过 + `list workflows` 呈现两预设（并入既有 list 测试断言面） |
| 回归 | 全量用例全绿 |

## 变更记录

| 版本 | 日期 | 说明 |
|---|---|---|
| v0.9 | 2026-09-24 | 初稿：D1–D4 全部来自用户指令，无开放评审点 |
| **v1.0** | 2026-09-24 | **定版**：随需求 D1–D4 直接定稿，进入实现 |
| **v1.1** | 2026-09-24 | **实现完成**：`tasksDirFor` 三级取值落六个消费方（rollback / validate / next / status / resume×2；run start 为写入方、listTasks 无 state 保持原样）；standard 预设启动冒烟通过（10 阶段物化 + tasksDir 记录）；卫生包落定（package.json / 枚举收敛 / 04 O4 关闭 / PR+issue 模版；CI 按用户指示移除——快速迭代期不上，README 注明本地跑绿）。测试：lifecycle 增自包含用例、list 增 standard 断言，全量 **78/78 绿**；台账联动：02 → v1.6 |
| **v1.2** | 2026-09-24 | **package.json 移除（用户定版）**：保持纯目录、零 npm 假设——零依赖下无 install/锁版本/分发场景，`npm test` 无不可替代性；README「开发与测试」与 PR 模版检查项回退 `node --test tools/tests/*.test.js` 裸命令。Node ≥18 约束由 README/badge 文字承载 |
