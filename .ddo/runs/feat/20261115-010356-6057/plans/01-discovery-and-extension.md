# Part 01 · 数据面与扩展集成详细设计

> 隶属：plan.md（R1，split 模式）· 覆盖 DEC-2 / DEC-3 / DEC-4 落点 · 上游契约：spec FR-NAV-1、Non-goals（只读）

## 1. 发现算法详设（对应 DEC-3）

**输入/输出**：输入 = 全局索引 `~/.ddo/index.json`（`{runId:{statePath,startedAt}}`，R1）；输出 = `{runs: RunSummary[], staleCount}`。

**步骤**：

1. 读索引；文件缺失或 JSON 损坏 → 返回 `{runs:[], staleCount:0, indexError}`，树进入空态，错误摘要写 OutputChannel（不弹窗）。
2. 逐条目惰性加载（同构引擎 tryLoadState 语义，R2）：`exists → JSON.parse → 最小校验`；任一步失败 → `staleCount++` 跳过，不阻断其余条目。
3. 通过者产出 `RunSummary`；`type` 取 `state.dirs.runDir` 倒数第二段（同构 runMeta L1123）；`currentStage` 为空数组的待收束 run **仍展示**并标 `completable:true`（引擎 D4 语义）。

**最小校验字段表**（对齐 STATE-SPEC §3.6 必填集；插件不复制 assertState 全量，仅控制流所需子集）：

| 字段 | 类型 | 校验 | 用途 |
|---|---|---|---|
| `runId` | string | 非空且与索引键一致 | 树节点 id |
| `title` | string | 非空 | 树 label |
| `startedAt` | string | 非空 | 排序（新→旧） |
| `dirs` | object | 含 `projectRoot`/`runDir` 字符串 | type 推导、信息展示 |
| `currentStage` | string[] | 数组 | 位置概要、completable 判定 |
| `stages` | object | 非空对象 | 位置概要 phaseType 兜底、详情渲染 |

**不变量**：插件对索引与全部 state 只读（写方唯一为 CLI）；失效条目不部分渲染（要么整条成功要么整条 stale）；同一次发现内 runId 唯一（§3.1 约束，冲突时保留后写条目并告警）。**复杂度** O(n) 读 n 个小 JSON 文件，当前全局索引量级（个位~十位数）无分页需求。

**phaseType 概要**：引擎 summaryPosition 经 tasksDir 读任务 config 判定相位类型；插件不依赖 skill 任务目录（路径不可假设），位置概要仅展示 `stage:phase` 与 `gateOpen`（`stages[stage].gate` 存在且无 `decision`），phaseType 标注为不可得——接口留字段，coding 阶段如需可后续经配置接入 tasksDir，属可选增强非契约。

## 2. 刷新与监听

| 机制 | 触发 | 行为 |
|---|---|---|
| 手动刷新 | 视图标题栏 `ddo-flow.refresh` | 全量 discover + 树刷新 |
| 索引监听 | `fs.watch` 索引文件（新增/删除 run） | 去抖 300ms → discover |
| 详情监听 | 选中 run 的 `.state.json` watch | 去抖 300ms → 重读该 state → panel 重渲染 |
| 面板回收 | panel dispose | 关闭对应 watch，清注册表 |

索引监听失效（watcher 抛错，如跨平台事件缺失）降级为仅手动刷新 + OutputChannel 提示，不报错弹窗。

## 3. 扩展契约面（package.json contributes）

| 项 | 值 | 说明 |
|---|---|---|
| `viewsContainers.activitybar` | `id: ddo-flow`，`icon: media/icons/activity.svg` | 活动栏容器（FR-ICON-1 落点） |
| `views` | `ddo-flow.runs`（TreeView，标题「存活流水」） | 左侧导航（FR-NAV-1 落点） |
| `activationEvents` | `onView:ddo-flow.runs` | 懒激活 |
| `commands` | `ddo-flow.refresh` / `ddo-flow.openRun` | 刷新；打开/聚焦流水详情 |
| `menus` | view/title 挂 refresh；view/item 挂 openRun（树项 command 绑定） | 点击即看（FR-INFO-1 入口） |
| `engines.vscode` | `>=1.75` | TreeView/Webview/fs.watch 均为远旧能力 |
| `configuration` | `ddo-flow.indexPath`（缺省 `~/.ddo/index.json`） | 索引定位，免硬编码 |

**树项呈现**：`label`=title（超长由 VS Code 自身截断）；`description`=`type · 位置1;位置2…`（currentStage 映射，completable 显示「待收束」）；`tooltip`=runId/startedAt/projectRoot 摘要；`iconPath`：常规条目 `media/icons/run-claude.svg`，completable 条目 `media/icons/run-completable.svg`（映射表见 Part 02 §4）。

## 4. 错误路径

| 场景 | 表现 | 恢复 |
|---|---|---|
| 索引缺失/损坏 | 空态「无运行中的 run」+ OutputChannel | 引擎侧 run start 后自动恢复 |
| state 失效（目录被移走/删 .state.json） | 该条不出现，计 stale | 下次发现重算 |
| state JSON 合法但校验不过（v1 老结构缺 dirs） | 同上计 stale | 引擎 v1→v2 兼容范围内 dirs 必填，§3.6 |
| webview 被回收（后台隐藏） | `retainContextWhenHidden:false`，重显时由宿主重发渲染消息 | 状态自 state 重读，无本地丢失 |
| openRun 时 state 已失效 | Information 消息「该流水已失效」并刷新树 | 同 stale 路径 |
