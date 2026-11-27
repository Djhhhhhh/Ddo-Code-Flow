用纯 HTML + Three.js 实现一个可交互的 3D「脉冲星引擎舱」监控视图（后处理管线 + 物理光照 + 实例化阵列完整版）。要求：
- 单文件 index.html，通过 CDN importmap 引入 three@0.160.0 与 OrbitControls，
  以及后处理相关 addons（EffectComposer / RenderPass / UnrealBloomPass / OutputPass）
- 不使用构建工具，浏览器直接打开即可运行

结构与视觉：
1. 反应核心：OctahedronGeometry(1.2, 1)，MeshStandardMaterial，
   metalness 0.9 / roughness 0.15，颜色 #22D3EE；
   emissive #0EA5E9、emissiveIntensity 基线 0.4，做 ±0.25 的脉冲（周期约 2.4s）
2. 核心外罩：再包一层 OctahedronGeometry(1.5, 1) 的线框网格
   （wireframe 材质，#67E8F9，opacity 0.2），与核心反向缓慢自转（参数自定需显式）
3. 推进器阵列：InstancedMesh（ConeGeometry(0.22, 0.6, 6)，
   MeshStandardMaterial #94A3B8），实例数 24，均匀分布在半径 4.2 的圆环
   （XZ 平面）上、锥尖朝外；整个阵列做同步「呼吸」——分布半径在
   4.2 ± 0.15 间正弦变化（周期约 3.5s），每帧更新实例矩阵
4. 扇区划分：24 台推进器按角度顺序每 6 台划为一个扇区（共 4 扇区，编号 0–3）
5. 冷却管线：3 条 TubeGeometry（CatmullRomCurve3，从核心表面通往舱壁三个
   方位），管半径 0.06；三条分别为 #0EA5E9 / #F59E0B / #8B5CF6，
   材质自发光同色、emissiveIntensity 0.5
6. 冷却粒子流：Points 粒子 ≥ 600，沿三条管线循环流动（速度自定需显式），
   AdditiveBlending
7. 检修面板：6 块 PlaneGeometry(1.8, 1.2)（MeshStandardMaterial
   #0F172A / opacity 0.55 / DoubleSide），围成朝向核心的正六边形
   （面板中心距原点等距），面板法线指向核心
8. 星空背景：Points 星场总点数 ≥ 600（建议远/近两层，sizeAttenuation），
   整体缓慢旋转（方向自定需显式）
9. 光照（r155+ 物理光照单位）：AmbientLight(0.15) + DirectionalLight(2.5, 开阴影)
   + PointLight(30, #F97316)（核心上方约 2.5，decay 2）+ 正下方冷色补光
   PointLight(12, #38BDF8, decay 2)；核心与检修面板投射并接收阴影
10. 渲染与色彩：renderer.toneMapping = ACESFilmicToneMapping、
    toneMappingExposure 1.1；抗锯齿方案自定（注意后处理接管上屏的语境），
    pixelRatio = min(devicePixelRatio, 2)
11. 后处理：EffectComposer + RenderPass + UnrealBloomPass
    （strength 0.65 / radius 0.55 / threshold 0.6），并以 OutputPass 收尾；
    resize 时 renderer 与 composer 的 pixelRatio、尺寸都要同步更新

交互：
12. 悬停扇区：Raycaster 命中推进器实例时，该实例所属扇区的 6 台锥体
    显著提亮（手段自定：实例色 / 材质 / 缩放等），HUD 显示扇区号
13. 聚焦：单击核心或检修面板，controls.target 与相机平滑过渡到该对象
    （约 0.8s 缓动）；「R」键复位到默认视角
14. 面板循选：Tab 键在 6 块检修面板间循环选中（preventDefault），
    被选面板高亮（emissive 或等价手段）
15. 空格暂停/恢复全部动画（OrbitControls 阻尼不受影响），
    HUD 显示当前「已暂停」状态

HUD 与工程质量：
16. HUD：左上标题「脉冲星引擎舱」+ 副标题；右上核心温度监视卡；
    卡片半透明毛玻璃（backdrop-filter: blur ≥ 8px、rgba 背景、1px 边框）
17. 温度模拟：核心温度数值随时间波动（区间约 520–660K，波形自定需显式），
    读数 > 640K 时该读数变红 #EF4444，并在 state 反映过热
18. FPS 计数：左下实时帧率（每 500ms 更新一次显示，保留一位小数）
19. 响应式：window resize 时正确更新相机 aspect、renderer 与 composer 的
    pixelRatio 和尺寸；375×812 窄屏可用
20. 性能：requestAnimationFrame + Clock，动画与帧率无关；
    InstancedMesh 每帧至多重写一次实例矩阵
21. 可观测性：暴露 window.__app = { scene, camera, renderer, controls, composer,
    core, shroud, thrusters, conduits, particles, panels, state }——
    thrusters 为 InstancedMesh；panels 为 6 块面板对象数组；
    state 含 { paused, hoveredSector, selectedPanel, overheat, temperature } 且可写
22. （加分参考）尊重 prefers-reduced-motion: reduce，停用脉冲、呼吸与粒子流动

交付：单个 index.html。
