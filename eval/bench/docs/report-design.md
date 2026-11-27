# 报告视觉标准（report-design）——三形式共用单源

> 状态：v1.0（2026-11-27，依据作者小红书系列「开源项目分享：一个只管流程的 AI 编码 skill」五页母版提炼）。
> 本文是 F1 sheet / F2 wechat / F3 xiaohongshu 三种报告形式的**视觉唯一来源**；
> 输入口径与发布布局（尺寸、文件名、目录）仍以 `report-contract.md` 为准，两文互不重叠。
> 变更规则：**改风格先改本文档，再改 `src/report/forms.js` 的 DNA 令牌与 `atom-tasks/report-*/templates/`**；
> 契约层（尺寸/文件名）不受风格变更影响。

## 1. 风格 DNA（五页母版的共同骨架）

暗底点阵 + 青绿/品红双色 + 描边扁平卡片 + 等宽字眉标 + ◆ 要点 + 品牌页脚。
关键词：开发者终端美学 × 知识卡片排版；克制、无渐变、无阴影，靠描边与明度分层。

每页系列骨架（自上而下）：

```
眉标 kicker   NN / ENGLISH-LABEL     mono · 主色 · 宽字距
大标题        结论式中文短句          sans · 特粗 · 近白
副标题        灰色一行说明            sans · 次级灰
主卡片        1px 描边 · 深一档底     内容主体（图/数字/清单）
要点区        一句总结 + ◆ 三条       ◆ 用主色
页脚          细分隔线 + 品牌三件套    Ddo-Code-Flow · MIT · ddoai.cn
```

## 2. 设计令牌（单源 = `forms.js` 常量 `DNA`）

| 令牌 | 值 | 角色 |
|---|---|---|
| `bg` | `#0A0D0F` | 页面底（近黑），叠 40px 点阵 `radial-gradient(rgba(255,255,255,.07) 1px, transparent 1px)` |
| `panel` | `#14171C` | 卡片底（比背景亮一档） |
| `panelDeep` | `#1E2530` | 嵌套更深一层（图框/代码框/规格行） |
| `line` | `#2A3138` | 1px 描边（卡片/分隔线） |
| `ink` | `#F5F7F8` | 标题近白 |
| `body` | `#C9D1D5` | 正文 |
| `dim` | `#8A949C` | 次级说明 |
| `faint` | `#5C6670` | 页脚/最弱文字 |
| `teal` | `#5EEAD4` | **主强调**：眉标、◆、ddo 臂、正向趋势 |
| `pink` | `#F472B6` | **状态色（保留）**：口径/边界声明块左边条、负向趋势；永远配文字标签，不裸用 |
| `mono` | `'SF Mono',ui-monospace,Menlo,Consolas,monospace` | 眉标/代码/路径/规格行 |
| `sans` | `system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif` | 其余全部文字 |

字体比例（1080 宽画布）：眉标 22px/0.2em 字距 · H1 72px · H2 44–52px · 正文 30px · 页脚 22px。

### 角色语义（颜色永远跟着角色走）

- **baseline 臂 = 中性**：panel 底、ink 数值、灰 chip。不抢焦点。
- **ddo 臂 = 主色强调**（emphasis 模式：1 hue + 灰）：teal 数值/描边/chip。
  这是「高亮一臂、灰化其余」的合法用法，不是分类色板。
- **边界/口径 = pink**：诚实边界是本产品的「人工决策点」，对应母版里品红菱形语义。
- **臂身份不靠颜色单独承载**：chip 永远带文字（`纯 prompt` / `+ Ddo-Code-Flow`）。

### 可及性与校验依据（dataviz 六查，2026-11-27 实测）

- `#5EEAD4`/`#F472B6` 在 `#14171C` 暗面上：对比度 ≥3:1 PASS、CVD ΔE 12.1 PASS、常态 ΔE 32.6 PASS。
- 亮度带 FAIL 仅约束**分类系列色板**（多系列同图）；本标准是「单强调 + 状态色」角色用法，
  校验脚本自身 scope 注明不适用。若未来报告加入**多系列图表**，须另选过带系列色，不得沿用 teal/pink。
- 大数字（hero figure）：与正文同族 sans，≥48px，**一页只一个 hero**（quant 页给 ddo 达标率；
  baseline 是次级 stat，用 ink 不用 teal）。比例数字（非对齐列）用字体默认比例宽度，禁 tabular-nums。

## 3. 组件库（模板只允许拼这些）

| 组件 | 规格 |
|---|---|
| kicker | `NN / LABEL`，mono 22px，teal，letter-spacing .2em；编号按每题图组内页序 01–04 |
| 主卡片 | panel 底 + 1px line + 圆角 12px；嵌套层用 panelDeep；**无阴影** |
| 浏览器窗 | macOS 三圆点（#FF5F57/#FEBC2E/#28C840，12px）+ mono url 行，panelDeep 头部，包截图 |
| 规格行 | panelDeep 底 + 1px line + 圆角 10px，`标签 mono dim` 左、`值 mono ink` 右 |
| ◆ 要点 | teal ◆ 16px + body 文字；pink ◆ 仅在声明/负向语境 |
| 趋势符 | 数据算术推导：升 `▲ teal` / 降 `▼ pink` / 平 `◆ dim`；只编码已有数字，不新造结论 |
| 页脚 | 1px lineSoft 细线 + 左 `Ddo-Code-Flow · MIT · ddoai.cn`（mono 22px faint）+ 右轮次号 mono |
| 进度点 | 图组末页右缘 4 点竖列，末点 teal 实心（系列完结记号） |

## 4. 三形式映射

| | F1 sheet | F2 wechat | F3 xiaohongshu |
|---|---|---|---|
| 画布 | 1080 宽，高自适应（fullPage） | 封面 900×383；正文宽 900 | 1080×1440（3:4）×4 页/题 |
| 点阵背景 | 有 | 封面有（PNG）；**正文禁**（粘贴安全：全内联、无渐变） | 有 |
| 页序 | 单页快览 | 封面 + 长图 | `01/A-B TEST` 封面 → `02/DELIVERABLES` 两臂截图 → `03/NUMBERS` 数字页 → `04/FINE PRINT` 口径页 |
| hero | 无（快览） | 无 | quant 页 ddo 达标率 |
| 声明块 | pink 左边条卡片 | pink 左边条 section（内联） | `04` 整页 + pink 边条 |
| 硬约束 | — | 粘贴安全：无 div/class/style/@media，`<span leaf>`，禁 radial-gradient | 标题 ≤20 字；note.md ≤1000 字 |

不变式（沿用契约）：不新造结论性文案；固定声明一律引 `render.js declarationsFor(n)`；
臂身份永有文字标签；负增益如实呈现（▼ pink 不修饰）。
