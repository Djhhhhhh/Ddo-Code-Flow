# Part 03 · 题库、探针与三层数据提取

> 服务 FR-5、FR-6、FR-7、FR-8、FR-9、FR-13、AC-5–AC-9、AC-13。

## 1. DEC-8 题包 schema（bank/）

```text
bank/core/q_threejs-orbit-scene/
  meta.json        # { name, line: "ui"|"design"|"execute", core: true, three_lock: "0.160.0", signals: [...] }
  prompt.raw.md    # 用户原始 prompt（需求 §4.1 冻结原文，一字不改）
  prompt.final.md  # 出题层修正后 prompt（= raw + prompt.diff 应用结果）
  prompt.diff      # 修正差异（本轮三道核心题：空 diff，原文即终稿；规则见 §6）
  clarify.json     # 可澄清项冻结清单：[{ id, 关键词[], 应答 }]（两臂应答唯一同源）
  acceptance/      # 隐藏验收：页面题 = 探针清单引用（probes/）；非页面题 = 验收测试与判定脚本
  fixture/         # 非页面题沙箱模板（页面题为空/占位）
bank/core/q_export-command/ …      # design 线路（隐藏验收四条 + fixture：小型 CLI 项目含 .ddo/runs 序列化约定）
bank/core/q_regression-trap/ …     # execute 线路（fixture：3 命令文本处理库 + 通过的回归测试）
bank/rotating/                     # 轮换题登记（另两道页面题 + 题 3 可选题库：meta + prompt 要点占位，本轮不跑通）
```

- 题组组装规则（AC-5）：编排器按需求 §3 表校验——题 1 页面必备、题 2 design/execute 轮换（轮换状态存 `bank/rotating/rotation.json`）、题 3 可选；「核心集 ≥1 + 当轮新增 ≥1」由调用方题单+`meta.core` 校验；防污染三规则写入 `rotation.json` 维护说明（不进公开语料由流程外保证，同题不连续两轮与年度替换由编排器校验）。

## 2. fixture 契约（DEC-9）

- `q_regression-trap` fixture：小型文本处理库——3 个已有命令（如 convert/count/split）、`parse_duration()` 等纯函数、一套 node:test 回归测试（全绿基线）；隐藏验收脚本 `acceptance/verify.js`：`--uppercase` 生效断言 + 全量回归重跑 + 「改动文件白名单」比对（越界改动文件数来源）。
- `q_export-command` fixture：微型 CLI 项目（2–3 个既有命令、`.ddo/runs/` 样例记录、明确序列化风格）；隐藏验收：非法 `--format` 报错、`--output` 缺省行为、导出字段与 `.ddo/runs/` 记录结构一致、产物引用被调研文件（grep 断言 spec/计划文档中出现 fixture 真实文件名）。
- 两 fixture 均为静态文件模板（无网络、无依赖安装），复制即用；git 仓库形态（fixture 内含 `.git/`，供 `git diff` 提取改动范围）。

## 3. 页面题探针（DEC-6，FR-6/AC-6）

`eval/bench/probes/threejs-orbit.probe.js`（Playwright chromium）：

| 步骤 | 内容 | 对应验收项 |
|---|---|---|
| 1 加载 | `file://` 打开两臂产物 index.html，等 `window.__app`；CDN 走 unpkg importmap（沙箱网络放行） | A1 |
| 2 场景遍历 | traverse 收集 meshes/lines/lights；几何参数、材质标量、颜色 hex 计数（需求 §4.1 参考代码为基准） | A2–A9, B1–B3 |
| 3 控件 | `enableDamping`、`minDistance/maxDistance` 读取 | C1–C2 |
| 4 响应式 | 视口改 375×812，比 canvas 宽差与相机 aspect | C3 |
| 5 动画 | 500ms 两次读 `galaxy.rotation.y` 与卫星 rotation | D1–D2 |
| 6 DOM | 标题与四状态图例文本存在性 | E1 |
| 7 画面 | 截图亮度均值与非纯色判定 | E2 |
| 8 帧率 | 3 秒 rAF 计数（参考项，单列不并入达标率分母争议——按需求列为 F1 参考档） | F1 |
| 9 可访问性 | axe-core CDN 注入运行，问题数单列（不进达标项，仅呈现） | 附加观测 |

- 量化输出 `metrics/probe.json`：`{ 达标项/总项, 逐项 {id, 判定, 实测, 期望} }`——总项 = A1–E2（21 项），F1 参考档单列（需求标注「参考」）。
- 截图四组（`report/shots/`）：初始 / 旋转 90°（page.evaluate 设置 OrbitControls 方位角后渲染帧）/ 375px 窄屏 / 两帧差分（相邻两帧像素差非零比例）。三组并排由 Part 04 contact sheet 拼装。

非平凡算法（不变量与边界）：

- **A5 球面均匀度**：8 个卫星世界坐标 → 单位化 → 两两点积 `acos` 取最小夹角；判定 ≥35°。输入依赖 A4（半径 3±0.05）先通过否则该项与 A4 同判失败（关联降级，避免连锁误判）。复杂度 O(n²)=28 对。
- **两帧差分**：同视口连拍两帧 PNG，逐像素 RGB 差 > 阈值的像素占比 > 0.1% 判「动画运行」。
- **A9 颜色分组**：`#`+`getHexString()` 小写计数比对 `{22c55e:3, ef4444:2, 3b82f6:2, 9ca3af:1}`（材质共享时按 mesh 实例计，非材质对象计数）。

## 4. 非页面题量化（FR-7/AC-7）

- 执行：在对应臂沙箱内跑 `acceptance/verify.js`（node:test 形态），stdout/exit code 捕获为 `metrics/result.json`：验收用例通过数/总数、回归通过数/总数、被破坏的原有功能数、改动文件数/越界改动文件数（fixture git diff 与白名单比对）、与其他选项组合用例结果。
- `q_export-command` 产物完整性：读 `.ddo/runs/**/spec.md`、计划类产物（存在性 + 引用 fixture 文件断言）；`.state.json`/E 区登记提供「声明产物数/通过校验数」（Part 01 基线表 E 区行）。

## 5. 过程层与成本层提取（FR-8/FR-9/AC-8/AC-9）

### 5.1 过程层（`metrics/process.json`）

| 信号 | 二元判定 | 量化指标（含负面计数） | 提取来源 |
|---|---|---|---|
| 先对齐再动手 | 首个写文件工具调用前存在读文件/调研 | 编码前读取文件数、调研次数、spec 章节数 | 两臂 transcript JSONL（工具调用序列时间轴）+ ddo 臂 `.ddo/` |
| 交付前自检 | 交付声明前实际运行测试 | 测试运行次数、执行用例数、**声称与实际差异**（transcript 中「已运行/已测试」话语 vs 实际 Bash 测试调用比对） | transcript + 沙箱测试日志 |
| 模糊处停下来 | 显式处理歧义 | 澄清请求数、显式假设条数、**未处理歧义数**（题包预标歧义点 − 已处理数） | transcript + clarify 问答记录 + spec 假设节 |
| 改动范围受控 | 越界改动 = 0 | 改动文件数、**越界改动文件数**、改动行数 | 沙箱 `git diff --numstat` + 白名单 |
| 阶段纪律 | 无未获决议推进 | 阶段推进记录数、跳过阶段数、未获决议推进次数（引擎拦截事件计数） | ddo 臂 `.state.json` + `.usage.jsonl`（advanced/decision 事件）；baseline 臂恒为 0（无工作流，如实记录） |
| 澄清对称性 | 两组信息一致 | 应答追溯表（Part 02 §5） | 两通道应答记录比对 |

- transcript 解析为通用提取器 `lib/collect/trajectory.js`（工具调用按时间轴分类：读/写/测试运行/提问）；「话语 vs 实际」匹配用关键词规则（声明类话语词典可配置），半自动项在报告中标注提取方式。

### 5.2 成本层（`metrics/token.json`）

- 数据源：cc-switch SQLite `proxy_request_logs`，`node:sqlite` 只读连接（本机 Node v26.3；ARM 上目标环境需 ≥22.5——写入报告环境声明）。库路径解析序：`--ccswitch-db` > `DDO_CCSWITCH_DB` > 默认探测（macOS Application Support 常见路径，探测失败则要求显式传入）。
- 聚合维度：按组（两 sid）/按题（轮次内每题起止时刻窗，取自 round.json 时间戳）/按阶段（仅 ddo 臂：`.usage.jsonl` 的 `activated/decision` 事件时间轴把 created_at 区间切分为 spec/实现/验证窗）。
- 字段：`session_id, provider_id, input_tokens, output_tokens, total_cost_usd, created_at`；`cache_read/cache_write` 列存在性自适应（PRAGMA table_info 探测，缺失则记录 `cache_fields: false`）。
- 输出含调用轮次（行数）与口径声明四条原文（需求 §5.3：同模型对照/代价换收益/缓存口径/流式漏记）。
- 边界：cc-switch 漏记行（null token）单独计数呈现，不代入合计也不 silently 丢弃。

## 6. prompt 修正规则库（FR-13/AC-13）

- `eval/bench/prompt-rules.md`：出题层修正规则（补可解性：接口名/字段名/环境约束；消歧义；统一术语；**禁止**补需求决策——次数/策略/优先级）+ `prompt.diff` 固定模板（段落实体：位置/类型/修改前/修改后/理由）。
- 流程落位：新增/修订题时按规则产出 diff → 人工复核（复核人签署行）→ 冻结四件套（raw/final/clarify/acceptance）；本轮三道核心题 diff 为空（原文即可验收），作为规则库的首批样例记录。
- `rubric.md`：评分细则 = 结果层四维度定义 + 过程层信号判定标准 + 页面题 A–F 清单判读规则 + 预期行为清单（各题「工作流预期行为」条文，来自需求 §4 各题）。

## 7. 文件变更计划（提取层）

| 文件 | 职责/契约 |
|---|---|
| `eval/bench/probes/threejs-orbit.probe.js` | 页面题探针与截图（§3 全表） |
| `eval/bench/lib/collect/trajectory.js` | transcript JSONL → 时间轴事件（读/写/测试/提问分类） |
| `eval/bench/lib/collect/process.js` | 过程层六行信号量化（§5.1 表） |
| `eval/bench/lib/collect/token.js` | cc-switch 只读聚合（§5.2：组/题/阶段窗、缓存自适应、口径声明） |
| `eval/bench/lib/collect/result.js` | 非页面题验收执行与结果归一化（§4） |
| `eval/bench/bank/**`、`prompt-rules.md`、`rubric.md` | 题包与规则库（§1/§2/§6） |
