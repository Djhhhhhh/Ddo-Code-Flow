# Ddo-Code-Flow 存活流水（VS Code 插件）

查看 [ddo-code-flow](../README.md) **全局运行中流水**（存活流水）与六分区流水信息的只读插件。

- **左侧导航**：活动栏「Ddo-Code-Flow」容器 →「存活流水」视图，**按 git 项目分组**两级树（组节点 = 项目名 + 运行数 + `codicon-stack` 彩色标签，`charts.*` 主题色按组名稳定分配；无 git 信息的 run 归入「未定义」组），条目标题截断 18 字、描述为 `type · 位置`，完整信息在 tooltip（数据源 `~/.ddo/index.json` + 各 `.state.json` 惰性校验，与引擎 `guide`/`resume` 判定口径同构；失效条目不展示；`currentStage` 为空的待收束 run 仍展示并配星标）。
- **右侧工作区**：点击流水条目 → WebviewPanel 上下分区（无脚本：纯锚点跳转 + 原生 `<details>` 折叠）：
  - **上分区**：基础信息卡（状态 hero：当前位置 + 运行中/等待确认门/待收束徽章；标题/徽章/元信息 + 节点链水印）｜**流程 DAG**（阶段链星座化：状态色节点、当前节点呼吸光环、入边虚线流动、开启门的阶段挂琥珀虚线环、子流程以品红卫星点挂宿主阶段下方）
  - **确认门卡**：置顶醒目展示（选项 + 开门/呈现/交互时间线，只读）
  - **下分区 · 产出浏览器**：E 区登记文件逐个 `<details>` 折叠，文本内容直接内联（路径在 runDir/projectRoot 双基解析；单文件 ≤48KB、总量 ≤512KB、文本白名单，超限降级为登记行）；**git 工作区变更快照**（`status --porcelain -b` + `diff --stat HEAD`，只读 3s 超时，非仓库自动隐藏）——代码变更一目了然
  - 参考：子流程表 + 环境与旋钮；F 区日志路径页脚
- **图表保真**：全部 SVG 图表快照复用 `docs/index.html` 原文（映射与证据见 [docs-icon-provenance.md](./docs-icon-provenance.md)），颜色取 docs 同值变量，不做改写。插件内标识统一为**节点链**图表（活动栏 / 树条目 / 面板水印）。

## 运行（开发）

1. 用 VS Code 打开**仓库根目录**（`Ddo-Code-Flow`），或单独打开 `plugin/` 目录。
2. `F5` 选择「运行 Ddo-Code-Flow 插件（F5）」启动 Extension Development Host。
   - 打开的是仓库根：launch.json 已带 `--extensionDevelopmentPath=${workspaceFolder}/plugin`；
   - 打开的是 `plugin/` 本身：将 args 中路径改为 `--extensionDevelopmentPath=${workspaceFolder}`。
3. 宿主窗口左侧活动栏出现「Ddo-Code-Flow」容器与「存活流水」视图；点击条目查看流水信息。

## 工程形态

纯 JavaScript、零运行时依赖、无构建步骤（`main` 直接指向 `src/extension.js`）。不产生 `node_modules`；如需打包安装，用 `vsce package`（可选）。

```
src/extension.js      激活 / 命令 / 树 / panel 注册表 / watcher
src/runDiscovery.js   发现与惰性校验（数据面，只读）
src/stateView.js      state → 六分区视图模型（纯函数）
src/webviewHtml.js    视图模型 → HTML（docs 同值样式快照）
src/svgAssets.js      docs SVG 原文快照（Webview 内联层）
media/icons/*.svg     图标资产（明暗双文件制，见 provenance）
media/icon.png        扩展品牌图标（package.json `icon`，256×256）
```

## 配置

| 项 | 缺省 | 说明 |
|---|---|---|
| `ddo-flow.indexPath` | `~/.ddo/index.json` | 全局 run 索引绝对路径 |

## 体验建议

- **悬浮提示更快**：树条目的完整信息（全标题 / runId / 项目 / 启动时间）在悬浮 tooltip；VS Code 悬浮延迟是全局设置，嫌慢（默认 1500ms）可在设置中加入 `"workbench.hover.delay": 300`（毫秒，最小 0）。条目描述已带 `type · 位置 · 启动时间`，常用信息无需悬浮。
