# Part 04 · 报告模板、目录落位与验收映射

> 服务 FR-11、FR-12、FR-14、AC-11、AC-12、AC-14、AC-15。

## 1. 判定规则（引擎性约束，需求 §8）

- 结果层不做加权总分；过程层只呈现「有/无 + 数字」；增益按题呈现（Δ结果、Δ过程、Δtoken 逐指标）；负增益/无差异如实写入；不合成单一性价比分数。
- 呈现顺序：人类可读区在前（截图/结论），量化表在后，AI 索引（指标 id）仅末列。

## 2. DEC-7 报告模板（reports/）

| 产物 | 形态 | 契约 |
|---|---|---|
| 每题卡片 `report/card-<题名>.md` | markdown | 头部：模型 · 题型 · 题名；直观区：初始/旋转 90°/窄屏/两帧差分 四组截图相对链接（页面题）或产物清单（非页面题）；量化区：两栏对照表（纯 prompt / + Ddo），行集 = 该题全部指标 + token 合计（含 ×N 倍率）；结论段：按模板生成初稿 + 人工可改写区（标注「以下为人工结论」分隔） |
| contact sheet `report/sheet-<题名>.png` | PNG | 三组截图并排拼图（HTML 模板 + chromium 截图实现，标注组别与臂别） |
| 汇总页 `report/summary.md` | markdown | 三栏（页面题/设计调研/执行）+ 关键量化差异表 + 适用边界（需求 §2 表原文）+ 小样本声明 + token 口径声明四条 + 各臂失败/超时记录 |
| 公众号长图 `report/platform/wechat.html`（可导出 PNG 长图） | HTML/PNG（rev2） | 公众号排版：标题 + 卡片图/拼图嵌入 + 关键 Δ 数字 + 结论金句 + **固定声明段**（小样本 + 诚实边界 + token 口径）；chromium 截图导出长图 |
| 小红书竖版卡 `report/platform/xiaohongshu.png` | PNG 3:4（rev2） | 竖版大字对比卡（HTML 模板渲染截图）：核心 Δ 数字 + 双臂截图对比 + 话题标签 + **固定声明段** |
| 模板 `reports/templates/{card.md.tmpl,summary.md.tmpl,sheet.html.tmpl,wechat-longform.html.tmpl,xiaohongshu-card.html.tmpl}` | 模板 | 占位符与 metrics/*.json 字段一一对应；小样本与诚实边界声明为**一切形式**（含平台物料）的模板固定段（不依赖生成端记得写——FR-12 结构化保证） |

- **报告形式注册表（rev2，DEC-9）**：`render.js` 内单一注册表 `{card, sheet, summary, wechat, xiaohongshu}`；运行 profile 的 `reports` ⊆ 注册表（装配校验见 Part 02 §1）；新增形式 = 加模板 + 注册一项，不改数据契约与既有形态。

- 数据流：`metrics/{probe,process,token,result}.json` → `lib/report/render.js` 单向渲染（按 profile.reports 选形式集）；渲染器不改数据、不做聚合判断。
- 平台物料边界（rev2）：只产出本地 HTML/PNG，不接入公众号/小红书 API、不自动上传；发布由人工执行（Non-goal）。
- 对外发布物 = 汇总页 + 卡片集复制到 `eval/bench/reports/<轮次Id>/`（含 sheet）；runs/ 沙箱不进入对外包。

## 3. 目录落位清单（FR-14/AC-14）

```text
eval/bench/
  model-quick-eval.subflow   # Part 02 §7（JSON 流水线声明）
  cli.js                     # Part 02 §7
  lib/{sandbox,driver,policy,collect/*,report/*}.js
  bank/{core/*,rotating/*}
  probes/threejs-orbit.probe.js
  runs/                      # 运行期沙箱（每轮一目录，clean 显式清理）
  reports/{templates/{card,summary,sheet,wechat-longform,xiaohongshu-card}.tmpl,<轮次Id>/}
  rubric.md
  prompt-rules.md
  package.json               # 仅 devDependencies（playwright）
```

- 与既有 `eval/` 约定共存：`eval/runs`、`eval/verify`、`eval/showcases`、`eval/design` 零改动；`eval/bench/` 为新增兄弟区。
- 入库边界：**不修改 `.gitignore`**（本 run 红线）——`runs/` 沙箱默认不入 git 由编排器不执行 git add 保证（报告产物与代码入库走正常提交流程）；编排器在收尾输出提醒「runs/ 含沙箱大目录，提交前自行处理」。
- Playwright 浏览器二进制落在用户级缓存（`playwright install chromium` 一次性），不入仓库。

## 4. DoD → AC → 部件映射（验收对照）

| DoD（需求 §11） | AC | 部件（分册 §） |
|---|---|---|
| 1 一键 A/B + 自动报告 | AC-1 | P2 §1/§6 |
| 2 auto 模式可用可记录 | AC-10 | P1 §3；P2 §4–§5 |
| 3 baseline 对等通道 + 自检 | AC-3 | P2 §5 |
| 4 页面题入库跑通（截图+探针） | AC-6 | P3 §1/§3；P4 §2 |
| 5 design+execute 各 1 道跑通 | AC-7 | P3 §2/§4 |
| 6 过程层 5 信号 + 对称性数字 | AC-8 | P3 §5.1 |
| 7 token 按组/题/阶段 + 口径 | AC-9 | P3 §5.2 |
| 8 prompt-rules + prompt.diff 复核 | AC-13 | P3 §6 |
| 9 报告模板落地 | AC-11 | P4 §2 |
| 10 边界与小样本声明入所有报告 | AC-12 | P4 §2（模板固定段） |
| 11 ≥1 模型完整跑通一轮 | AC-15 | P4 §5 验证锚点 D |

## 5. Verification Anchor（验证锚点，非测试计划）

| 锚点 | 覆盖 | 手段 |
|---|---|---|
| A 引擎单测 | gate auto 全分支（Part 01 §3.4） | `node --test tools/tests/gate-auto.test.js`（并保持既有 119 用例全绿） |
| B 编排 dry-run | 五步链路 + 报告渲染 + 对称性自检 | `cli.js run --dry-run`（stub 会话）端到端断言产物集 |
| C 探针黄金样例 | A1–F1 判定正确性 | 预置一个手工「满分」index.html（本仓库资产，非题解泄露——评定规则公开的参考实现，仅测试探针自身）与若干缺陷变体，断言逐项判定 |
| D 真实轮（AC-15） | 全链 | 用户环境（model_id + 两 sid + cc-switch）完整一轮，产出可展示卡片；环境不可得时 D 推迟并显式记录（spec 假设行），A–C 仍须全绿 |

## 6. 开放风险与回退

| 风险 | 影响 | 回退/缓解 |
|---|---|---|
| headless 固定 session id 不可用且 transcript 探测失败 | token 混合，AC-9/15 不可达 | 编码首日验证（P2 §3 双路径）；均失败则阻塞上报，不降级继续 |
| stream-json 多轮应答不可行 | baseline 澄清通道降级 | 降级为「单轮 + 声明假设」并在对称性记录标注通道差异（AC-3 自检输出「不一致+原因」，如实呈现） |
| cc-switch 库路径不可探测 / 流式漏记 | token 缺口 | 显式 `--ccswitch-db`；漏记行单独计数呈现（P3 §5.2 边界） |
| CDN（unpkg）不可达 | 页面题两臂同败 | 沙箱内缓存 three@0.160.0 本地镜像 + importmap 改写本地路径（两臂同改，控变量保持；版本仍锁定） |
| 话语 vs 实际测试匹配误判 | 过程层「声称与实际差异」噪声 | 词典可配置 + 报告标注半自动；抽检校准 |
| runs/ 体积 | 仓库膨胀 | clean 显式清理 + 收尾提醒（不依赖 .gitignore） |

## 7. 文件变更计划（报告层）

| 文件 | 职责/契约 |
|---|---|
| `eval/bench/lib/report/render.js` | metrics → 各报告形式单向渲染（形式注册表，§2 契约） |
| `eval/bench/lib/profile.js` | 运行 profile 装配与校验（Part 02 §1） |
| `eval/bench/reports/templates/*` | card/summary/sheet/wechat-longform/xiaohongshu-card 五模板（固定声明段内嵌） |
| `eval/bench/rubric.md`、`prompt-rules.md` | Part 03 §6 契约的正式产物 |
