<h1 align="center">Ddo-Code-Flow · VS Code 插件</h1>

<p align="center"><strong>MIT License</strong> · <strong>VS Code ≥ 1.75</strong> · <strong>零依赖</strong> · 简体中文</p>

> **Ddo-Code-Flow 插件**是 [Ddo-Code-Flow](../README.md) 的**只读观测台**：三源聚合**运行中流水（存活流水）、本项目已收口 run 与全局历史**，六分区流水信息、状态文件与产出浏览器一目了然。

---

## 目录

[这是什么](#这是什么) · [特性](#特性) · [安装](#安装) · [快速开始](#快速开始) · [数据面](#数据面) · [视图](#视图) · [配置](#配置) · [工程形态](#工程形态) · [开发与测试](#开发与测试) · [许可证](#许可证)

## 这是什么

ddo-code-flow 引擎把每次运行的状态保存在**状态文件体系**中（全局索引、各 run 的六分区 `.state.json`、轨迹日志与历史归档），但旧版插件只读全局运行中索引——run 一收口就从视图消失，项目内的已收口 run 与全局历史完全不可见。

v1.0.0 起插件把数据面**整体建立在状态文件体系之上**：不再只看索引，而是把三处信息源聚合去重后统一呈现。它不提供任何控制能力：

| 角色 | 职责 | 边界 |
|---|---|---|
| 引擎（CLI） | 写入状态文件体系（state、索引、历史、归档） | 插件不参与、不修改 |
| 插件 | 三源聚合、只读呈现流水与产物 | 无控制操作，对全部状态文件只读 |
| 用户 | 浏览、核验、追溯任意 run | 无需手动打开任何 JSON |

## 特性

| 需要解决的问题 | 提供的机制 |
|---|---|
| run 收口即从视图消失 | 三源聚合数据面（index / project / history），runId 全局去重 |
| 项目内已收口 run 不可见 | 本项目区：扫描工作区 `.ddo/runs/` 全量，与运行中 run 同深度渲染 |
| 已删工作树 / 临时 run 无处追溯 | 历史区：`runs.jsonl` 事件 + zip 归档 `unzip -p` 流式预览 |
| 「待收束」与「已收口」不可区分 | `finalStatus` 以 history 事件为唯一依据，done / aborted / failed 徽章 |
| 状态文件本体看不到 | 产出浏览器置顶内联 `.state.json`（JSON 结构染色）与 `.usage.jsonl` 轨迹日志 |
| 历史只能翻、不能搜 | 历史查询页：关键词搜全量 run 的决策记录（门决议/交互反馈/执行摘要/回滚原因）与元信息，多词 AND、纯 CSS 过滤、命中高亮 |
| 状态变更不刷新 | 三点监听（索引 / 项目运行目录 / history），300ms 去抖 |
| 只想看、不能误动 | 全程只读，无启动 / 推进 / 收口等任何控制操作 |

## 安装

**前置要求**

- 已在使用 [ddo-code-flow](../README.md) skill——插件呈现其运行数据，自身不产生数据。
- VS Code ≥ 1.75。

**安装发布版**：从扩展市场安装，或用 vsix：

```bash
cd plugin && npx @vscode/vsce package --no-dependencies
code --install-extension ddo-code-flow-<version>.vsix
```

**开发调试（F5）**：用 VS Code 打开**仓库根目录**，`F5` 选择「运行 Ddo-Code-Flow 插件（F5）」启动 Extension Development Host（launch.json 已带 `--extensionDevelopmentPath=${workspaceFolder}/plugin`）；若单独打开 `plugin/` 目录，把 args 路径改为 `${workspaceFolder}`。改代码后需 **Developer: Reload Window**（扩展模块在宿主激活时加载，不热更新）。

## 快速开始

```text
活动栏「Ddo-Code-Flow」→「存活流水」视图（三区，空区自动隐藏）
  运行中（按项目分组）   → 点击条目 → 右侧面板：状态 hero + 流程 DAG + 确认门 + 产出浏览器
  本项目（已收口）       → 点击 → 同深度渲染六分区与产物，徽章显示 finalStatus
  历史（默认折叠）       → 点击 → zip 内 state 与产物流式预览（无 zip 时降级为历史事件卡）
```

**历史查询**：视图标题栏搜索按钮或命令面板「历史查询：搜索决策与关键信息」→ 输入关键词（多词空格分隔，AND 匹配）→ 结果页按 run 分组呈现命中（决议/轨迹/元信息分类 + 来源过滤，纯 CSS 无脚本）→「查看详情」锚点跳转该 run 详情面板。搜索覆盖三源全量 run（不受历史区 50 条展示上限约束），决策数据降级链：磁盘 `.usage.jsonl` > zip 内 `.usage.jsonl` > zip 内 state 门对象（v1）> 旧式目录归档。

产出浏览器默认选中 `.state.json`；`.usage.jsonl` 是这条 run 的完整使用轨迹。悬浮树条目可看全量信息（嫌悬浮慢可加 `"workbench.hover.delay": 300`）。

## 数据面

三源只读聚合，源优先级 index > project > history（同一 runId 只出现一次）：

| 源 | 文件 | 内容 |
|---|---|---|
| index | `~/.ddo/index.json` | 运行中登记（start 注册 / finish 注销）——运行中区主数据 |
| project | `<workspace>/.ddo/runs/<type>/<runId>/.state.json` | 全量 run（含已收口，`currentStage: []`）——本项目区 |
| history | `~/.ddo/history/runs.jsonl` + `<runId>.zip` | 收口事件（`finalStatus`/`endedAt`，同 runId 多行末次权威）与归档——历史区及已收口判定 |

关键判别：**「待收束」（位置空未收口）与「已收口」（finish 清空）在 state 与索引中不可区分**，`finalStatus` 只存在于 history 事件——这是已收口徽章的唯一依据。历史区展示上限 50 条（组节点显示 N/总数）。

## 视图

- **左侧三区树**：运行中区按 git 项目分组（`charts.*` 主题色按组序分配，无 git 信息归「未定义」组）；条目描述 `type · 位置/finalStatus · 启动时间`，标题截断 18 字、完整信息在 tooltip；位置空的待收束 run 配星标图标。
- **右侧面板**（无脚本 Webview：锚点跳转 + 原生 `<details>` 折叠）：
  - **基础信息卡**：状态胶囊（运行中 / 等待确认门 / 待收束 / 已收口·done|aborted|failed）+ 类型 / 工作流 / schema 版本 / 来源徽章 + runId、启动、收口、项目、git 元信息；
  - **流程 DAG**：阶段链星座化——状态色节点、当前节点呼吸光环、入边虚线流动、开启门的阶段挂琥珀虚线环、子流程以品红卫星点挂宿主阶段下方；
  - **确认门卡**：选项与开门 / 呈现 / 交互时间线（只读）；
  - **产出浏览器**：置顶状态面文件（`.state.json` 正常 JSON 结构染色格式化、`.usage.jsonl` 轨迹日志）+ E 区登记产物（md 渲染带目录导航，路径 runDir/projectRoot 双基解析）+ git 工作区变更快照（`status --porcelain -b` + `diff --stat HEAD`，只读 3s 超时）；
- **内联限额**：单文件 ≤48KB、产物总量 ≤512KB、文本白名单（含 `.jsonl`/`.log`），超限降级为登记行；归档 run 产物经 zip 流式读取，同一限额。
- **图表保真**：全部 SVG 图表快照复用 `docs/index.html` 原文（映射与证据见 [docs-icon-provenance.md](./docs-icon-provenance.md)），颜色取 docs 同值变量，不做改写。

## 配置

| 项 | 缺省 | 说明 |
|---|---|---|
| `ddo-flow.indexPath` | `~/.ddo/index.json` | 全局 run 索引绝对路径（支持 `~` 前缀）；history 与 tmp 目录由其同目录推导（`~/.ddo/history`、`~/.ddo/tmp`，与引擎 `ddoHome` 布局一致） |

## 工程形态

纯 JavaScript、零运行时依赖、无构建步骤（`main` 直接指向 `src/extension.js`），不产生 `node_modules`。

```text
src/extension.js      激活 / 命令 / 三区树 / panel 注册表 / 三点 watcher / 历史查询入口
src/runDiscovery.js   三源聚合发现与惰性校验（数据面，只读）
src/historySearch.js  历史查询数据面：全量记录集构建 + 多词 AND 匹配 + 高亮（只读）
src/searchView.js     历史查询结果页渲染（分组 / 纯 CSS 过滤 / command: 锚点）
src/stateView.js      state → 六分区视图模型（纯函数）
src/webviewHtml.js    视图模型 → HTML（docs 同值样式快照 + JSON 结构染色）
src/previewView.js    md 渲染 / 文件树（产出浏览器预览层）
src/svgAssets.js      docs SVG 原文快照（Webview 内联层）
media/icons/*.svg     图标资产（明暗双文件制，见 provenance）
media/icon.png        扩展品牌图标（package.json `icon`，256×256）
```

## 开发与测试

```bash
node --check plugin/src/*.js   # 语法检查（无构建步骤）
```

数据面可直接在 Node 中冒烟（`require('./src/runDiscovery').discoverAll({...})`）；界面行为在 Extension Development Host（F5）中核验。图标与样式的来源约束见 [docs-icon-provenance.md](./docs-icon-provenance.md)。

## 许可证

[MIT](../LICENSE) © 2026 Djhhhhhh
