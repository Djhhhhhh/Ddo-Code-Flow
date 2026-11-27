用纯 HTML + Three.js 实现一个可交互的 3D「任务星系」场景（视觉与交互完整版）。要求：
- 单文件 index.html，通过 CDN importmap 引入 three@0.160.0 与 OrbitControls，
  以及后处理相关 addons（EffectComposer / RenderPass / UnrealBloomPass）
- 不使用构建工具，浏览器直接打开即可运行

结构与视觉：
1. 中心：IcosahedronGeometry(1, 0)，MeshStandardMaterial，
   metalness 0.8 / roughness 0.2，颜色 #4A90D9
2. 中心线框叠加：再包一层 IcosahedronGeometry(1.04, 1) 的线框网格
   （wireframe 材质，颜色 #7DD3FC，opacity 0.25）
3. 中心浮动：整体沿 y 轴正弦浮动，幅度 0.15、周期约 4s（自定参数需显式）
4. 卫星：8 个 SphereGeometry(0.18) 小球，均匀分布在以中心为球心、
   半径 3 的球面上（球面均匀，不要挤在一圈）。按状态着色：
   成功 3 个 #22C55E，失败 2 个 #EF4444，进行中 2 个 #3B82F6，待定 1 个 #9CA3AF
5. 卫星自发光：每颗卫星 material.emissive 设为自身颜色、emissiveIntensity 0.35；
   「失败」卫星的 emissiveIntensity 在 0.15–0.6 间正弦闪烁（周期约 1.2s）
6. 连接线：每个卫星到中心一条 Line，颜色 #334155，opacity 0.6；
   线材质 opacity 做 0.35–0.6 的呼吸动画（周期约 2s）
7. 轨道环（两圈）：内环 TorusGeometry(3.2, 0.02, 8, 128) 颜色 #1E293B；
   外环 TorusGeometry(4.6, 0.012, 8, 128) 颜色 #334155、opacity 0.35，
   绕 x 轴倾斜 60°
8. 星空背景：Points 星场总点数 ≥ 800（建议远/近两层，sizeAttenuation），
   整体绕 y 轴与星系反向缓慢旋转
9. 光照：AmbientLight(0.3) + DirectionalLight(1.2, 开阴影) + PointLight(0.8, 上方)，
   另加一盏正下方冷色补光 PointLight(0.4, #38BDF8)；
   中心二十面体投射并接收阴影，卫星投射阴影
10. 后处理：EffectComposer + RenderPass + UnrealBloomPass
    （strength 0.55、radius 0.6、threshold 0.72），resize 时同步 composer

动画与交互：
11. 自转：整个星系绕 y 轴缓慢自转（「缓慢」由你给出显式参数假设），
    每颗卫星同时自转
12. 悬停：Raycaster 命中卫星时，该卫星平滑放大到 1.35×（过渡 ≤ 0.25s）、
    emissiveIntensity 提亮到 ≥ 0.8，并显示跟随鼠标的 tooltip
    （DOM 元素，含状态词与名称）
13. 聚焦：单击卫星，controls.target 与相机平滑过渡到该卫星（约 0.8s 缓动），
    右侧弹出详情卡（DOM：名称/状态/坐标）；
    提供「复位」按钮（或双击空白处）回到中心默认视角
14. 图例过滤：右上角图例四项可点击，点击切换对应状态卫星的显隐
    （只改 visible，不卸载对象），图例项随之置灰；再次点击恢复
15. 键盘：空格键暂停/恢复全部动画（OrbitControls 阻尼不受影响），
    HUD 上显示当前「已暂停」状态

HUD 与工程质量：
16. HUD：左上角标题「任务星系」+ 副标题，右上角四色图例；
    卡片为半透明毛玻璃质感（backdrop-filter: blur ≥ 8px、rgba 背景、1px 边框）
17. FPS 计数：左下角实时帧率（每 500ms 更新一次显示）
18. 响应式：window resize 时正确更新相机 aspect、渲染器与 composer 尺寸；
    375×812 窄屏可用；renderer pixelRatio = min(devicePixelRatio, 2)
19. 性能：requestAnimationFrame + Clock，动画与帧率无关
20. 可观测性：暴露 window.__app = { scene, camera, renderer, controls, galaxy,
    composer, satellites, state }——satellites 为 8 个卫星对象的数组
    （每项含 mesh 引用与状态文字），state 含 { paused, hiddenStatuses } 且可写；
    （加分参考）尊重 prefers-reduced-motion: reduce，停用自转与闪烁

交付：单个 index.html。
