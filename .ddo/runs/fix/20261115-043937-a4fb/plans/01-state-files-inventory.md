# Part 01 · 状态文件体系整体盘点（排查结论）

> 服务 FR-DIR-1 / AC-2。证据来源：`plugin/src/*`（Repository Fact）、`tools/STATE-SPEC.md`（schema v2 权威）、`tools/lib/*` 与 `tools/cli.js`（Repository Fact）、`~/.ddo/` 与本仓库 `.ddo/` 实地盘点（2026-11-15）。

---

## 盘点总表

| # | 状态文件 | 结构与语义 | 写入方与时机 | 插件现状 | 本设计利用 |
|---|---|---|---|---|---|
| 1 | `~/.ddo/index.json` | `{runId:{statePath,startedAt}}`；全局运行中登记 | run start 注册 / run finish 注销（`tools/lib/index-registry.js` `register`/`unregister`） | ✅ 唯一数据源（`discover()`） | 保留为「运行中」源 |
| 2 | `<projectRoot>/.ddo/runs/<type>/<runId>/.state.json` | 六分区 state（schema v2）；**已收口 run 保留全量**，仅 `currentStage: []` | 引擎各命令随推进写（`tools/lib/state.js`） | ⚠️ 仅经索引间接读运行中的 | 新增「本项目」源（含已收口） |
| 3 | `<runDir>/.usage.jsonl` | F 区使用日志，一行一事件（audit） | 全部变更型命令追加（`tools/lib/journal.js` `appendAudit`） | ❌ 仅面板页脚显示路径 | 维持页脚展示，不进数据面（无 run 清单信息） |
| 4 | `<runDir>/` 产物文件（state `artifacts` E 区登记） | 阶段产物（requirement/spec/plan 等）+ `plans/` 分册 | next 追加登记 / rollback 清除 | ✅ 运行中 run 的产出浏览器 | 扩展到已收口 run（同渲染管线） |
| 5 | `~/.ddo/history/runs.jsonl` | 每行 `{runId,title,git,startedAt,endedAt,finalStatus,statePath}` | run finish 追加（`tools/lib/history.js` `append`） | ❌ 完全未用 | 新增「历史」源；`finalStatus`/`endedAt` 唯一依据 |
| 6 | `~/.ddo/history/<runId>.zip` | runDir 整目录归档（`.state.json`+产物+worktree-info.json） | run finish 归档（`history.js` `archiveRunZip`，幂等覆盖） | ❌ 完全未用 | 历史仅存 run 的 state 只读预览 |
| 7 | `<projectRoot>/.ddo/config.json` | 项目级配置（当前仅 `$schema` 引用） | — | ❌ 未用 | 不进数据面（无 run 信息） |

## 各文件详解

### 1. index.json——运行中登记簿

2 空格缩进 JSON，键为 runId。`statePath` 指向各项目内（或 `~/.ddo/tmp/` 临时 run）的 `.state.json`。finish 第三步 `registry.unregister` 后条目即消失——**插件在 run 收口瞬间失明**，这是「没有关联起来」的第一根因。索引条目可能指向已删除路径（worktree 清理后），插件现有 `staleCount` 语义正确，保留。

### 2. 项目 `.state.json`——六分区 run 事实

schema v2 六分区（STATE-SPEC §3.0）：A 标识（`runId`/`title`/`startedAt`/`schemaVersion`/`ephemeral?`/`workflow?`）、B 环境（`git`/`dirs`/`atomTasks`）、C 进度（`currentStage`/`stages` 含 `gate` 子对象）、D 编排（`subflows?`）、E 产物（`artifacts`）；F 使用日志外置为 `.usage.jsonl`。**已收口 run 的 state 仍完整保留在 runDir**（finish 仅清空 `currentStage` 并写回），本仓库实测 30+ 个已收口 run 均可完整渲染六分区视图——已收口深度能力（BQ-2 委托设计）的落地基础。worktree 场景的 runDir 随工作树删除，state 仅存于 zip（见 #6）。

### 3. `.usage.jsonl`——使用日志

一行一 JSON 事件（命令、事件类型、时刻等），仅追加、不参与控制流（不变量 I-J1）。对插件只有审计价值、无 run 清单价值，维持现状（页脚路径）。

### 4. runDir 产物——E 区登记

`artifacts` 结构：`<stage> → [{phase, recordedAt, files:[{path,bytes}]}]`；相对路径以 runDir/projectRoot 双基解析（`artifactView.js` `resolveCandidate` 现状契约）。回滚时清除被回退阶段的登记（引擎行为），插件侧天然跟随。

### 5. `runs.jsonl`——全局历史事件

finish 第二步追加（`tools/cli.js` runFinish：archiveRunZip → history.append → unregister → currentStage 清空）。字段含 `finalStatus`（done/aborted/failed）、`endedAt`、完整 `git` 快照。实测 49 条历史；损坏行跳过计数即可（与 stale 同语义）。

### 6. history zip——runDir 归档副本

整目录 deflate zip，含 `.state.json` 与全部产物；worktree run 与临时 run 收口后的**唯一存活副本**。`unzip -p <zip> .state.json` 可流式读取 state 而零解压落盘（只读原则成立）。

### 7. `.ddo/config.json`——项目配置

当前仅 `$schema` 引用，无 run 信息，不进数据面；若未来承载项目级插件配置可另行扩展（本次 Non-goal）。

## 关键鉴别事实

「待收束」（`currentStage` 空但未执行 finish）与「已收口」（finish 清空）在 state 与 index 中**不可区分**——两者 `currentStage` 均为 `[]`、index 均已无决定性差异；唯一判别信号是 runs.jsonl 中的 `finalStatus`（DEC-4 依据）。

## 根因结论

1. **数据面单源**：run 发现仅 index.json，收口即失明（Q1）。
2. **三源信息未利用**：项目 state 全量、history 事件、zip 归档对插件完全不可见（Q2）。
3. **`finalStatus` 无处体现**：已收口 run 的结局（done/aborted/failed）插件无从表达（Q3）。
4. **刷新盲区**：仅监听 index.json，项目内 run 收口（state 变更）不触发插件刷新（Q4）。

修复对象映射：Q1→DEC-1/2；Q2→DEC-1/3；Q3→DEC-4；Q4→DEC-6（见 plan.md 核心决策）。
