# Part 02 · 数据面与视图详细设计

> 服务 FR-DIR-2 / FR-DIR-3 / AC-1 / AC-3。承接 Part 01 盘点与 plan.md 核心决策（DEC-1…DEC-7）；全部改动限定 `plugin/`，引擎零改动、插件保持只读。

---

## RunSummary v2 字段表

| 字段 | 类型 | 来源 | 语义 | 新增 |
|---|---|---|---|---|
| `runId` / `title` / `type` / `project` / `projectRoot` / `startedAt` | 现有 | state | 同现状 `summarize` 契约 | 否 |
| `positions` / `completable` / `statePath` | 现有 | state | 位置清单（`{stage,phase,gateOpen?}`）；位置空 → completable | 否 |
| `source` | `'index' \| 'project' \| 'history'` | 发现源 | 该 run 首次被哪个源发现（去重优先级决定） | ✚ |
| `finalStatus` | `'done' \| 'aborted' \| 'failed'` | runs.jsonl | 已收口结局；缺省未收口（含待收束） | ✚ |
| `endedAt` | string | runs.jsonl | 收口时刻 | ✚ |
| `archiveZip` | string | statSync | `~/.ddo/history/<runId>.zip` 存在时的绝对路径 | ✚ |

## discoverAll 装配算法

输入 `{indexPath, projectRoots[]}`；输出 `{running[], project[], history[], staleCount, indexError}`。

1. **index 源**：现 `discover()` 逐条逻辑不动，条目标 `source:'index'`，进入 `running`（位置非空）或并入待装配池（位置空=待收束，仍属运行中语义，展示于运行中区）。
2. **project 源**：对每个 workspace 根枚举 `.ddo/runs/*/*/.state.json`（`type`=倒数第二段目录名）；`tryLoadState` 校验通过且 runId 未出现 → `source:'project'`；位置非空并入 `running`（覆盖 index 缺失场景，如索引损坏），位置空进入 `project` 组。
3. **history 源**：逐行解析 runs.jsonl；runId 未出现 → `source:'history'` 进 `history` 组；对**全部三组**按 runId 回填 `finalStatus`/`endedAt`（DEC-4）；`statSync` 标 `archiveZip`。
4. **排序与上限**：三组各按 `startedAt` 倒序；`history` 组展示上限 50 条，组节点 description 显示「N/共 M」。
5. **边界**：多根 workspace 全部纳入；无 `.ddo` 目录的根跳过；runs.jsonl 缺失/损坏行 → 跳过并计入 staleCount 语义提示；任一源失败静默降级为空组（沿用 indexError 只进通道不弹窗）。

不变量：输出按 runId 全局唯一；三组互斥；全程只读。

## 三区树信息架构（RunsProvider 根层）

| 区 | 归属规则 | 展开态 | 内容形态 |
|---|---|---|---|
| 运行中 | 位置非空的 run（index 源为主，project 源补充） | 展开 | 区内按项目分组（现状逻辑/图标/调色原样保留=AC-3 回归边界） |
| 本项目 | project 源且位置空（已收口/待收束） | 展开 | 平铺时间倒序；description `type · finalStatus/待收束 · MM-DD HH:mm` |
| 历史 | history 源且未被上两组覆盖 | 折叠 | 平铺时间倒序；description `type · finalStatus · 项目名 · MM-DD HH:mm` |

条目徽章映射：开门 `·门`（现状）；位置空且无 `finalStatus` → `待收束`（现状语义）；有 `finalStatus` → `done/aborted/failed`（复用 docs 调色 ok/danger/warn 语义色键，webviewHtml 徽章渲染）。

## 详情面板数据管线

- **磁盘 state 路径（不变）**：`ensurePanel` → `renderPanel` → `buildViewModel` + `buildBrowser`，已收口 state 直接可渲染（`currentStage: []` → completable 分支已存在）。
- **archive 补载路径（新增）**：`source:'history'` 且打开面板时 `loadStateFromZip(archiveZip)`——spawnSync `unzip -p <zip> .state.json`（3s 超时、maxBuffer 沿用产出浏览器限额），解析成功走同一渲染管线；失败降级为「历史事件信息卡」（runs.jsonl 字段直接呈现）。
- **archiveOnly 产出登记**：`buildBrowser(state, {archiveOnly:true})` → `collectArtifacts` 不读磁盘、输出登记行 note「归档于 zip，未内联」；非 archive 路径行为不变。
- **finalStatus 数据流**：discoverAll 回填 → RunSummary → `buildHeader` 增加 `finalStatus`/`endedAt`/`source` 字段 → 徽章渲染。

## watcher 与刷新

三点监听共用 300ms 去抖与「异常降级为手动刷新」语义：① index.json（现状）；② workspace `.ddo/runs`（RelativePattern glob `**/.state.json`，覆盖项目内新建/推进/收口）；③ `~/.ddo/history/runs.jsonl`（收口追加）。

## 性能与边界

- 树构建仅读 KB 级 JSON 文件（实测规模：索引 5 / 项目 30+ / 历史 49，毫秒级）；zip 仅在打开历史面板时读一次。
- 产出内联限额（单文件 48KB / 总量 512KB / 文本白名单）原样沿用；无新依赖、无构建步骤。

## 兼容与回退细节

- `discover()` 保留导出（兼容冒烟）；`extension.js` 改用 `discoverAll`。
- 配置面不变：history 目录由 indexPath 同目录推导（`~/.ddo/history`），与引擎 `ddoHome` 布局一致（DEC-7）。
- 回退：装配阶段单独关闭 project/history 源即回到 v0.2.17 行为；引擎侧零改动、无需回退。
