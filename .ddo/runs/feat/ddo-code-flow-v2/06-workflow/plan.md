# 工作项 06 · workflow — 设计方案

> 版本：**v1.0（2026-09-22 已定版）**——P1–P4 评审点全部按建议定稿，进入实现
> 需求依据：[requirement.md](./requirement.md)（决策 D1–D5）
> 契约基线：[../02-index-structure/plan.md](../02-index-structure/plan.md) v1.0（生命周期 / runId / index / stages 生成契约）；[../05-atom-tasks/plan.md](../05-atom-tasks/plan.md) v1.4（config.phases 声明 / D11 预设与事实源分离）

## 1. 目标与范围

打通「预设 → run 启动 → 阶段推进」的整体链路：

1. `workflows/basic.json` —— 基础五阶段线性链预设（D1）
2. `run start` —— 读预设，物化 `.state.json` 并注册 index（02 §7 启动段）
3. `next` —— 零自带配置的纯状态推进命令（D4）
4. 测试（沙箱隔离，沿用 04/05 模式）

**不做**（归属后续轮次）：L3 状态机门与 `waiting-human` 的进入/离开强制（执行循环轮）；rollback `_del` 归档；用户级预设；同一任务多次出现的预设扩展；`run show` / `list`。

## 2. workflow 预设

### 2.1 文件格式

仓库级 `workflows/`（D3），脚本读 → JSON（D7）。一个预设一个文件：

```json
{
  "name": "basic",
  "version": "1.0.0",
  "description": "基础链路：requirement → spec → plan → coding → reporting",
  "stages": [
    { "task": "requirement", "dependOn": [] },
    { "task": "spec",        "dependOn": ["requirement"] },
    { "task": "plan",        "dependOn": ["spec"] },
    { "task": "coding",      "dependOn": ["plan"] },
    { "task": "reporting",   "dependOn": ["coding"] }
  ]
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `name` | ✔ | 预设名（= 文件名主干）；`run start --workflow` 引用 |
| `version` | ✔ | 预设自身版本 |
| `description` | ✖ | 一句话说明（人读） |
| `stages[].task` | ✔ | taskRef：指向 `atom-tasks/<task>/`；**stageId = task 名**（物化后 stages 的 key、currentStage/rollback/exec 三处命名自然对齐） |
| `stages[].dependOn` | ✔（可为空） | 依赖的 stageId 列表（DAG 边） |

**不含**：确认门（D2——随任务 config 走）、业务指令、产物路径（workflow 层职责边界）。

### 2.2 加载校验（fail fast，启动时报错不产生半截 run）

1. 结构：必填字段齐全，`stages` 非空，`task` 名合法（`^[A-Za-z0-9][A-Za-z0-9._-]*$`）
2. 任务存在：`atom-tasks/<task>/` 含 `prompt.md` + `config.json`
3. DAG 合法：`dependOn` 引用的 stageId 存在；无环；无重复 task
4. 校验在代码内实现（loader 函数），不设独立 schema 文件

## 3. `run start`

### 3.1 命令契约

```
run start --title <text> [--workflow basic] [--type feat] [--dir-name <text>]
          [--project <path>] [--workflows-dir <path>] [--tasks-dir <path>]
```

| flag | 必填 | 说明 |
|---|---|---|
| `--title` | ✔ | run 标题（02 §5.2：人类可读描述；本命令不生成，调用方给） |
| `--workflow` | | 预设名，缺省 `basic` |
| `--type` | | run 类型（目录第一段），缺省 `feat` |
| `--dir-name` | | 目录第二段（dateDescription），缺省 = runId（唯一且排序友好；要可读性时显式传） |
| `--project` | | 项目根，缺省 cwd |
| `--workflows-dir` / `--tasks-dir` | | 测试/扩展用，缺省仓库内目录 |

输出（stdout JSON）：`{ runId, title, statePath, workflow, currentStage }`。

### 3.2 装配流程（02 §7 启动段）

1. **加载校验预设**（§2.2）
2. **计算 runId**（02 §5.2.1：`YYYYMMDD-HHMMSS-<4hex>`）：生成后查 index——已存在且 statePath 不同则重掷随机后缀重试（上限 5 次）
3. **git 推断**（D5 判断链）：
   - `git rev-parse --is-inside-work-tree`（cwd=project）失败（非 git）→ `git: { "mainBranch": "" }`（字段必存、值可空——02 契约修正，见 §7）
   - 是 git → mainBranch 推断链：`git symbolic-ref refs/remotes/origin/HEAD`（如 `refs/remotes/origin/main` → `main`）→ `git config init.defaultBranch` → 常量 `main`
   - `releaseBranch` / `developmentBranch` / `worktreePath` **不填**（归 git-worktree 任务注册，D5）
4. **物化 state**（D11：预设只是预设，物化后自包含、不回指）：
   - 目录：`<project>/.ddo/runs/<type>/<dirName>/`（递归创建）
   - `stages`：预设逐项展开 → `{ status: "pending", dependOn, at: now }`
   - `currentStage`：DAG 就绪（dependOn 全 done/pending-only 起点）的第一项 → `<stageId>:01`；该阶段 status 按其 config 首相位类型置 `running`（action）或 `waiting-human`（human）
   - 其余字段：`runId` / `title` / `startedAt`（ISO，沿用现有 nowIso 的 UTC 格式）
5. **注册 index**：`~/.ddo/index.json` 写入 `runId → { statePath, startedAt }`（持锁 + 原子写；`register` 本轮引入 index-registry）

不自动执行第一个阶段（exec 归 exec，命令单一语义）。

## 4. `next`

### 4.1 命令契约

```
next --state <path> [--tasks-dir <path>]
```

### 4.2 推进语义（D4：依据全在任务 config，next 零配置）

对 `currentStage` 的每个 entry（基础链只有一个）：

1. **相位内推进**：读 `atom-tasks/<stageId>/config.json` 的 `phases`（无声明 = 单相位 `01`）
   - 存在下一相位 → entry 变为 `<stageId>:<下一相位>`；阶段 status 按新相位类型置 `running`（action）/ `waiting-human`（human）
2. **阶段收尾**：相位耗尽 → `stages[stageId].status = done`
3. **DAG 推进**：重算就绪集（pending 且 dependOn 全 done）→ 全部进入 `currentStage`（`<id>:01`，status 按各自首相位类型）；基础线性链恒为一个
4. **终点**：无就绪阶段 → `currentStage = []`，返回 `{ completed: true }`——**不自动 `run finish`**（生命周期唯一入口保持 run finish，04 D6）
5. 每次状态变更刷新 `at`

next **不校验产物完成度**（归 validate / 执行循环修正闭环）；**不强制 waiting-human 的离开条件**（L3，执行循环轮）——本轮 status 只是忠实表达相位类型的数据。

边界报错：`currentStage` 为空 → 硬失败「无待推进阶段（run 已结束或未启动）」。

## 5. 实现清单

| 文件 | 动作 | 内容 |
|---|---|---|
| `workflows/basic.json` | 新增 | §2.1 五阶段预设 |
| `tools/lib/workflow.js` | 新增 | 预设加载校验（§2.2）+ stages 物化展开 |
| `tools/lib/git-info.js` | 新增 | D5 git 推断链（is-inside-work-tree / mainBranch 链） |
| `tools/lib/index-registry.js` | 扩展 | 新增 `register(runId, {statePath, startedAt})`（幂等覆盖 + 持锁原子写） |
| `tools/cli.js` | 扩展 | 登记 `run start`（run 域）与 `next`（顶层动词，03 §3.4 执行原语） |
| `tools/tests/{start,next}.test.js` | 新增 | §6 用例 |

## 6. 测试计划（沙箱：mkdtemp + DDO_HOME 指内 + finally 递归删）

| 命令 | 用例 |
|---|---|
| 预设加载 | 结构缺失 / 任务不存在 / dependOn 引用不存在 / 环 / 重复 task → 各自报错；合法预设通过 |
| run start | state 结构与 02 §5 断言一致；stages 全 pending + 首阶段 running + currentStage 起点；index 注册成对；非 git 目录 → mainBranch 为空串；git 仓库（沙箱 `git init`）→ 推断 mainBranch；runId 碰撞重试（预置同 runId 不同 statePath 的 index） |
| next | 单相位任务（requirement）→ done + 下一阶段就绪；多相位（spec:01→:02 且 status=waiting-human）；:02 → 阶段 done + plan 就绪；终点 → `{completed:true}` 且 currentStage 空；空 currentStage → 报错；`--tasks-dir` 隔离 |
| 回归 | 现有 26 用例全绿 |

## 7. 契约修正与衔接记录

1. **02 契约修正**：`git.mainBranch` 必填 → **字段必存、值可空**（D5 非 git 置空）；在 02 plan 变更记录补一行
2. **02 O2 关闭**：相位声明层 = **原子任务 config.phases**（05 定稿），无声明 = 单相位 `01`；workflow 预设不声明相位
3. **04 D2/D9 闭环**：`run start` 与 `next` 由本轮落地，挂起项清账
4. **05 O-C 关闭**：stages ↔ task 映射 = stageId 即任务名（§2.1）

## 8. 评审要点（已全部定稿）

| # | 结论 |
|---|---|
| P1 | ✅ 定稿：`--dir-name` 缺省 = runId（唯一、排序友好、免输入），要可读性显式传 |
| P2 | ✅ 定稿：数据先行——next 进入 human 相位即置 `waiting-human`（忠实表达相位类型），L3 强制归执行循环轮 |
| P3 | ✅ 定稿：`--type` 缺省 `feat`（02 目录布局第一段） |
| P4 | ✅ 定稿：start 完成不自动 exec 第一阶段（命令单一语义） |

## 变更记录

| 版本 | 日期 | 说明 |
|---|---|---|
| v0.1 | 2026-09-22 | 初版：预设格式与校验、run start 装配（含 D5 git 推断链）、next 推进语义、实现清单与测试计划、4 个评审点 |
| **v1.0** | 2026-09-22 | **定版**：P1–P4 全部按建议定稿（dir-name 缺省 runId / waiting-human 数据先行 / type 缺省 feat / start 不自动 exec）；进入实现 |
| **v1.1** | 2026-09-22 | **实现完毕**：`workflows/basic.json`；`tools/lib/workflow.js`（加载校验含 Kahn 环检测 / stages 物化 / phaseType / nextPhase / readyStages / statusForPhase）；`tools/lib/git-info.js`（D5 推断链）；index-registry 补 `register`/`genRunId`/`freshRunId`（同秒碰撞重掷，上限 5）；cli 登记 `run start`（run 域）与 `next`（顶层动词）；start/next 测试 15 例。验证：全部 41 用例通过（11+8+7+9+6），E2E 冒烟（start → exec/next 走完七步链 → finish → index 清空 + history 落行）通过；02 联动修正（mainBranch 可空、O2 关闭）已同步 |
