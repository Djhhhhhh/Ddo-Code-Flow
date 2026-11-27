# CHECKS — q_threejs-reactor-bay 验收清单

隐藏验收 = 探针计分清单（`acceptance/probe.js`，页面题）。本目录不随题面下发；探针在评测收集阶段对两臂产物执行。

计分项（37 项，达标率分母）：
- A 组 结构（A1–A11，11 项）：可观测性（`__app` 十一字段）、核心几何（Octahedron r1.2/d1/m0.9/r0.15/#22D3EE）、核心自发光（#0EA5E9、脉冲瞬时值 ∈[0.15,0.65]）、外罩线框（r≈1.5/opacity ≤0.35）、推进器 InstancedMesh ×24、实例分布半径 ∈[4.05,4.35]（呼吸窗）、锥尖朝外（+Y 基与径向夹角 ≤20°）、冷却管线（3 条 r≈0.06 三色）、检修面板（6 块半透明 DoubleSide）、面板正六边形（等距+角差 60°+法线朝心）、state 五字段
- B 组 光照（B1–B4，4 项）：三类光源各 ≥1、阴影链路（shadowMap+核心投影/接收+平行光投影）、主点光 #F97316 intensity ∈[24,36] decay=2（物理单位）、冷色补光 #38BDF8 intensity ∈[9,15] decay=2
- C 组 相机与响应（C1–C3，3 项）：阻尼、缩放范围 5–13（±0.2）、375px 响应式（canvas 宽差 ≤2、aspect 正确、composer 缓冲与 drawing buffer 同步）
- D 组 动画（D1–D5，5 项）：核心脉冲 |ΔemissiveIntensity|>0.02、阵列呼吸（实例矩阵位移 >1e-4）、粒子流动（位置数组变化）、外罩反向自转（Δrotation.y<0）、温度变化（state.temperature 两次读数不同）
- E 组 画面（E1–E2，2 项）：标题与 HUD 文本 5/5（脉冲星引擎舱/监控/核心温度/扇区/FPS）、画面有效（平均亮度 ∈(10,245) 且非纯色）
- G 组 质感（G1–G4，4 项）：冷却粒子 ≥600 且星空 ≥600、bloom（strength ∈[0.45,0.85]/radius ∈[0.35,0.75]）、**OutputPass 为 composer 末位 pass**、色调映射（ACESFilmic=4/exposure ∈[0.9,1.3]）
- H 组 交互（H1–H5，5 项）：悬停扇区（hoveredSector 非空+HUD 文本更新）、点击面板聚焦（controls.target 距面板 <0.6）、Tab 循选（两次按键 selectedPanel 递进）、空格暂停（paused=true 且实例矩阵停摆）、R 复位（target 回原点 <0.1）
- I 组 HUD（I1–I3，3 项）：FPS 计数存在且读数健康（∈[30,240] 带小数位）、pixelRatio ≤2、HUD 卡片 backdrop-filter 含 blur

参考档（不计分母）：
- F1 帧率：3 秒 rAF 计数 ≥45（单列呈现）。
- F2 prefers-reduced-motion：呼吸停用（实例矩阵不动）。
- axe-core 可访问性问题数：附加观测（CDN 注入，离线记 skipped）。

黄金样例实测（2026-11-27，本机 chromium）：reference 37/37（fps 60.7 / reduced ok / axe ok）；flawed 15/37（失败集中在 A5-A7/A10、B2-B4、C3、D1-D5、G1-G4、H1/H3/H4/H5——即实例化、物理光单位、后处理收尾、动画与键盘导航的典型失误面）。

> 判读规则（通用）：逐项布尔化，以探针实际读数为准，不做部分给分。本清单与 probe.js 同提交同步更新；rubric.md 只引用不复述。
