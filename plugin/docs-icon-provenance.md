# 图表复用溯源与比对证据（AC-2）

来源：`docs/index.html`（快照基准 2026-11-13 19:34）；映射契约：run `20261115-010356-6057` plan R1 分册 02 §4。

## 分层规则（DEC-4）

- **Webview 内联层**（`src/svgAssets.js`）：docs 对应行**字节级快照** + 同值 CSS 变量（`:root` L38–53）与 `.live-star` 规则（L560）——渲染与 docs 像素一致，零改写。
- **图标文件层**（`media/icons/`）：VS Code 独立加载图标文件，采用**明暗双文件制**；全部文件为合法独立 SVG（含 `xmlns` 命名空间声明——网页内联语境不需要，独立 XML 文档必需；缺失时解析为空图，即 2026-11-15 修复的活动栏空白槽位问题）。

## 图标文件清单（2026-11-15 修订 3：双文件明暗制）

| 文件 | 用途 | 颜色 | 依据 |
|---|---|---|---|
| `activity.svg` | 活动栏容器 | `#E6F1FF`（docs `--ink`） | VS Code 以单色蒙版渲染活动栏图标并按主题前景自动着色，单文件即适配明暗（manifest 仅支持单路径） |
| `run.dark.svg` / `run.light.svg` | 流水树条目 | `#E6F1FF` / `#1C2A45`（docs `--line`） | `iconPath:{light,dark}` 双版本；暗色沿用 docs 墨色，亮色取 docs 线色保证白底对比 |
| `run-completable.dark.svg` / `run-completable.light.svg` | 待收束条目星标 | `#00FFCC`（docs `--cyan`）/ `#00A37F`（cyan 同相加深） | 同上；亮色加深为亮底可读（用户授权「纯色样式可根据实际情况适当变化」） |
| `media/icon.png` | 扩展面板品牌图标（package.json `icon`） | docs 色板 | 程序生成 256×256 PNG（深色卡片 + 同构节点链），非 SVG 快照 |

分组标签（项目分组节点）不属于 docs 资产：使用 VS Code 内置 codicon `layers`（三层堆叠方框）+ `charts.*` 主题色按组序分配（修订 7）。

**流程 DAG（修订 9）**：品牌衍生图——把阶段链按节点链标识的语义放大（节点+贝塞尔弧），节点/边的全部色值取 docs `:root` 变量（`--cyan/--ok/--warn/--ink-3/--magenta/--line/--panel`），动效为自有 CSS/SMIL；属用户授权的布局层衍生，非 docs 逐字节快照。

图形结构一律取 docs 原文：节点链 L807–819、live-star L1193。文件层允许且仅允许四类适配：

1. **xmlns 补全**：根级补 `xmlns="http://www.w3.org/2000/svg"`（独立 SVG 合法性，必需）；
2. **颜色字面化**：`var(--ink)` / `currentColor` / 类规则 → 计算色字面值；亮色版本按上表换算；
3. **透明度归一**：`opacity` → `1`（蒙版渲染可见性；用户授权「图形结构不变，纯色样式可根据实际情况适当变化」）；
4. **视口裁切**：节点链图标 `viewBox` 自 `0 0 100 100` 收紧为 `20 33 54 37`（图形包围盒 + 边距，几何与元素树零改动；解决图标槽位内图形占比过小——修订 4）。

## 比对方法

1. 结构一致：`diff <(sed -n '807,819p' docs/index.html) plugin/media/icons/run.dark.svg` 仅允许出现上述三类适配行；`run.light.svg` 与暗色版仅颜色值不同。
2. 取色比对：暗色版 `#E6F1FF` / `#00FFCC`，亮色版 `#1C2A45` / `#00A37F`。
3. 独立渲染检查：每个图标文件单独栅格化必须有实际内容（xmlns 守门，空图即回归）。

## 不再挂载（2026-11-15 修订 1）

host-ic 系列（L1166–1178）、`archWires`（L955，JS 运行时绘制）、docs HTML/CSS 拟物区块——标识统一为节点链，插件不使用。

## 快照生成

以 docs 行号为唯一依据提取，禁止手绘新图；docs 更新后按行号重提并同步本文件。
