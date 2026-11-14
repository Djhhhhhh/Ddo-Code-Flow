# Part 01 · 搜索数据面（记录集构建与匹配）

> plan rev 1（split）· 上游 spec：FR-HIST-2 / FR-HIST-3（决策与关键信息搜索）、FR-HIST-4（定位 run）；本 part 覆盖复用基线、数据决策与数据面设计。

## 1. 现有设计与复用基线

| # | 能力 | 文件 / 符号 | 证据类型 | 采用方式 | 适用边界 |
|---|---|---|---|---|---|
| R1 | 三源聚合发现 | `plugin/src/runDiscovery.js`：`discoverAll` / `discover` / `readProjectRuns` / `readHistoryEvents` | Repository Fact | 复用现有实现 | `discoverAll` 的 `HISTORY_CAP=50` 是**展示层**截断；搜索需全量，直接调底层 `readHistoryEvents` + `readProjectRuns` + `discover`，不走 `discoverAll` |
| R2 | zip 流式只读读取 | `runDiscovery.js#loadStateFromZip`、`artifactView.js#readZipEntry` / `zipEntrySizes`（`unzip -p/-l`，spawnSync 3s 超时） | Repository Fact | 扩展现有实现 | 复用同一读取惯例，扩展到读取 zip 内 `.usage.jsonl` 条目 |
| R3 | 旧式目录归档 | `~/.ddo/history/<runId>/.state.json`（实测 11 个 v1 时代目录归档，zip 化前的 state 目录副本） | Repository Fact | 新增实现 | 现有代码只认 `<runId>.zip`，无目录归档支持；搜索为覆盖全历史需新增直读（旧 run 无 zip，决策数据只在其 state 内） |
| R6 | 只读子进程惯例 | `artifactView.js#git`（spawnSync 只读 + 失败静默降级） | Repository Fact | 复用现有实现 | 搜索数据面全部读取失败均降级、不阻塞渲染 |

## 2. 数据决策

### DEC-2 数据访问与索引策略（回答 spec PD-2）

**结论**：搜索触发时按需全量扫描构建内存记录集，模块级缓存以「文件路径 → mtimeMs」为键失效重解析；不预建持久索引文件。

| 候选 | 状态 | 关键差异与结论 |
|---|---|---|
| 按需扫描 + mtime 缓存 | **accepted** | 实测数据量：runs.jsonl 50 行/23KB，归档 50 个/约 2MB，全量解析毫秒级；缓存吸收重复搜索的 unzip 子进程开销（约 50 次/轮） |
| 预建持久索引（落盘） | rejected | 索引文件无合法落点——`~/.ddo/` 与工作区 `.ddo/` 均为引擎领地（插件只读边界）；数据量小不值得引入越界写入 |
| 每次实时扫描不缓存 | rejected | 重复搜索各付一轮 ~50 次 spawnSync unzip，交互明显卡顿 |

**HISTORY_CAP 边界**：50 条上限是树视图展示语义，不适用于搜索。**影响范围**：仅搜索数据面；树视图行为零改动。**回退条件**：归档规模增长到全量扫描秒级以上时，再加缓存分片（当前量级无必要）。

### DEC-4 决策记录的数据范围

**结论**：记录集两类条目——

- `meta` 条目：每个 run 一条，可搜文本 = runId/标题/类型/workflow/finalStatus/起止时间/项目；
- `usage` 条目：`.usage.jsonl` 全部 11 类事件逐条入集（`decision`/`interacted`/`presented`/`rollback` 在 UI 标注为「决策」类，其余为「轨迹」类），可搜文本 = 事件 `note`/`option`/`stage`/`phase`/`command`/`detail`；无 `.usage.jsonl` 的 v1 旧数据，从 `.state.json` 的 `stages[].gate`（`decision` 等）提取决策条目兜底。

**依据**：STATE-SPEC §3.7 定义 `.usage.jsonl` 为复盘材料（note 含用户反馈全文与执行摘要），是「过去的决策」的权威载体；v1 旧 run 无此文件，state 门对象是唯一残留。**若错误的影响**：若存在 usage 与 state 均无决策数据的旧 run，该 run 仅元信息可搜（如实降级，不伪造）。

### DEC-5 只读与降级边界

**结论**：搜索链路全程只读（磁盘直读 + `unzip -p/-l`）；任一 run 读取失败静默跳过计入 stats（页面脚注展示「N 条记录不可读」），不阻塞整页。与既有数据面降级语义一致（R6）。

## 3. 数据模型（纯内存，无数据库变更）

```
SearchRecord {
  runId, title, type, project, workflow, finalStatus, startedAt, endedAt, source,
    // source 枚举同 RunSummary：'index'|'project'|'history'；另加 'legacy-dir'（旧式目录归档）
  kind: 'meta' | 'usage' | 'gate',
    // usage=.usage.jsonl 事件；gate=v1 state 门对象兜底条目
  event?: { seq, at, event, command, stage, phase, option, note, detail },  // kind=usage
  gate?:  { stage, decision, closedAt },                                     // kind=gate
  searchText: string,   // 预拼接的全部可搜文本（小写化）
  archiveZip?: string,  // 来源为归档时保留，供展示
}
SearchIndex { records: SearchRecord[]; unreadable: number; builtAt: string }
Match { record; terms: string[]; snippet: string /* 预计算高亮片段，含 <mark>，已转义 */ }
```

## 4. 记录构建与匹配（要点）

- **构建顺序**：① `discover()`（index 源）→ ② `readProjectRuns()`（project 源，`<runDir>/.usage.jsonl` 磁盘直读）→ ③ `readHistoryEvents()` 全量事件，逐 runId 按可用性取决策数据：磁盘 `.usage.jsonl` 仍在则直读；否则 `<runId>.zip` 内 `.usage.jsonl`（v2）；否则 zip 内 `.state.json` 提门对象；否则旧式目录 `<runId>/.state.json`；全不可得则仅 `meta`。runId 去重与源优先级同 R1（index > project > history）。
- **不变量**：同一 runId 的 meta 条目唯一；usage/gate 条目依附其 runId；读取失败只影响该 run 的 usage/gate 条目，不影响 meta（事件行自带元信息）。
- **匹配**：查询串 trim → 空格分词 → 逐词对 `searchText` 做 `includes`（预小写）→ 全命中才入选；复杂度 O(记录文本总量 × 词数)，当前量级毫秒级。
- **高亮**：服务端预计算——取首个命中词上下文窗口（前后各 ~60 字符）→ 整段 `escapeHtml` 后按词序替换为 `<mark>`（只处理已转义文本的小写对位，避免注入）。

## 5. 性能与兼容边界

- 缓存键 `路径 → mtimeMs`：文件未变复用解析结果；runs.jsonl 变更（新 run 收口）自动失效相关条目。
- 限额：命中渲染 ≤200 条（超限截断提示）；单条 snippet ≤ ~200 字符；结果页 HTML 目标 ≤ 512KB（对齐产出浏览器总量限额惯例）。
- 兼容：v2 zip（含 `.usage.jsonl`）全能力；v1 zip（仅 state）降级门对象条目；旧式目录归档同 v1 zip；ephemeral run 已删除 → 仅事件 meta 可搜（如实呈现）。
