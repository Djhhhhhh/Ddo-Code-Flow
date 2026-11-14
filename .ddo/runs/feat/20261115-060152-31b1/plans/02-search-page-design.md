# Part 02 · 查询页面（承载形态、交互与文件变更）

> plan rev 1（split）· 上游 spec：FR-HIST-1（查询入口）、FR-HIST-5 / AC-5（完整页面设计）、FR-HIST-4 / AC-4（结果跳详情）；本 part 覆盖页面决策、信息架构、流程与文件变更计划。

## 1. 页面决策

### DEC-1 查询页承载形态与入口（回答 spec PD-1）

**结论**：独立 Webview Panel（标题「历史查询」，单例）承载结果页；关键词经 VS Code 原生 `showInputBox` 输入；panel 以 `enableScripts: false` + `enableCommandUris: true` 创建，结果卡用 `<a href="command:ddo-flow.openRun?…">` 锚点跳详情。入口两处：命令面板命令 `ddo-flow.searchHistory` + 存活流水视图标题栏搜索按钮（`$(search)`）。

| 候选 | 状态 | 关键差异与结论 |
|---|---|---|
| Webview Panel + InputBox + `enableCommandUris` | **accepted** | 保持零 JS 脚本基线即可获得富结果呈现（高亮/分组/上下文片段）与命令跳转闭环；`command:` URI 是 VS Code 原生 Webview 能力，无脚本参与 |
| QuickPick 即时过滤 | rejected | 输入体验好但单行 item 无法呈现决策全文片段与高亮，AC-2 的「看出决策内容与所属 run」表达力不足 |
| 启用 JS 脚本的 Webview（输入框内嵌、即时过滤） | rejected | 破坏仓库「无脚本 Webview」既定基线（README 与 webviewHtml 契约），收益不值得例外 |

**依据/权衡**：README 声明零脚本为设计基线；`enableCommandUris` 在引擎 ≥1.75 可用。**回退条件**：若目标 VS Code 版本禁用 `command:` URI，则降级为结果卡仅展示 runId + 提示从左侧树打开（AC-4 弱化），不影响其余能力。

### DEC-3 搜索维度与结果呈现（回答 spec PD-3）

**结论**：关键词为多词 AND 子串匹配（大小写不敏感，空格分词）；结果按时间倒序、按 run 分组（组头为 run 元信息卡，组内为命中记录条目）；页面顶部提供纯 CSS radio 过滤器两组——命中类别（决策/轨迹事件/元信息）与来源（运行中/本项目/历史归档/旧式归档）；命中渲染上限 200 条，超出截断并提示收窄关键词。

**依据**：radio-hack 纯 CSS 过滤是仓库既有技术（webviewHtml 产出浏览器页签），属性选择器 `:checked ~ … [data-x]` 可零脚本过滤；多词 AND 是「搜索」最小充分语义。**权衡**：不支持 OR/正则/字段限定语法——用户需求是「搜索决策与关键信息」，子串 AND 已覆盖，语法增强留给未来（不阻塞）。

## 2. 主流程与异常流

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

异常流：索引构建中单源失败（如 zip 损坏）→ 该 run 降级仅 meta 并计 `unreadable`；InputBox 取消 → 静默退出；空结果 → 空态引导（提示换词或查看过滤器状态）。

## 3. 页面信息架构（searchView）

- **顶部**：查询词回显 + 命中统计（N 个 run · M 条记录）+ 两组 radio 过滤器（类别 / 来源）。
- **中部**：按 run 分组的结果——组头（run 标题、runId、类型、finalStatus 徽章、时间、「查看详情」command 锚点）+ 组内命中条目（事件类型徽章、stage:phase、时间、高亮片段；决策类条目琥珀色徽章）。
- **底部**：不可读统计脚注 + 超上限截断提示 + 「重新搜索」引导（重跑命令）。
- **样式**：复用 `DOCS_ROOT_VARS` 色板与既有卡片风格（webviewHtml 微改导出，见文件变更计划）。

## 4. 文件变更计划

| 文件 | 职责与契约 |
|---|---|
| `plugin/src/historySearch.js`（新增） | 搜索数据面（纯 Node 可冒烟）：`buildSearchIndex({indexPath, projectRoots}) → SearchIndex`（含 mtime 缓存与降级链）、`searchRecords(index, query) → {matches, truncated}`、`highlight(record, terms) → snippet`。只读，无 vscode 依赖 |
| `plugin/src/searchView.js`（新增） | `renderSearchHtml(query, result) → string`：结果页 HTML（分组/过滤/高亮/锚点/空态），复用色板与转义 |
| `plugin/src/webviewHtml.js`（微改） | 导出 `DOCS_ROOT_VARS`（现状为模块内常量），其余不动 |
| `plugin/src/extension.js`（扩展） | 注册 `ddo-flow.searchHistory`：InputBox → build → render；搜索 panel 单例（复用 panels 注册表模式，key=`__search__`，`enableScripts:false` + `enableCommandUris:true`）；重复唤起更新 HTML 并 reveal |
| `plugin/package.json`（扩展） | contributes：命令 `ddo-flow.searchHistory`（「历史查询：搜索决策与关键信息」）+ view/title 菜单（`$(search)`，`view == ddo-flow.runs`） |
| `plugin/README.md`（更新） | 特性表/视图/快速开始补「历史查询」说明 |

不新增 API/网络接口；无外部契约变化；全部变更限于 `plugin/` 目录。

## 5. Verification Anchor（验收锚点，非测试计划）

1. `node --check plugin/src/*.js` 全部通过（零构建工程形态的语法门槛）。
2. Node 冒烟（对齐 README 数据面冒烟惯例）：真实 `~/.ddo` 数据上 `buildSearchIndex` 记录数 ≥ 历史事件数；`searchRecords(索引, '同意')` 能命中含 `decision` 事件的 run；以某 run 标题片段为词能命中其 meta 条目；损坏输入（单 zip 重命名模拟）不抛错且计入 `unreadable`。
3. F5 手动核验：AC-1 入口可达；AC-2/AC-3 关键词命中；AC-4 锚点跳详情；AC-5 页面完整可用（过滤、空态、超限提示）。
