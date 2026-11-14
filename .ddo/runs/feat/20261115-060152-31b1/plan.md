# History 历史查询页面 技术 Plan

> revision: 1 · mode: split · 上游：spec.md（已确认 · run 20261115-060152-31b1）
> 面向本仓库 `plugin/` 组件；详细设计见 Parts（Manifest 见文末）；不含测试计划与人员排期。

## 执行摘要

在 ddo-code-flow VS Code 插件中新增「历史查询」能力：命令/视图标题按钮唤起 → InputBox 输入关键词 → 数据面按需扫描三源全量 run（含 zip 与旧式目录归档）构建可搜索记录集 → 零脚本 Webview 结果页呈现（高亮、分组、纯 CSS 过滤）→ 结果卡经 `command:` 锚点跳转既有 run 详情面板。全部只读，零依赖、无构建、无 JS 脚本的工程基线不变。文档模式 split：本文件为权威契约总览，深度细节在 plans/01（数据面）与 plans/02（页面）。

---

## 范围与非目标

| 事项 | 说明 | AI 索引 |
|---|---|---|
| 查询入口 | 新增命令 `ddo-flow.searchHistory` + 存活流水视图标题按钮，唤起历史查询页 | FR-HIST-1 / AC-1 |
| 决策搜索 | 关键词命中过去 run 的门决议、交互反馈、呈现摘要、回滚原因等使用轨迹 | FR-HIST-2 / AC-2 |
| 关键信息搜索 | 关键词命中 run 元信息（runId/标题/类型/workflow/状态/起止时间/项目） | FR-HIST-3 / AC-3 |
| 结果定位 | 结果卡锚点跳转既有 `ddo-flow.openRun` 详情面板 | FR-HIST-4 / AC-4 |
| 完整页面交付 | 信息架构、过滤、分组、高亮、空态一体设计随本次实现落地 | FR-HIST-5 / AC-5 |
| 非目标：控制操作 | 不提供启动/推进/收口等任何控制，保持只读观测台边界 | spec Non-goals |
| 非目标：引擎改动 | 不修改 CLI 侧数据写入与数据模型，仅消费既有三源数据 | spec Non-goals |
| 非目标：既有视图重构 | 不替换三区树与详情面板，查询页为新增入口 | spec Non-goals |

---

## 现有设计与复用基线

| 能力 | 文件路径 | 符号 | 证据类型 | 采用方式 | 适用边界 | AI 索引 |
|---|---|---|---|---|---|---|
| 三源聚合发现 | `plugin/src/runDiscovery.js` | `discoverAll` / `discover` / `readProjectRuns` / `readHistoryEvents` | Repository Fact | 复用现有实现 | `HISTORY_CAP=50` 为展示层截断；搜索需全量，直调底层三函数，不走 `discoverAll` | R1 |
| zip 流式只读读取 | `plugin/src/runDiscovery.js`、`plugin/src/artifactView.js` | `loadStateFromZip` / `readZipEntry` / `zipEntrySizes`（`unzip -p/-l`，3s 超时） | Repository Fact | 扩展现有实现 | 同一读取惯例扩展到 zip 内 `.usage.jsonl` 条目 | R2 |
| 旧式目录归档 | `~/.ddo/history/<runId>/.state.json` | —（实测 11 个 v1 目录归档，zip 化前形态） | Repository Fact | 新增实现 | 现有代码只认 `<runId>.zip`；搜索为覆盖全历史新增直读（旧 run 决策数据仅存于其 state） | R3 |
| 零脚本 Webview 渲染 | `plugin/src/webviewHtml.js` | `DOCS_ROOT_VARS`、radio-hack 页签模式 | Repository Fact | 扩展现有实现 | 导出 `DOCS_ROOT_VARS` 复用色板；radio-hack 复刻为结果过滤器 | R4 |
| 详情面板与跳转命令 | `plugin/src/extension.js` | `ensurePanel`、`ddo-flow.openRun` | Repository Fact | 复用现有实现 | 结果卡 `command:` 锚点直达，零新增跳转命令 | R5 |
| 只读子进程惯例 | `plugin/src/artifactView.js` | `git()`（spawnSync 只读 + 失败静默降级） | Repository Fact | 复用现有实现 | 搜索数据面全部读取失败均降级、不阻塞渲染 | R6 |
| HTML 转义 | `plugin/src/stateView.js` | `escapeHtml` | Repository Fact | 复用现有实现 | 高亮片段服务端预转义，防注入 | R7 |

---

## 整体架构与流程

参与方与边界：用户 ↔ 搜索页 Webview（零 JS，`enableScripts:false` + `enableCommandUris:true`）↔ 搜索数据面（纯 Node，只读磁盘与 `unzip -p`）↔ 既有详情面板（复用 `ddo-flow.openRun`）。引擎侧零参与。

```mermaid
flowchart LR
  A[命令/标题按钮唤起] --> B[InputBox 输入关键词]
  B --> C[buildSearchIndex\nmtime 缓存命中则复用]
  C --> D[searchRecords\n多词 AND 子串匹配]
  D --> E[renderSearchHtml\n分组/过滤/高亮/上限]
  E --> F[Webview 结果页]
  F -- "command: 锚点" --> G[ddo-flow.openRun\n既有详情面板]
  F -- 再次执行命令 --> B
```

异常流：索引构建单源失败（zip 损坏等）→ 该 run 降级仅 meta 并计入 `unreadable`；InputBox 取消 → 静默退出；空结果 → 空态引导换词。详见 Part 02 §2。

---

## 技术选型与方案对比

| 方案 | 来源 | 仓库适配性 | 代价与风险 | 状态 | 结论 | AI 索引 |
|---|---|---|---|---|---|---|
| Webview Panel + InputBox + `enableCommandUris` 锚点 | 初始 Plan | 与零脚本基线兼容；`command:` URI 为 VS Code 原生能力（≥1.75） | 目标版本禁用 `command:` URI 时 AC-4 需降级（回退条件已定义） | accepted | 查询页承载形态（DEC-1） | DEC-1 |
| QuickPick 即时过滤 | 初始 Plan | 原生交互零新增 UI | 单行 item 无法呈现决策全文片段与高亮，AC-2 表达力不足 | rejected | 不采用 | DEC-1 |
| 启用 JS 脚本的 Webview | 初始 Plan | 破坏 README/webviewHtml 零脚本契约 | 基线例外一旦打开不可逆 | rejected | 不采用 | DEC-1 |
| 按需全量扫描 + mtime 内存缓存 | 初始 Plan | 实测数据量小（runs.jsonl 50 行/23KB、归档 50 个/约 2MB） | 归档增长到秒级扫描时需缓存分片（当前无必要） | accepted | 数据访问策略（DEC-2） | DEC-2 |
| 预建持久索引文件 | 初始 Plan | 无合法落点：`~/.ddo/` 与 `.ddo/` 均为引擎领地（插件只读） | 引入越界写入破坏只读边界 | rejected | 不采用 | DEC-2 |
| 每次实时扫描不缓存 | 初始 Plan | 实现最简 | 重复搜索各付 ~50 次 spawnSync unzip，交互卡顿 | rejected | 不采用 | DEC-2 |
| 多词 AND 子串 + 按 run 分组 + 纯 CSS radio 过滤 | 初始 Plan | radio-hack 为仓库既有技术（webviewHtml 页签） | 不支持 OR/正则/字段语法（可未来增强） | accepted | 搜索维度与呈现（DEC-3） | DEC-3 |
| 正则/字段限定语法 | 初始 Plan | 可行但输入成本高 | 语法解析与文档负担，「搜索」最小语义已覆盖 | rejected | 留未来，不阻塞 | DEC-3 |
| usage 事件全量入集 + v1 state 门对象兜底 | 初始 Plan | STATE-SPEC §3.7 定义 `.usage.jsonl` 为复盘权威载体 | 双 run 均无决策数据时仅元信息可搜（如实降级） | accepted | 决策记录范围（DEC-4） | DEC-4 |

---

## 数据模型设计

### 实体与字段

SearchRecord（记录集条目）：`runId/title/type/project/workflow/finalStatus/startedAt/endedAt/source`（source 枚举 `index|project|history|legacy-dir`）、`kind`（`meta`=run 元信息一条 / `usage`=.usage.jsonl 事件 / `gate`=v1 state 门对象兜底）、`event?`（seq/at/event/command/stage/phase/option/note/detail）、`gate?`（stage/decision/closedAt）、`searchText`（预拼接小写可搜文本）、`archiveZip?`。SearchIndex：`records[] + unreadable + builtAt`。Match：`record + terms[] + snippet`（服务端预计算 `<mark>` 高亮片段，已转义）。完整字段契约见 Part 01 §3。

### schema 与 DDL（如适用）

纯内存模型，无数据库、无 schema/DDL/迁移；记录集由既有状态文件（runs.jsonl、.state.json、.usage.jsonl、zip）运行时派生。

### 状态与不变量

同一 runId 的 meta 条目唯一；usage/gate 条目依附其 runId 且随源解析降级链生成；runId 去重与源优先级 index > project > history 同 R1；读取失败只影响该 run 的 usage/gate 条目，meta 永不丢失（runs.jsonl 事件行自带元信息）。

### 迁移、兼容与回滚

无持久化状态需要迁移；缓存以「路径 → mtimeMs」为键，文件变更自动失效重解析，重建即回滚。旧数据兼容链：磁盘 `.usage.jsonl` > zip 内 `.usage.jsonl`（v2）> zip 内 state 门对象（v1）> 旧式目录 `<runId>/.state.json` > 仅 meta。

---

## API 接口设计

| 接口/入口 | 请求 | 响应 | 错误与幂等 | 复用标准 | 实现职责 | AI 索引 |
|---|---|---|---|---|---|---|
| 命令 `ddo-flow.searchHistory` | 用户经 InputBox 输入关键词（可空取消） | 搜索 Webview 单例面板（更新 HTML 并 reveal） | 取消静默退出；重复唤起幂等更新 | `extension.js` 既有命令注册模式 | 串联输入 → 数据面 → 渲染 | DEC-1 |
| `historySearch.buildSearchIndex({indexPath, projectRoots})` | 索引路径 + 工作区根列表 | `SearchIndex`（含 unreadable 统计） | 单源失败静默降级计数；mtime 未变复用缓存（幂等） | runDiscovery 数据面惯例（只读、纯 Node 可冒烟） | 三源全量扫描构建记录集 | DEC-2 / DEC-4 |
| `historySearch.searchRecords(index, query)` | 索引 + 查询串（空格分词） | `{matches, truncated}`（≤200 条） | 空查询返回空集不报错 | 纯函数 | 多词 AND 子串匹配 + 高亮预计算 | DEC-3 |
| `searchView.renderSearchHtml(query, result)` | 查询串 + 匹配结果 | 结果页 HTML 字符串（含 `command:` 锚点） | 渲染纯函数化，输入异常返回空态页 | webviewHtml 色板与卡片风格 | 分组/过滤/高亮/空态呈现 | DEC-3 / FR-HIST-5 |
| Webview `command:` 锚点 | `<a href="command:ddo-flow.openRun?…">`（URI 编码 JSON 参数） | 打开对应 run 详情面板 | runId 失效时沿 openRun 既有提示降级 | 既有 `ddo-flow.openRun` 命令 | 结果定位到 run 详情 | FR-HIST-4 |

---

## 算法设计

仅三处非平凡逻辑（完整要点见 Part 01 §4）：

- **记录构建降级链**：逐 runId 依「磁盘 > zip usage > zip state 门对象 > 旧式目录 > 仅 meta」取决策数据；不变量：meta 永不因读取失败丢失。
- **匹配**：查询 trim → 空格分词 → 逐词 `includes`（对预小写 `searchText`）→ 全命中入选；复杂度 O(记录文本总量 × 词数)，当前量级毫秒级。
- **高亮预计算**：取首个命中词上下文窗口（±60 字符）→ 整段 `escapeHtml` → 已转义文本小写对位替换 `<mark>`，规避注入。

---

## 文件变更计划

| 文件/目录 | 变更职责 | 复用或依赖 | AI 索引 |
|---|---|---|---|
| `plugin/src/historySearch.js`（新增） | 搜索数据面：buildSearchIndex / searchRecords / 高亮；mtime 缓存与降级链 | R1 runDiscovery 底层函数、R2 zip 读取、R6 只读惯例 | DEC-2 / DEC-4 |
| `plugin/src/searchView.js`（新增） | renderSearchHtml：分组/过滤/高亮/锚点/空态结果页 | R4 色板与 radio-hack、R7 escapeHtml | DEC-3 / FR-HIST-5 |
| `plugin/src/webviewHtml.js`（微改） | 导出 `DOCS_ROOT_VARS`（现为模块内常量），其余不动 | R4 | DEC-1 |
| `plugin/src/extension.js`（扩展） | 注册 `ddo-flow.searchHistory`（InputBox → build → render）；搜索 panel 单例（panels 注册表模式，`enableScripts:false` + `enableCommandUris:true`） | R5 ensurePanel/openRun | DEC-1 |
| `plugin/package.json`（扩展） | contributes 命令 + view/title 菜单（`$(search)`，`view == ddo-flow.runs`） | 既有 contributes 结构 | FR-HIST-1 |
| `plugin/README.md`（更新） | 特性表/视图/快速开始补「历史查询」 | — | FR-HIST-5 |

不新增网络接口；无外部契约变化；全部变更限于 `plugin/` 目录。

---

## 兼容、稳定性与回滚

| 关注点 | 适用性 | 设计/理由 | 回滚信号 | AI 索引 |
|---|---|---|---|---|
| 只读边界 | 适用 | 全程磁盘直读 + `unzip -p/-l`，无任何写入 | 输出通道出现越界写告警即停 | DEC-5 |
| `command:` URI 版本依赖 | 适用 | `enableCommandUris` 为 ≥1.75 原生能力 | 锚点点击无响应 → 降级为 runId 展示 + 树打开提示（DEC-1 回退条件） | DEC-1 |
| 旧数据兼容 | 适用 | v1 zip / 旧式目录归档经 state 门对象兜底；ephemeral 已删 run 仅 meta 可搜 | 旧 run 决策记录缺失属如实降级，非缺陷 | DEC-4 |
| 性能 | 适用 | mtime 缓存吸收重复 unzip；命中上限 200 + snippet 限额 + HTML ≤512KB | 结果页秒级延迟或超限异常 → 收紧上限/加分片 | DEC-2 / DEC-3 |
| 既有视图回归 | 适用 | 三区树、详情面板、watcher 零改动（变更点不含其逻辑） | F5 回归发现树/面板行为变化即回退本特性 | Non-goals |

---

## Verification Anchor

| 需验证契约 | 可观察结果 | 证据位置 | AI 索引 |
|---|---|---|---|
| 语法门槛 | `node --check plugin/src/*.js` 全部通过 | 终端执行输出 | VA-1 |
| 数据面构建 | 真实 `~/.ddo` 上记录数 ≥ 历史事件数；损坏 zip（重命名模拟）不抛错且计入 unreadable | Node 冒烟脚本输出 | VA-2 / DEC-2 / DEC-4 |
| 决策搜索（AC-2） | 搜「同意」命中含 decision 事件的 run 及其决策条目 | Node 冒烟 + F5 结果页 | VA-2 / VA-3 |
| 元信息搜索（AC-3） | 某 run 标题片段为词命中其 meta 条目 | Node 冒烟 + F5 结果页 | VA-2 / VA-3 |
| 入口与跳转（AC-1/AC-4） | 命令与标题按钮可达；结果卡锚点打开对应详情面板 | F5 Extension Development Host 手动核验 | VA-3 |
| 页面完整性（AC-5） | 过滤器、分组、空态、超限提示均可用 | F5 手动核验 | VA-3 |

---

## 开放问题与 Spec 对应

| 问题 | 确定答案或阻塞原因 | 解决位置 | AI 索引 |
|---|---|---|---|
| PD-1 查询页承载形态与入口 | Webview Panel 单例 + InputBox + `enableCommandUris` 锚点；命令 + 标题按钮两入口 | 本文件 DEC-1；Part 02 §1 | PD-1 |
| PD-2 数据访问与索引策略 | 按需全量扫描 + mtime 内存缓存；HISTORY_CAP 不适用；不落盘索引 | 本文件 DEC-2；Part 01 §2 | PD-2 |
| PD-3 搜索维度 | 多词 AND 子串 + 纯 CSS 过滤（类别/来源）+ 分组 + 上限 200 | 本文件 DEC-3；Part 02 §1 | PD-3 |
| spec 其余开放问题 | 无——spec 无未解决 BQ | — | — |

---

## 风险与下游交接

- **风险与缓解**：① `command:` URI 在个别环境被禁 → 已定义 DEC-1 回退（结果卡展示 runId + 树打开提示）；② 归档规模增长致扫描变慢 → DEC-2 回退条件（缓存分片）；③ 旧 run 无决策数据被误判为缺陷 → 结果页脚注明示 unreadable 与降级来源。
- **Tasking/Coding 读取范围**：本 plan.md（权威契约）+ `plans/01-search-datasurface.md`（数据面细节）+ `plans/02-search-page-design.md`（页面与文件变更细节）。
- **事实失效处理**：分册标 stale 或 revision 变化时，下游停止执行并报告，不得自行修改已批准契约。

---

## Parts Manifest

| 文档 | 职责 | 字符数 | 状态 | AI 索引 |
|---|---|---|---|---|
| `plans/01-search-datasurface.md` | 复用基线明细、DEC-2/4/5 全文、数据模型、构建与匹配算法、性能兼容 | ~3100 | current | FR-HIST-2/3/4、DEC-2、DEC-4、DEC-5 |
| `plans/02-search-page-design.md` | DEC-1/3 全文、流程图、页面信息架构、文件变更计划、Verification Anchor | ~2600 | current | FR-HIST-1/4/5、DEC-1、DEC-3、AC-1…5 |

读取协议：下游从本 plan.md 出发，按 Manifest 读 current 分册；引用格式 `plan rev 1 Part 01 §4`。

---

## 用户确认

- ✅ **同意**：批准当前 revision，进入后续编排。
- ❌ **修改：<反馈>**：反馈应用到新 revision 并重评估，展示变化摘要后重新送审。
- ❓ **提问：<问题>**：只答疑，不改文档、revision 与确认状态。
- 📦 **归档**：按相位 01 §5 归档当前 plan；不代表批准。
- 📦 **归档：<模板名>**：按名精确匹配 `atom-tasks/plan/references/` 下模板生成 tech-design 产物。
