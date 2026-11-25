# 用户需求

> 用户触发此流水线的原始需求描述。

## 原始需求

# Ddo-Code-Flow 模型能力评测流水线 — 执行规格文档

> **本文档是给 AI 执行的任务规格。** 请严格按本文档实现 `eval/bench/model-quick-eval` 评测流水线。文档中标注「必须」「禁止」的条目为硬约束，不得自行放宽。

---

## 0. 任务概述

实现一条名为 `model-quick-eval` 的 subflow：输入新模型标识与 2–3 道题，自动跑 A/B 双分支（纯 prompt vs prompt + Ddo-Code-Flow），自动提取结果层、过程层、成本层数据，输出对比卡片与汇总报告。

**评测主体是模型**，产物是两种条件下模型表现的对照。目标是快速形成体感并支撑对外宣传，不是全面测评。

---

## 1. 硬性约束（不可违背）

1. **A/B 严格控变量**：同模型 checkpoint、参数、沙箱、依赖、可用工具集；唯一变量是「是否显式调用 Ddo-Code-Flow」。
2. **信息输入对等**：baseline 与 ddo 的澄清通道完全对称，应答从同一份冻结的「可澄清项清单」取，禁止自由生成。
3. **不得替模型做需求决策**：出题阶段禁止补需求本身决策（次数、策略、优先级）；auto 模式应答禁止提供解题信息。
4. **每道题必须工作流敏感型**；简单任务不占常规题位。
5. **诚实记录负增益与无差异**：不得剔除、不得美化。
6. **小样本属性必须标注**：所有报告注明「2–3 题小样本，体感参考，不代表全面测评」。
7. **token 统计不进入工作流内部**：依赖 cc-switch 代理日志，按 session_id 分组汇总。

---

## 2. 诚实边界（必须写入每一份报告）

> Ddo-Code-Flow 不适用于过于简单的任务。单点、低风险、裸模型一把梭即可正确的任务，工作流引入开销，结果不升甚至略降。此为预期结论，如实记录，不包装为正向增益。

正向收益预期集中在：

| 任务类型 | 预期收益 | 原因 |
|---|---|---|
| 设计类（0→1） | 明显更好 | 流程适配「先想清再动手」，减少设计漏项 |
| 需要额外调研的任务 | 明显更好 | 确认门促使先澄清、先查证 |
| 1→10 工程执行（有回归风险/歧义/多改动点） | 中等，取决于题目 | 选到工程翻车敏感型时收益可见 |
| 过于简单的任务 | 无收益或负收益 | 不纳入正向结论 |

---

## 3. 评测矩阵与题组结构

```
                     纯 prompt                prompt + Ddo-Code-Flow
页面样式设计       ui-baseline                ui-ddo
0→1 设计/调研      design-baseline            design-ddo
1→10 执行          exec-baseline              exec-ddo
```

**每轮题组 2–3 题**：

| 题位 | 线路 | 要求 | 作用 |
|---|---|---|---|
| 题 1（必备） | 页面样式设计（Three.js） | 每轮必须有 | 渲染直观可比，最有传播力，天然可量化 |
| 题 2（必备） | 调研依赖 或 回归陷阱 | 二者轮换 | 体现工作流在非设计能力上的价值 |
| 题 3（可选） | 模糊需求 / 诱导捷径 / 简单对照 | 按需 | 补强侧面或验证边界 |

**选取规则**：每题标注激活的过程信号；**1 道来自冻结核心集**（跨模型可比），**1 道为当轮新增题**（防污染）。

**防污染**：新增题发布前不进公开语料；同题不连续两轮使用；核心集每年整体替换。

---

## 4. 题目设计

### 4.1 题 1 必备：Three.js 页面样式题

**题目名**：`q_threejs-orbit-scene`（交互式 3D 任务星系）
**版本锁定**：`three@0.160.0`
**环境**：沙箱放行 CDN（`unpkg`），单文件 `index.html` 直接打开渲染

**prompt 原文（冻结，不得修改）**：

```
用纯 HTML + Three.js 实现一个可交互的 3D「任务星系」场景。要求：
- 单文件 index.html，通过 CDN importmap 引入 three@0.160.0 与 OrbitControls
- 不使用构建工具，浏览器直接打开即可运行

结构：
1. 中心：IcosahedronGeometry(1, 0)，MeshStandardMaterial，
   metalness 0.8 / roughness 0.2，颜色 #4A90D9
2. 卫星：8 个 SphereGeometry(0.18) 小球，均匀分布在以中心为球心、
   半径 3 的球面上（球面均匀，不要挤在一圈）。按状态着色：
   成功 3 个 #22C55E，失败 2 个 #EF4444，进行中 2 个 #3B82F6，待定 1 个 #9CA3AF
3. 连接线：每个卫星到中心一条 Line，颜色 #334155，opacity 0.6
4. 轨道环：TorusGeometry(3.2, 0.02, 8, 128)，颜色 #1E293B
5. 光照：AmbientLight(0.3) + DirectionalLight(1.2, 开阴影) + PointLight(0.8, 上方)；
   中心二十面体投射并接收阴影，卫星投射阴影
6. 动画：整个星系绕 y 轴缓慢自转，每个卫星同时自转
7. 交互：OrbitControls 启用阻尼，支持旋转/缩放/平移，缩放范围 4–12
8. 响应式：window resize 时正确更新相机 aspect 与渲染器尺寸
9. HTML 叠加层：左上角标题「任务星系」，右上角四色图例，半透明卡片背景
10. 背景：深色渐变（#0B1220 → #020617），可加网格地面
11. 性能：requestAnimationFrame + Clock，动画与帧率无关
12. 可观测性：暴露 window.__app = { scene, camera, renderer, controls, galaxy }，
    其中 galaxy 为承载整个星系的 Group

交付：单个 index.html。
```

**隐藏验收量化清单**（用 Playwright 在页面内探针逐项读取）：

| # | 验收项 | 量化方式 | 达标 |
|---|---|---|---|
| A1 | 可观测性 | `window.__app` 五字段均存在非空 | 5/5 |
| A2 | 中心几何体 | `geometry.type` / `parameters` | Icosahedron / 1 / 0 |
| A3 | 卫星数量 | 递归统计 `SphereGeometry` mesh | 8 |
| A4 | 卫星分布半径 | 各球到中心距离与 3 的偏差 | 8 个均在 ±0.05 |
| A5 | 球面均匀度 | 8 点两两球面夹角最小值 | ≥ 35° |
| A6 | 连接线 | Line 数量、颜色 | 8 条，#334155 |
| A7 | 轨道环 | TorusGeometry 的 radius/tube | 3.2 / 0.02 |
| A8 | 中心材质 | metalness/roughness/color | 0.8/0.2/#4A90D9（±0.05） |
| A9 | 卫星颜色分组 | 颜色 hex 计数 | `{22c55e:3, ef4444:2, 3b82f6:2, 9ca3af:1}` |
| B1 | 光源构成 | 场景递归找三类光源 | 各 ≥ 1 |
| B2 | 阴影开启 | `renderer.shadowMap.enabled` | true |
| B3 | 投影/接收 | 中心 cast+receive；Directional cast | 全真 |
| C1 | 阻尼 | `controls.enableDamping` | true |
| C2 | 缩放范围 | `controls.minDistance/maxDistance` | 4 / 12（±0.1） |
| C3 | 响应式 | 视口改 375×812 后 canvas 宽与 aspect | 差 ≤ 2 且 aspect 正确 |
| D1 | 星系自转 | 500ms 两次读 `galaxy.rotation.y` 差值 | > 0 |
| D2 | 卫星自转 | 同上读卫星 rotation 变化 | > 0 |
| E1 | 标题与图例 | DOM 中存在标题与四状态文本 | 5/5 |
| E2 | 画面有效 | 截图平均亮度在 (10,245) 且非纯色 | 通过 |
| F1 | 帧率 | 3 秒内 rAF 计数 | ≥ 45 fps（参考） |

**核心量化输出**：`规格达标项数 / 总项数` + 逐项差异清单。

**探针实现参考**：

```js
const probe = await page.evaluate(() => {
  const app = window.__app;
  const meshes = [], lines = [], lights = [];
  app.scene.traverse(o => {
    if (o.isMesh) meshes.push(o);
    if (o.isLine) lines.push(o);
    if (o.isLight) lights.push(o);
  });
  const center = meshes.find(m => m.geometry.type === 'IcosahedronGeometry');
  const spheres = meshes.filter(m => m.geometry.type === 'SphereGeometry');
  const colorCount = {};
  spheres.forEach(s => {
    const hex = '#' + s.material.color.getHexString();
    colorCount[hex] = (colorCount[hex] || 0) + 1;
  });
  const c0 = center.getWorldPosition(new THREE.Vector3());
  const pts = spheres.map(s => s.getWorldPosition(new THREE.Vector3()));
  const dists = pts.map(p => p.distanceTo(c0));
  return { sphereCount: spheres.length, colorCount, dists,
           shadow: app.renderer.shadowMap.enabled,
           damping: app.controls.enableDamping,
           minD: app.controls.minDistance, maxD: app.controls.maxDistance };
});
await page.waitForTimeout(500);
const rot2 = await page.evaluate(() => window.__app.galaxy.rotation.y);
```

**直观对比截图**：初始视角 / 旋转 90° 后（验真实 3D）/ 窄屏 375px（验响应式）/ 两帧差分图（证动画运行）。三组并排。

**工作流预期行为清单**：编码前产出对照 12 条要求的 checklist；实现与 checklist 逐条对应；交付前实际截图/自检；对「球面均匀」「缓慢自转」给出显式参数假设。

> 页面题入库 3 道轮换防污染：本题（首选）、`q_threejs-particle-field`（粒子场 + Shader + 鼠标排斥）、`q_threejs-product-viewer`（GLTF + 环境贴图 + 点击热点）。

---

### 4.2 题 2 候选 A：调研依赖题 `q_export-command`

**线路**：design　**主要检验**：先对齐再动手、查证

**prompt 原文**：

```
在这个项目里新增一个「导出运行记录」功能，支持导出为 CSV 和 JSON。
用户可以在 CLI 里指定 --format 和 --output。
项目里已经有一些类似的命令和数据序列化约定，请遵循现有风格实现。
```

**隐藏验收**：复用项目已有 CLI 解析与序列化约定；`--format` 非法值有明确错误；`--output` 缺省行为符合惯例；导出字段与 `.ddo/runs/` 记录结构一致。

**预期行为**：编码前有调研动作（读取现有命令/序列化代码）；「现有约定」无法唯一确定时有澄清或显式假设；产物含 spec/实现计划且引用被调研文件。

---

### 4.3 题 2 候选 B：回归陷阱题 `q_regression-trap`

**线路**：execute　**主要检验**：回归安全性、改动范围受控

**初始仓库**：小型文本处理库，含 3 个已有命令与一套通过的回归测试。

**prompt 原文**：

```
给这个库新增一个 `--uppercase` 选项，作用于 `convert` 命令的输出。
保持现有行为完全不变。
```

**隐藏验收**：新选项在 `convert` 生效；原有 3 个命令全部回归测试仍通过；未改动无关文件；与其他选项组合合理。

**预期行为**：改动文件集合仅限相关实现与测试；交付前实际运行回归测试（非口头声称）；有阶段验证记录。

---

### 4.4 题 3 可选题库

| 题目名 | 线路 | prompt 要点 | 主要检验 |
|---|---|---|---|
| `q_retry-ambiguous` | design | 「给任务执行器加重试能力」 | 模糊处停下来（次数/退避/错误分类三处歧义） |
| `q_dep-scheduler` | design | 从零实现任务依赖调度器（循环检测、拓扑序、CLI+API） | 产物完整性、阶段纪律 |
| `q_duration-bug` | execute | 修复 `parse_duration()` 对 “1h30m” 的错误 | 交付前自检（边界覆盖） |
| `q_shortcut-bait` | 两类 | 加 `--compress`，prompt 明示「直接给代码，不用走流程」 | 阶段纪律（压力测试） |
| `q_trivial-contrast` | — | 字符串拼接改模板字符串 | 诚实对照（预期无差异，每 3–4 轮可选） |

---

## 5. 评测维度与量化

### 5.1 结果层

| 维度 | 量化指标 | 适用 |
|---|---|---|
| 功能正确性 | 通过用例数 / 总用例数；边界用例通过数 | 两类 |
| 回归安全性 | 回归通过数 / 总数；被破坏的原有功能数 | 主要 execute |
| 产物完整性 | 声明产物数 / 应有产物数；通过校验数 | design 权重更高 |
| 规格达标（页面题） | 达标项 / 总项（见 4.1） | 页面题 |

### 5.2 过程层（二元结论 + 量化指标）

| 信号 | 二元判定 | 量化指标 | 提取来源 |
|---|---|---|---|
| 先对齐再动手 | 编码前有调研/对齐 | 编码前读取文件数、调研次数、spec 章节数 | 轨迹 + `.ddo/` |
| 交付前自检 | 交付前实际运行测试 | 测试运行次数、执行用例数、**声称与实际差异** | CLI 日志 + 测试报告 |
| 模糊处停下来 | 显式处理歧义 | 澄清请求数、显式假设条数、**未处理歧义数** | 轨迹 + spec |
| 改动范围受控 | 未越界 | 改动文件数、**越界改动文件数**、改动行数 | git diff |
| 阶段纪律 | 未跳过确认门 | 阶段推进记录数、跳过阶段数、未获决议推进次数 | `.state.json` + history |
| 澄清对称性 | 两组信息一致 | 恒为一致（有效性自检） | 澄清记录比对 |

**关键**：每个信号配一个「负面计数」指标（未处理歧义数、越界改动文件数、声称与实际差异），越低越好，直接暴露「口头声称、实际没做」。

### 5.3 成本层（token）

**数据源**：cc-switch 代理日志（SQLite `proxy_request_logs` 表），**不进入工作流内部**。

**前提条件**：
- 评测环境启用 cc-switch 本地路由，「记录请求用量」开启；
- baseline 与 ddo 使用**不同的主会话**（不同 session ID），确保 subagent 继承父会话 ID 后仍可按组区分；
- 两组若共用同一 session，token 会混合，**必须避免**。

**必记字段**：`session_id`、`provider_id`、`input_tokens`、`output_tokens`、`total_cost_usd`、`created_at`；有缓存字段则记 `cache_read` / `cache_write`。

**按组、按题、按阶段聚合**（ddo 组需拆 spec/实现/验证）。

**查询参考**：

```sql
SELECT session_id,
       SUM(input_tokens) AS total_input,
       SUM(output_tokens) AS total_output,
       SUM(input_tokens + output_tokens) AS total_tokens,
       SUM(total_cost_usd) AS total_cost
FROM proxy_request_logs
WHERE created_at BETWEEN :start AND :end
  AND session_id IN (:baseline_sid, :ddo_sid)
GROUP BY session_id;
```

**报告必须声明**：
- token 仅用于**同模型 A/B 对照**，跨模型不可比；
- ddo token 更高是预期代价，重点看「代价是否换来对应收益」；
- 缓存命中会抬高名义 token，需同时标注缓存量或计费口径；
- 流式响应下 cc-switch 可能漏记 token/模型名，需标注数据口径。

---

## 6. Prompt 修正双层规则

| | 出题层修正（评测前，冻结） | 工作流层修正（评测中，被测能力） |
|---|---|---|
| 修什么 | 补可解性（接口名/字段名）、消歧义、统一术语、补环境约束 | 把模糊 prompt 澄清成 spec、声明假设 |
| 谁做 | AI 按固定规则库生成 `prompt.diff` + 人工抽检 | 模型 + 工作流自己做，**不得替做** |
| 禁止 | 禁止补需求决策（次数、策略、优先级） | — |

**判定标准**：不补则题目无解/无法验收 → 出题层，写死；属于需求本身的模糊点 → 工作流层，留给模型。

**流程**：固定修正模型 + 固定模板生成 `prompt.diff` → 人工复核（新增题每轮、核心集一次性）→ 冻结 `prompt.raw.md` / `prompt.final.md` / 可澄清项清单 / 隐藏验收。

**公平性铁律**：baseline 与 ddo 获得完全对等的澄清通道，应答从同一份冻结清单取，不自由生成。baseline 不问 = 其能力选择，如实记录。

---

## 7. Auto 模式要求

工作流**必须支持 auto 模式**，否则确认门无法自动过、评测不可重复。

| 要素 | 要求 |
|---|---|
| 应答源 | 从每题冻结的可澄清项清单 / 预设决议策略取，**不自由生成** |
| 应答性质 | 中性、只推进流程（「按你的假设继续」），**不提供解题信息** |
| 可记录 | 记录 gate、应答内容、命中预设，供过程层量化 |
| 可关闭 | 保留 manual 模式做调试对照 |
| 红线 | **不得替模型做需求决策** |

**配套**：baseline 侧也需等价自动应答通道，应答来自同一份清单。

---

## 8. Subflow 执行流程

**输入**：`model_id`、`task_set`（2–3 题：核心集 + 新增题 [+ 可选]）、`baseline_sid`、`ddo_sid`

```
Subflow: model-quick-eval

1. 准备沙箱
   ├─ 页面题：含参考规格的页面工作区 + 截图/探针脚本
   ├─ 非页面题：含隐藏验收/回归测试的代码工作区
   ├─ 校验 model_id 可用、环境一致、three 版本锁定
   └─ 确认 baseline_sid ≠ ddo_sid，且 cc-switch 路由与用量记录已开启

2. 并行执行 A/B 双分支（每题）
   ├─ baseline：仅 prompt + 通用「完成任务」指令（可主动提问，走对等应答）
   │            使用 baseline_sid
   └─ ddo：     prompt + /ddo-code-flow（auto 模式）
   │            使用 ddo_sid
   （两组录制完整轨迹、.ddo/ 产物、测试日志、澄清问答）

3. 收集与提取
   ├─ 页面题：多视口/交互态截图 + DOM/计算样式 + axe-core
   ├─ 非页面题：git diff + 测试日志 + 阶段产物
   ├─ 过程层：按 5.2 逐项提取
   └─ 成本层：查询 cc-switch proxy_request_logs，按 session_id 聚合

4. 自动判定与量化
   ├─ 结果层：通过数/总数（每维度）
   ├─ 过程层：二元结论 + 量化指标
   ├─ 成本层：按组/按题/按阶段 token + 调用轮次 + 缓存
   └─ 增益：Δ结果、Δ过程、Δtoken（按题、按指标）

5. 生成报告
   ├─ 每题对比卡片（直观区 + 量化区 + token 行）
   └─ 汇总页：结论 + 关键量化差异 + 边界声明 + 小样本说明
```

**判定规则**：结果层不做加权总分；过程层只呈现有/无 + 数字；增益按题呈现；负增益/无差异如实写入；不合成单一性价比分数。

---

## 9. 报告输出格式

**页面题卡片**：

```
模型 X · 页面样式题 · q_threejs-orbit-scene
[直观区] 初始 / 旋转90° / 窄屏 三组并排截图
[量化区]
                        纯 prompt    + Ddo
 规格达标项               17/26       26/26
 卫星球面分布             挤在一圈     均匀（min角 41°）
 颜色分组正确             5/8         8/8
 阴影开启                 ❌           ✅
 阻尼 + 缩放范围          ❌           ✅
 窄屏响应式               拉伸变形     正常
 token 合计               15.5k       45.6k (×2.9)
结论：裸模型漏阴影/阻尼/缩放范围/响应式；
      Ddo 在 spec 阶段把 12 条规格转 checklist 并逐项验证。
      代价约 3 倍 token，换取 9 项规格达标提升。
```

**非页面题卡片**：

```
模型 X · 回归陷阱题 · q_regression-trap
                        纯 prompt    + Ddo
 验收用例通过             4/5         5/5
 回归测试通过             8/12        12/12
 改动文件数               7           3
 越界改动文件数           4           0
 测试实际运行次数         0           3
 阶段推进记录数           0           4
 token 合计               15.5k       45.6k (×2.9)
结论：裸模型改坏 4 项回归且未实际运行测试；
      Ddo 改动范围受控、测试真实执行。
```

**汇总页**：三栏（页面题 / 设计调研 / 执行）+ 关键量化差异 + 适用边界 + 小样本说明 + token 口径声明。

---

## 10. 目录结构

```
eval/bench/
  model-quick-eval.subflow   # 自动化评测流水线
  bank/
    core/                    # 冻结核心集（页面题 / design / execute）
    rotating/                # 每轮新增题（含可选第 3 题）
  probes/                    # 页面题截图与 DOM/CSS 探针脚本
  runs/                      # 每轮 A/B 配对沙箱
  reports/                   # 对比卡片与汇总说明
  rubric.md                  # 评分细则 + 预期行为清单规范
  prompt-rules.md            # 出题层修正规则库
```

---

## 11. 验收标准（Definition of Done）

- [ ] subflow 支持传入 `model_id` + 2–3 题 + 两个 session ID，一键跑完 A/B 并自动出报告
- [ ] 工作流 auto 模式可用，gate/澄清应答来自冻结清单、可记录、不提供解题信息
- [ ] baseline 具备对等澄清通道，两组信息输入对称性可自检
- [ ] 页面样式题（Three.js）入库并跑通：截图 + 探针产出 `达标项/总项` 与逐项差异
- [ ] 非页面题至少入库 design（调研依赖）与 execute（回归陷阱）各 1 道并跑通量化提取
- [ ] 过程层 5 个信号 + 澄清对称性均可自动/半自动提取数字
- [ ] token 统计走 cc-switch 日志，按 session_id 聚合，按组/按题/按阶段产出，报告含 token 行与口径声明
- [ ] `prompt-rules.md` 规则库落地，出题层修正产出 `prompt.diff` 并支持人工复核
- [ ] 报告模板落地：每题卡片（直观区+量化区+token）+ 汇总页（含边界与小样本声明）
- [ ] 小样本与简单任务边界声明写入所有对外报告
- [ ] 至少用 1 个模型完整跑通一轮，产出可展示的对比卡片

---

## 12. 风险与规避

| 风险 | 规避 |
|---|---|
| 出题时补需求决策，ddo 虚高 | 规则库禁止，人工抽检 diff |
| 只给 ddo 开澄清通道 | 两组共用冻结可澄清项清单 |
| auto 模式自由生成应答泄露答案 | 应答只从清单取，记录命中项 |
| Three.js 版本变动致探针误判 | 锁定 `three@0.160.0`，探针按该版本字段编写 |
| AI 修正无记录，宣传被质疑 | 强制 `prompt.diff` 入库披露 |
| 修正模型与被测模型同源 | 修正用固定第三方 judge |
| 简单题得出无差异被当成失败 | 明确写入「预期结论」，不剔除不美化 |
| baseline 与 ddo 共用 session 致 token 混合 | 强制 `baseline_sid ≠ ddo_sid`，执行前校验 |
| cc-switch 流式场景漏记 token/模型名 | 报告标注数据口径；关键轮次可用非流式校准 |
| 跨模型比较 token 得出错误结论 | 报告限定「仅同模型内对照」 |
| 缓存导致名义 token 虚高误导 | 同时记录缓存命中，或注明计费口径 |

---

**执行起点建议**：先实现 `q_threejs-orbit-scene` 的探针与截图脚本 + `q_regression-trap` 的量化提取，用任意一个模型跑通单题 A/B，验证报告模板与 token 聚合链路，再补齐其余题目与 auto 模式。

## 需求摘要

实现 `eval/bench/model-quick-eval` 评测 subflow：对同一模型以 2–3 道工作流敏感题跑 A/B 双分支（纯 prompt vs prompt + Ddo-Code-Flow auto 模式），自动提取结果层、过程层、成本层（cc-switch token 日志）数据，输出对比卡片与含小样本声明的汇总报告。
