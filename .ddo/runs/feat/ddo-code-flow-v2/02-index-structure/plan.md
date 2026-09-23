# 工作项 02 · index-structure — 设计方案（架构定版基线）

> 版本：**v1.0（2026-09-21 已定版）**——本文件为后续工作项（状态更新脚本 / workflow 预设配置 / 可视化面板）的架构基线，变更需走版本号升级并记录于 §12。
> 需求依据：[requirement.md](./requirement.md)（决策 D1–D9）

## 1. 背景与目标

v2 需要在本机层面回答三个问题：

1. **现在有哪些 workflow 在跑？**（发现——读 `~/.ddo/index.json`）
2. **某个 run 执行到哪一步、用什么配置？**（定位——经指针回到项目内 `.state.json`）
3. **过去跑过哪些 run、结果如何？**（追溯——`~/.ddo/history/runs.jsonl`）

三个工件，职责严格分离：

| 工件 | 位置 | 角色 | 变化时点 |
|---|---|---|---|
| `.state.json` | 项目 run 目录内 | **唯一事实源**，run 的全部状态细节 | 每次状态变更（脚本） |
| `index.json` | `~/.ddo/` | 运行中 run 的**纯指针注册表** | 仅启动注册 / 结束移除 |
| `runs.jsonl` | `~/.ddo/history/` | 已结束 run 的持久化标记 | 仅结束时追加一行 |

## 2. 设计原则

1. **单一事实源**：状态细节只活在 `.state.json`；索引是纯指针，不复制内容、不构成第二事实源。
2. **简单优先**：index 只回答「什么在跑、去哪看」；一切深度信息读指针目标。
3. **自包含状态**：`.state.json` 不回指任何配置（无 workflowId）；workflow 预设由脚本在启动时展开成具体 `stages` 写入。
4. **标识与语义分离**：runId 是无语义的机器标识（可排序、定长、稳定）；人类可读的描述由 `title` 承载。
5. **最小信息集**：不存完整 Prompt、上下文、长日志；atom-task 只存配置（D6）。
6. **append-only 历史**：JSONL 逐行追加（D3）。

## 3. 文件布局

```text
~/.ddo/
├── index.json            # 全局运行索引（纯指针，仅含未结束的 run）
└── history/
    └── runs.jsonl        # 全局历史索引（一行一个已结束 run）

<projectRoot>/.ddo/runs/<type>/<dateDescription>/
└── .state.json           # 项目侧唯一状态文件（源，结构见 §5）
```

- 首次 run 时由脚本确保 `~/.ddo/` 与 `~/.ddo/history/` 存在。
- 命名说明：`.ddo/` 本身已是隐藏目录，内部文件不再加点前缀。

## 4. `~/.ddo/index.json` Schema（纯指针）

```json
{
  "20260921-224130-9f2c": {
    "statePath": "/Users/djhhh/work_area/Ddo-Code-Flow-feat-ddo-code-flow-v2/.ddo/runs/feat/ddo-code-flow-v2/.state.json",
    "startedAt": "2026-09-21T22:41:30+08:00"
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| （key） | string | ✔ | runId（计算方法见 §5.2）；重复注册幂等覆盖 |
| `statePath` | string（绝对路径） | ✔ | 该 run `.state.json` 的绝对路径——唯一必需的定位信息 |
| `startedAt` | date-time | ✔ | run 启动时间（同时写入 `.state.json`，见 §5.1） |

顶层就是 `runId → 指针` 的平铺 map，**无包装层、无版本字段、无状态内容**。若未来需要 schema 演进，再引入版本字段属于破坏性变更，需整体迁移——当前信息量极小，风险可忽略。

## 5. `.state.json` Schema（唯一事实源）

### 5.1 结构

```json
{
  "runId": "20260921-224130-9f2c",
  "title": "v2 架构升级 · 索引文件结构设计",
  "startedAt": "2026-09-21T22:41:30+08:00",

  "git": {
    "mainBranch": "main",
    "releaseBranch": "feature/ddo-code-flow-v2",
    "developmentBranch": "feat/ddo-code-flow-v2",
    "worktreePath": "/Users/djhhh/work_area/Ddo-Code-Flow-feat-ddo-code-flow-v2"
  },

  "currentStage": ["spec:02"],

  "stages": {
    "context":    { "status": "done",          "dependOn": [],          "at": "2026-09-21T22:40:55+08:00" },
    "requirement": { "status": "done",         "dependOn": ["context"],  "at": "2026-09-21T22:41:41+08:00" },
    "spec":       { "status": "waiting-human", "dependOn": ["requirement"], "at": "2026-09-21T22:42:10+08:00" }
  },

  "atomTasks": {
    "test-plan": { "tdd": true }
  }
}
```

### 5.2 字段规格

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `runId` | string | ✔ | 机器标识，计算方法见 §5.2.1；不承载任何业务语义 |
| `title` | string | ✔ | 人类可读的 run 标题（本次工作内容的一句话描述），供面板/历史列表展示；生成规则（取自需求关键词或用户指定）归脚本工作项 |
| `startedAt` | date-time | ✔ | run 启动时间；结束迁移时作为 history 的起始时间来源 |
| `git.mainBranch` | string | ✔（值可空） | 主干分支名称；**字段必存、值可空**（v1.1 修正，06 D5：非 git 环境置空；使用 worktree 时由 git-worktree 任务注册） |
| `git.releaseBranch` | string | ✖ | 发布分支；不使用时不填 |
| `git.developmentBranch` | string | ✖ | 开发分支；不使用时不填 |
| `git.worktreePath` | string（绝对路径） | ✖ | 使用 Git worktree 时填写 |
| `currentStage` | string[]（≥1） | ✔ | 待继续执行的阶段，元素为 `stageId:phase`（见 §5.3） |
| `stages` | object | ✔ | key 为 stageId（阶段级）；**由脚本按 workflow 预设动态生成**（D8） |
| `stages[k].status` | string enum | ✔ | v4 八值：`pending` / `running` / `done` / `failed` / `skipped` / `rework` / `waiting-human` / `waiting-remote-gate`（D7） |
| `stages[k].dependOn` | string[] | ✔（可为空） | 依赖的 stageId 列表——阶段级 DAG，源自 workflow 预设 |
| `stages[k].at` | date-time | ✔ | 该阶段最近一次状态变更时间 |
| `stages[k].gate` | object | ✖ | **确认门实例**（v1.2 新增，07）：进入 human 相位的推进命令写入 `{ phase, openedAt, options: [{name, desc, action} 三元组——name 为用户词汇决议名，action 分推进型/转移型/in-phase], decision?, closedAt? }`；推进型决议落 decision/closedAt 留痕，rollback 重置清门 |
| `atomTasks` | object | ✖ | key 为 atom-task 类型；value 为该 run 的项目级定制配置快照（仅配置，D6） |

**明确不含**：`workflowId`（D8——预设配置在启动时展开为 `stages`，状态文件不回指配置）；Prompt、上下文、长日志（D6）。

### 5.2.1 runId 计算方法

```text
runId = <YYYYMMDD>-<HHMMSS>-<XXXX>

  YYYYMMDD   run 启动时的本地日期
  HHMMSS     run 启动时的本地时间（秒）
  XXXX       4 位小写十六进制随机数（2 字节 crypto 随机）
```

示例：`20260921-224130-9f2c`（定长 18 字符）。

**性质与理由**：

| 性质 | 说明 |
|---|---|
| 无语义 | 不嵌项目名/分支名——项目改名、分支调整不影响 runId；机器标识与展示语义（title）分离 |
| 定长 18 字符 | 字符集仅 `[0-9a-f-]`，JSON key / 文件名 / URL 全安全 |
| 字典序 = 时间序 | 以时间开头，index.json 的 key 排列、history 行顺序天然按启动时间排序 |
| 防碰撞 | 同秒并发启动由 4 位随机后缀区分（同秒碰撞率 1/65536）；注册时若 runId 已存在于 index.json 且 statePath 不同，则重掷随机后缀重试 |
| 无需中心协调 | 时间 + 本机随机即可生成，不依赖任何注册中心 |

**时区说明**：使用机器本地时间（便于人工扫读）；完整时刻以 `startedAt`（ISO 8601 带时区偏移）为准，runId 中的时间仅为可读性排序辅助。

### 5.3 `stageId:phase` 记法

- 格式：`<stageId>:<两位零填充相位号>`，如 `spec:01`、`spec:02`。
- 语义：一个 stage 内的顺序执行段。典型两段式 = `01` 动作段（AI 执行）→ `02` 人审段（用户确认）。
- 相位切换由 `stages[stageId].status` 表达（如 `running` → `waiting-human`），`at` 随之刷新；`currentStage` 精确到相位。
- 约束：同一 stage 在 `currentStage` 中至多出现一个相位；不同 stage 可并行出现。
- 相位数量与含义由 workflow 预设声明（开放问题 O2 移交 workflow 设计）。

### 5.4 stages 的生成方式（D8）

1. 用户/项目选定一个**预设 workflow 配置**（格式后续工作项定义）。
2. run 启动时，脚本读取预设，把其中该 workflow 需要的阶段**展开生成**为 `stages` 条目（含 `dependOn` 依赖边、初始 `pending` 状态），写入 `.state.json`。
3. 此后 `.state.json` 自包含：执行、恢复、面板展示均不再依赖预设配置文件。

## 6. `~/.ddo/history/runs.jsonl` Schema（v0）

一行一个已结束的 run（UTF-8 JSON per line，按结束时间追加）。迁移时字段直接取自 `.state.json`：

```json
{"runId":"20260921-224130-9f2c","title":"v2 架构升级 · 索引文件结构设计","git":{"mainBranch":"main","releaseBranch":"feature/ddo-code-flow-v2","developmentBranch":"feat/ddo-code-flow-v2","worktreePath":"…"},"startedAt":"…","endedAt":"…","finalStatus":"done","statePath":"…"}
```

| 字段 | 说明 |
|---|---|
| `runId` / `title` / `git` | 自 `.state.json` 搬运；title 保障历史列表无需解析 ID 即可读 |
| `startedAt` / `endedAt` | 起止时间 |
| `finalStatus` | `done` / `aborted`（用户中止）/ `failed`（失败终止） |
| `statePath` | 原 `.state.json` 路径，追溯入口（该文件随项目保留） |

> v0 最小集；是否追加阶段摘要、失败原因等按 D3 后续设计（O1）。

## 7. 生命周期

```text
启动        脚本按 §5.2.1 计算 runId → 按 workflow 预设生成 stages
   │        → 创建 .state.json（runId/title/startedAt/git/currentStage 首项/stages）
   │        → index.json 写入 runId → {statePath, startedAt}
执行中      每次状态变更：脚本只更新 .state.json
   │        （index.json 不动——它是纯指针，运行期零变化）
结束        → 先向 history/runs.jsonl 追加一行（信息取自 .state.json，endedAt/finalStatus 定格）
   │        → 再从 index.json 移除该 runId，原子写回
异常中断     无结束迁移 → index 残留指针
              读取方惰性校验：statePath 不存在，或 .state.json 无待继续阶段 → 条目视为失效不展示
```

迁移顺序先 history 后 index：崩溃时最坏情况是 history 多一行重复或 index 残留一条，均可被惰性校验兜住；反之会丢记录。

## 8. 写入协议（脚本工作项的实现约束）

1. **单写者**：只有 runtime 脚本写 `index.json` 与 `runs.jsonl`；面板及一切外部工具只读。
2. **原子写**：写临时文件（同目录）+ `rename` 覆盖，杜绝半截文件。
3. **并发共写**：多项目并行 run 同时读改写 `index.json` 存在 last-writer-wins 丢更新风险 → 写前重读 + 锁文件（`~/.ddo/.index.lock`）+ 超时重试。
4. **幂等**：以 runId 为 key 覆盖写；history 追加不去重（读取方按 runId+endedAt 容忍重复）。
5. **目录引导**：首次写入前确保 `~/.ddo/`、`~/.ddo/history/` 存在。

## 9. 与后续工作项的衔接

| 后续工作项 | 依赖本设计的什么 |
|---|---|
| 03 · 状态更新脚本 | §5 schema（更新目标）、§5.2.1 runId 生成、§7 生命周期、§8 写入协议 |
| workflow 预设配置设计 | §5.3 相位记法、§5.4 stages 生成契约 |
| 可视化面板 | §4 指针协议 + §5 schema（title 展示）+ §7 惰性校验 |

## 10. 开放问题

| # | 问题 | 状态 |
|---|---|---|
| O1 | history 行字段是否扩展（阶段摘要、失败原因、issue 关联等） | 待定（D3：后续设计） |
| O2 | ~~相位由 workflow 预设的哪一层声明；无相位 stage 是否统一 `:01`~~ | **已关闭（v1.1）**：相位声明归**原子任务 config.phases**（05 定稿）；无声明 = 单相位 `:01` 且视为 action；workflow 预设不声明相位 |
| ~~O3~~ | ~~同名项目目录的 runId 前缀冲突~~ | **已消解**：runId 不再嵌项目名（v0.3） |

## 11. 定版结论（v1.0，用户已确认）

1. §5.2.1 runId 计算方法：`YYYYMMDD-HHMMSS-<4位hex随机>`，定长 18 字符、字典序即时间序、本地时间。
2. `title` 为必填、由脚本按需求关键词或用户指定生成（具体规则归工作 03）。
3. §4 index 条目仅 `{statePath, startedAt}`（title 不进 index，保持指针纯粹）。
4. §6 history v0 含 title 搬运。
5. §7 结束迁移顺序：先追加 history，再移除 index 条目。

## 12. 变更记录

| 版本 | 日期 | 说明 |
|---|---|---|
| v0.1 | 2026-09-21 | 初版：index.json 承载完整状态快照 |
| v0.2 | 2026-09-21 | 修订：index 简化为纯指针（D2）；完整状态结构移入 `.state.json` 并去除 workflowId、增加 stages 动态生成契约（D8） |
| v0.3 | 2026-09-21 | 修订：新增 runId 计算方法（时间+随机，替代项目名-分支名拼接，D9）；新增 title 字段；O3 消解 |
| **v1.0** | 2026-09-21 | **定版**：用户确认全部结论，作为后续工作项的架构基线 |
| v1.1 | 2026-09-22 | 修正（06 轮联动，06 D5）：`git.mainBranch` 必填放宽为**字段必存、值可空**（非 git 置空 / worktree 场景由 git-worktree 任务注册）；O2 关闭——相位声明层归属原子任务 `config.phases` |
| v1.2 | 2026-09-23 | 扩展（07 轮联动）：`stages[k].gate` 可选字段——确认门实例（操作三元组注册 + 决议留痕），生命周期与语义见 07 plan §3；state 其余字段不变 |
| v1.3 | 2026-09-24 | 细化（08 轮联动）：index 迎来第一个 CLI 读取消费方 `resume`（发现层）；§7 惰性校验细化——「无待继续阶段」不再一律视为失效，结构合法 + currentStage 空 = **待收束**（展示并引导 run finish），statePath 缺失/非法仍为 stale 不展示 |
| v1.4 | 2026-09-24 | 扩展（10 轮联动）：`state.atomTasks` 写入方扩展——run start 物化时把链内任务 `configurable` 声明的 default 预填（可配置项预标记）；字段语义不变（run 级配置快照，exec 合并最高层） |
