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
