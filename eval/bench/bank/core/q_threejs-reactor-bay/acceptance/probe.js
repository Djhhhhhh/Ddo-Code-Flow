#!/usr/bin/env node
'use strict';
// q_threejs-reactor-bay 页面题探针 v1（高难：InstancedMesh 阵列 / 后处理收尾与同步 / 物理光照 / 曲线粒子流）。
// 用法：node bank/core/q_threejs-reactor-bay/acceptance/probe.js <index.html 绝对路径> <输出目录> [--rotate-drag <px>]
// 输出：<outdir>/probe.json（达标项/总项 + 逐项 {id,判定,实测,期望}）+ shots/（初始/拖拽旋转/窄屏/两帧）。
// 依赖：eval/bench devDependency playwright（chromium）。
// 计分项 A1–I3 共 37 项为达标分母；F1 帧率 / F2 reduced-motion 为参考档单列；axe 附加观测。
// 健壮性约定：产物缺字段（如 __app.thrusters 不存在）记该项失败，不让探针崩溃；
//   实例矩阵按本地坐标读（约定 thrusters 挂在场景根、无父级旋转，位置经 localToWorld 归一）。

const path = require('node:path');
const fs = require('node:fs');

async function main() {
  const [pageFileArg, outDirArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!pageFileArg || !outDirArg) {
    console.error('用法: node bank/core/q_threejs-reactor-bay/acceptance/probe.js <index.html> <outdir>');
    process.exit(2);
  }
  const pageFile = path.resolve(pageFileArg);
  const outDir = path.resolve(outDirArg);
  fs.mkdirSync(path.join(outDir, 'shots'), { recursive: true });
  const { chromium } = require('playwright');
  // 启动回退：bundled chromium 未安装时用本机 Chrome 通道（控变量不受影响——同一浏览器两臂同用）
  let browser;
  try {
    browser = await chromium.launch();
  } catch (e) {
    browser = await chromium.launch({ channel: 'chrome' });
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const checks = [];
  const record = (id, pass, actual, expected) => checks.push({ id, pass: Boolean(pass), actual, expected });
  const safe = async (fn, fallback) => { try { return await fn(); } catch { return fallback; } };

  await page.goto('file://' + pageFile, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__app && window.__app.core && window.__app.thrusters, null, { timeout: 15000 });
  await page.waitForTimeout(900); // 首帧渲染稳定

  // ---- 场景遍历（A/B/G 结构项 + 静态读数）
  const probe = await page.evaluate(() => {
    const app = window.__app;
    const Vec = Object.getPrototypeOf(app.camera.position).constructor;
    const meshes = []; const lights = []; const points = [];
    app.scene.traverse((o) => {
      if (o.isMesh) meshes.push(o);
      if (o.isLight) lights.push(o);
      if (o.isPoints) points.push(o);
    });
    const core = meshes.find((m) => m.geometry && m.geometry.type === 'OctahedronGeometry' && !m.material.wireframe);
    const shroud = meshes.find((m) => m.geometry && m.geometry.type === 'OctahedronGeometry' && m.material.wireframe);
    const tubes = meshes.filter((m) => m.geometry && m.geometry.type === 'TubeGeometry');
    const planes = meshes.filter((m) => m.geometry && m.geometry.type === 'PlaneGeometry');
    // 实例矩阵：位置（第 4 列）与 +Y 基（Cone 尖朝向），经 thrusters 本地→世界（约定挂场景根）
    const inst = [];
    if (app.thrusters && app.thrusters.isInstancedMesh && app.thrusters.instanceMatrix) {
      const a = app.thrusters.instanceMatrix.array;
      const n = app.thrusters.count;
      for (let i = 0; i < n; i++) {
        const o = i * 16;
        const p = app.thrusters.localToWorld(new Vec(a[o + 12], a[o + 13], a[o + 14]));
        inst.push({ pos: [p.x, p.y, p.z], basisY: [a[o + 4], a[o + 5], a[o + 6]] });
      }
    }
    const panelInfo = planes.map((p) => {
      const c = p.getWorldPosition(new Vec());
      const d = p.getWorldDirection(new Vec()); // PlaneGeometry 前向法线（+Z 世界方向）
      return { pos: [c.x, c.y, c.z], dir: [d.x, d.y, d.z], opacity: p.material.opacity, side: p.material.side, emissive: p.material.emissive ? p.material.emissiveIntensity : null };
    });
    const particlesCount = app.particles && app.particles.geometry && app.particles.geometry.attributes && app.particles.geometry.attributes.position
      ? app.particles.geometry.attributes.position.count : 0;
    const starPoints = points.reduce((n, p) => n + (p.geometry && p.geometry.attributes && p.geometry.attributes.position ? p.geometry.attributes.position.count : 0), 0) - particlesCount;
    const dir = lights.find((l) => l.isDirectionalLight);
    // 后处理：bloom 数值 pass + OutputPass 位置 + 色调映射
    let bloom = null; let outputLast = false; let outputIdx = -1;
    if (app.composer && Array.isArray(app.composer.passes)) {
      const ps = app.composer.passes;
      outputIdx = ps.findIndex((x) => x.constructor && /output/i.test(x.constructor.name));
      outputLast = outputIdx === ps.length - 1;
      const p = ps.find((x) => x.constructor && /unrealbloom/i.test(x.constructor.name)) || ps.find((x) => typeof x.strength === 'number' && typeof x.radius === 'number');
      bloom = p ? { strength: p.strength, radius: p.radius, threshold: p.threshold } : null;
    }
    return {
      appKeys: Object.keys(app),
      hasAll: ['scene', 'camera', 'renderer', 'controls', 'composer', 'core', 'shroud', 'thrusters', 'conduits', 'particles', 'panels'].every((k) => !!app[k]),
      core: core && {
        type: core.geometry.type, params: core.geometry.parameters,
        metalness: core.material.metalness, roughness: core.material.roughness,
        color: '#' + core.material.color.getHexString(),
        emissive: core.material.emissive ? '#' + core.material.emissive.getHexString() : null,
        emissiveIntensity: core.material.emissiveIntensity,
        castShadow: !!core.castShadow, receiveShadow: !!core.receiveShadow,
      },
      shroud: shroud && { radius: shroud.geometry.parameters.radius, opacity: shroud.material.opacity, rotY: shroud.rotation.y },
      thrusters: app.thrusters && { isInstanced: !!app.thrusters.isInstancedMesh, count: app.thrusters.count },
      inst,
      tubes: tubes.map((t) => ({ radius: t.geometry.parameters.radius, color: '#' + t.material.color.getHexString(), emissive: t.material.emissiveIntensity })),
      panels: panelInfo,
      stateKeys: app.state ? Object.keys(app.state) : [],
      lightKinds: lights.map((l) => l.type),
      pointLights: lights.filter((l) => l.type === 'PointLight').map((l) => ({ color: '#' + l.color.getHexString(), intensity: l.intensity, decay: l.decay })),
      dirCast: dir ? !!dir.castShadow : false,
      shadowEnabled: !!(app.renderer && app.renderer.shadowMap && app.renderer.shadowMap.enabled),
      damping: !!app.controls.enableDamping, minD: app.controls.minDistance, maxD: app.controls.maxDistance,
      bloom, outputLast, outputIdx,
      toneMapping: app.renderer.toneMapping, exposure: app.renderer.toneMappingExposure,
      particlesCount, starPoints,
      pixelRatio: app.renderer.getPixelRatio ? app.renderer.getPixelRatio() : null,
    };
  });

  // A1 可观测性（十一字段非空）
  record('A1', probe.hasAll, probe.appKeys.join(','), 'scene,camera,renderer,controls,composer,core,shroud,thrusters,conduits,particles,panels 非空');
  // A2 核心几何与材质
  record('A2', probe.core && probe.core.type === 'OctahedronGeometry'
    && Math.abs(probe.core.params.radius - 1.2) <= 0.05 && probe.core.params.detail === 1
    && Math.abs(probe.core.metalness - 0.9) <= 0.05 && Math.abs(probe.core.roughness - 0.15) <= 0.05
    && probe.core.color.toLowerCase() === '#22d3ee',
    probe.core && `${probe.core.type} r=${probe.core.params.radius} d=${probe.core.params.detail} m=${probe.core.metalness} r=${probe.core.roughness} c=${probe.core.color}`,
    'Octahedron / 1.2 / 1 / 0.9 / 0.15 / #22D3EE（±0.05）');
  // A3 核心自发光（基线 0.4 ± 0.25 脉冲瞬时值）
  record('A3', probe.core && probe.core.emissive === '#0ea5e9'
    && probe.core.emissiveIntensity >= 0.15 && probe.core.emissiveIntensity <= 0.65,
    probe.core && `emissive=${probe.core.emissive} intensity=${probe.core.emissiveIntensity && probe.core.emissiveIntensity.toFixed(3)}`,
    '#0EA5E9 / intensity ∈ [0.15, 0.65]');
  // A4 外罩线框
  record('A4', probe.shroud && Math.abs(probe.shroud.radius - 1.5) <= 0.08 && probe.shroud.opacity <= 0.35,
    probe.shroud && `r=${probe.shroud.radius} opacity=${probe.shroud.opacity}`, '线框 Octahedron r≈1.5 / opacity ≤ 0.35');
  // A5 推进器 InstancedMesh × 24
  record('A5', probe.thrusters && probe.thrusters.isInstanced && probe.thrusters.count === 24,
    probe.thrusters && `isInstancedMesh=${probe.thrusters.isInstanced} count=${probe.thrusters.count}`, 'InstancedMesh × 24');
  // A6 实例分布半径（呼吸窗 4.2±0.15，探针容 4.05–4.35）
  const radii = probe.inst.map((s) => Math.hypot(s.pos[0], s.pos[1], s.pos[2]));
  const radiusOk = probe.inst.length === 24 && radii.every((d) => d >= 4.05 && d <= 4.35);
  record('A6', radiusOk, radii.map((d) => d.toFixed(3)).join(','), '24 个均 ∈ [4.05, 4.35]');
  // A7 锥尖朝外（+Y 基与径向夹角 ≤ 20°）
  let minDot = null;
  if (probe.inst.length === 24) {
    minDot = 1;
    probe.inst.forEach((s) => {
      const rl = Math.hypot(s.pos[0], s.pos[1], s.pos[2]) || 1;
      const rad = [s.pos[0] / rl, s.pos[1] / rl, s.pos[2] / rl];
      const bl = Math.hypot(s.basisY[0], s.basisY[1], s.basisY[2]) || 1;
      const dot = s.basisY.reduce((acc, x, k) => acc + x * rad[k] / bl, 0);
      minDot = Math.min(minDot, dot);
    });
  }
  record('A7', minDot !== null && minDot >= 0.94, minDot === null ? 'n/a' : `minDot=${minDot.toFixed(3)}`, '全部 ≥ cos20° ≈ 0.94');
  // A8 冷却管线（3 条 / r 0.06 / 三色）
  const wantColors = ['#0ea5e9', '#f59e0b', '#8b5cf6'];
  const tubeColors = (probe.tubes || []).map((t) => t.color);
  const tubeOk = probe.tubes && probe.tubes.length === 3 && probe.tubes.every((t) => Math.abs(t.radius - 0.06) <= 0.02)
    && wantColors.every((c) => tubeColors.includes(c));
  record('A8', tubeOk, JSON.stringify((probe.tubes || []).map((t) => `r${t.radius.toFixed(3)}@${t.color}`)), '3 条 / r≈0.06 / #0EA5E9+#F59E0B+#8B5CF6');
  // A9 检修面板（6 块半透明 DoubleSide）
  record('A9', probe.panels.length === 6 && probe.panels.every((p) => p.opacity >= 0.4 && p.opacity <= 0.7 && p.side === 2),
    `n=${probe.panels.length} opacity=[${probe.panels.map((p) => p.opacity.toFixed(2)).join(',')}] side=${probe.panels[0] && probe.panels[0].side}`,
    '6 块 / opacity ∈ [0.4, 0.7] / DoubleSide');
  // A10 面板正六边形（等距 + 相邻角差 60° + 法线朝心）
  let hexOk = false; let hexDetail = 'n/a';
  if (probe.panels.length === 6) {
    const ds = probe.panels.map((p) => Math.hypot(...p.pos));
    const eq = Math.max(...ds) - Math.min(...ds) <= 0.1;
    const angs = probe.panels.map((p) => Math.atan2(p.pos[2], p.pos[0])).sort((a, b) => a - b);
    const gaps = angs.map((a, i) => { const nx = i + 1 < 6 ? angs[i + 1] : angs[0] + Math.PI * 2; return nx - a; });
    const gapOk = gaps.every((g) => Math.abs(g - Math.PI / 3) <= 0.15);
    const faceOk = probe.panels.every((p) => {
      const rl = Math.hypot(...p.pos) || 1;
      const dot = p.dir.reduce((acc, x, k) => acc + x * (-p.pos[k] / rl), 0);
      return dot >= 0.9;
    });
    hexOk = eq && gapOk && faceOk && ds[0] >= 2.2 && ds[0] <= 5.5;
    hexDetail = `等距=${eq} 角差60°=${gapOk} 朝心=${faceOk} r=${ds[0].toFixed(2)}`;
  }
  record('A10', hexOk, hexDetail, '等距（极差 ≤0.1）/ 角差 60°±8° / 法线朝心 / r ∈ [2.2, 5.5]');
  // A11 state 五字段
  const wantState = ['paused', 'hoveredSector', 'selectedPanel', 'overheat', 'temperature'];
  record('A11', wantState.every((k) => probe.stateKeys.includes(k)), probe.stateKeys.join(','), wantState.join(','));
  // B1 光源构成
  record('B1', probe.lightKinds.includes('AmbientLight') && probe.lightKinds.includes('DirectionalLight') && probe.lightKinds.includes('PointLight'),
    probe.lightKinds.join(','), '三类各 ≥ 1');
  // B2 阴影链路
  record('B2', probe.shadowEnabled === true && probe.core && probe.core.castShadow && probe.core.receiveShadow && probe.dirCast,
    `shadowMap=${probe.shadowEnabled} core cast=${probe.core && probe.core.castShadow} receive=${probe.core && probe.core.receiveShadow} dirCast=${probe.dirCast}`, '全真');
  // B3 主点光（物理单位 30 / decay 2）
  const mainPL = (probe.pointLights || []).find((l) => l.color === '#f97316');
  record('B3', mainPL && mainPL.intensity >= 24 && mainPL.intensity <= 36 && mainPL.decay === 2,
    mainPL ? `intensity=${mainPL.intensity} decay=${mainPL.decay}` : '未找到 #F97316 点光', 'intensity ∈ [24, 36] / decay = 2');
  // B4 冷色补光（12 / decay 2）
  const rimPL = (probe.pointLights || []).find((l) => l.color === '#38bdf8');
  record('B4', rimPL && rimPL.intensity >= 9 && rimPL.intensity <= 15 && rimPL.decay === 2,
    rimPL ? `intensity=${rimPL.intensity} decay=${rimPL.decay}` : '未找到 #38BDF8 点光', 'intensity ∈ [9, 15] / decay = 2');
  // C1 阻尼 / C2 缩放范围
  record('C1', probe.damping === true, String(probe.damping), 'true');
  record('C2', Math.abs(probe.minD - 5) <= 0.2 && Math.abs(probe.maxD - 13) <= 0.2, `${probe.minD} / ${probe.maxD}`, '5 / 13（±0.2）');

  // ---- G 组（静态质感读数）
  record('G1', probe.particlesCount >= 600 && probe.starPoints >= 600,
    `冷却粒子=${probe.particlesCount} 星空=${probe.starPoints}`, '各 ≥ 600');
  record('G2', probe.bloom && probe.bloom.strength >= 0.45 && probe.bloom.strength <= 0.85 && probe.bloom.radius >= 0.35 && probe.bloom.radius <= 0.75,
    probe.bloom ? `strength=${probe.bloom.strength} radius=${probe.bloom.radius} threshold=${probe.bloom.threshold}` : 'composer/bloom 未暴露',
    'strength ∈ [0.45, 0.85] / radius ∈ [0.35, 0.75]');
  record('G3', probe.outputLast, `OutputPass index=${probe.outputIdx}（共 ${probe.outputIdx >= 0 ? '末端' : '缺失'}）`, 'OutputPass 为 composer.passes 最后一项');
  record('G4', probe.toneMapping === 4 && probe.exposure >= 0.9 && probe.exposure <= 1.3,
    `toneMapping=${probe.toneMapping} exposure=${probe.exposure}`, 'ACESFilmic（=4）/ exposure ∈ [0.9, 1.3]');

  // ---- 截图：初始
  await page.screenshot({ path: path.join(outDir, 'shots', 'initial.png') });

  // ---- D 组动画（500ms 两次读）
  const snap = () => page.evaluate(() => {
    const app = window.__app;
    const a = app.thrusters && app.thrusters.instanceMatrix ? app.thrusters.instanceMatrix.array : null;
    return {
      coreEI: app.core && app.core.material ? app.core.material.emissiveIntensity : null,
      shroudY: app.shroud ? app.shroud.rotation.y : null,
      coreY: app.core ? app.core.rotation.y : null,
      inst0: a ? [a[12], a[13], a[14]] : null,
      part: app.particles && app.particles.geometry && app.particles.geometry.attributes.position
        ? Array.from(app.particles.geometry.attributes.position.array.slice(0, 90)) : null,
      temp: app.state ? app.state.temperature : null,
    };
  });
  const d1 = await snap();
  await page.waitForTimeout(500);
  const d2 = await snap();
  record('D1', d1.coreEI !== null && Math.abs(d2.coreEI - d1.coreEI) > 0.02,
    `emissiveIntensity ${d1.coreEI && d1.coreEI.toFixed(3)} → ${d2.coreEI && d2.coreEI.toFixed(3)}`, '|Δ| > 0.02');
  record('D2', d1.inst0 && d2.inst0 && Math.hypot(d2.inst0[0] - d1.inst0[0], d2.inst0[1] - d1.inst0[1], d2.inst0[2] - d1.inst0[2]) > 1e-4,
    d1.inst0 ? `实例0位移=${Math.hypot(d2.inst0[0] - d1.inst0[0], d2.inst0[1] - d1.inst0[1], d2.inst0[2] - d1.inst0[2]).toFixed(4)}` : 'instanceMatrix 不可读',
    '呼吸位移 > 1e-4');
  record('D3', d1.part && d2.part && d1.part.some((v, i) => Math.abs(d2.part[i] - v) > 1e-6),
    d1.part ? '位置数组两帧存在差异' : 'particles 不可读', '位置数组变化');
  record('D4', d1.shroudY !== null && (d2.shroudY - d1.shroudY) < -1e-6,
    `shroud.rotation.y ${d1.shroudY && d1.shroudY.toFixed(4)} → ${d2.shroudY && d2.shroudY.toFixed(4)}`, 'Δ < 0（反向自转）');
  record('D5', d1.temp !== null && d2.temp !== null && d1.temp !== d2.temp,
    `temperature ${d1.temp} → ${d2.temp}`, '两次读数不同');

  // ---- E1 标题与 HUD 文本
  const e1 = await page.evaluate(() => {
    const t = document.body.innerText;
    return ['脉冲星引擎舱', '监控', '核心温度', '扇区', 'FPS'].filter((w) => t.includes(w)).length;
  });
  record('E1', e1 === 5, `${e1}/5`, '5/5');

  // ---- 旋转拖拽
  const dragPx = Number((process.argv.find((a) => a.startsWith('--rotate-drag=')) || '').split('=')[1]) || 420;
  const canvas = await page.locator('canvas').boundingBox();
  if (canvas) {
    const cx = canvas.x + canvas.width / 2; const cy = canvas.y + canvas.height / 2;
    await page.mouse.move(cx, cy); await page.mouse.down();
    await page.mouse.move(cx + dragPx, cy, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: path.join(outDir, 'shots', 'rotated.png') });

  // ---- C3 响应式（375×812 + composer 同步）
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(400);
  const resp = await page.evaluate(() => {
    const c = window.__app.renderer.domElement;
    return { w: c.clientWidth, bw: c.width, rtW: window.__app.composer.renderTarget1.width, aspect: window.__app.camera.aspect, expAspect: window.innerWidth / window.innerHeight };
  });
  const canvasW = await page.locator('canvas').boundingBox();
  record('C3', canvasW && Math.abs(canvasW.width - 375) <= 2 && Math.abs(resp.aspect - resp.expAspect) < 0.01
    && Math.abs(resp.rtW - resp.bw) <= 2,
    `canvas=${canvasW && canvasW.width.toFixed(0)}px aspect=${resp.aspect.toFixed(3)} composerRT=${resp.rtW} vs buffer=${resp.bw}`,
    '宽差 ≤ 2 / aspect 正确 / composer 缓冲同步');
  await page.screenshot({ path: path.join(outDir, 'shots', 'narrow.png') });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(300);

  // ---- H 组交互 ----
  const textBefore = await safe(() => page.evaluate(() => document.body.innerText), '');
  // H1 悬停扇区：投影挑一台推进器实例
  const pick = await safe(() => page.evaluate(() => {
    const app = window.__app;
    const Vec = Object.getPrototypeOf(app.camera.position).constructor;
    const a = app.thrusters.instanceMatrix.array;
    for (let i = 0; i < app.thrusters.count; i++) {
      const o = i * 16;
      const v = app.thrusters.localToWorld(new Vec(a[o + 12], a[o + 13], a[o + 14]));
      v.project(app.camera);
      if (v.z >= 1) continue;
      const x = (v.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
      const dc = Math.hypot(x - window.innerWidth / 2, y - window.innerHeight / 2);
      if (dc < 150 || x < 60 || y < 60 || x > window.innerWidth - 60 || y > window.innerHeight - 60) continue;
      return { x, y, index: i };
    }
    return null;
  }), null);
  if (pick) {
    await page.mouse.move(pick.x, pick.y);
    await page.waitForTimeout(500);
    const h1 = await safe(() => page.evaluate(() => ({
      hovered: window.__app.state.hoveredSector,
    })), {});
    const textHover = await safe(() => page.evaluate(() => document.body.innerText), '');
    record('H1', h1.hovered !== null && h1.hovered !== undefined && textHover !== textBefore,
      `hoveredSector=${h1.hovered} 文本${textHover !== textBefore ? '有新增' : '无变化'}`, 'hoveredSector 非空且 HUD 文本更新');
    await page.mouse.move(30, 400); // 移出，避免后续误悬停
    await page.waitForTimeout(300);
  } else {
    record('H1', false, '未找到可交互的推进器实例投影', '—');
  }

  // H2 点击检修面板聚焦（初始 target 在原点，点击面板后应移向该面板）
  const pickPanel = await safe(() => page.evaluate(() => {
    const app = window.__app;
    const Vec = Object.getPrototypeOf(app.camera.position).constructor;
    for (const p of app.panels) {
      const c = p.getWorldPosition(new Vec());
      const world = c.clone();
      c.project(app.camera);
      if (c.z >= 1) continue;
      const x = (c.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-c.y * 0.5 + 0.5) * window.innerHeight;
      if (x < 60 || y < 60 || x > window.innerWidth - 60 || y > window.innerHeight - 60) continue;
      return { x, y, world: world.toArray() };
    }
    return null;
  }), null);
  if (pickPanel) {
    await page.mouse.click(pickPanel.x, pickPanel.y);
    await page.waitForTimeout(1100);
    const h2 = await safe(() => page.evaluate(() => {
      const t = window.__app.controls.target;
      return { target: [t.x, t.y, t.z] };
    }), {});
    const dTarget = Math.hypot(h2.target[0] - pickPanel.world[0], h2.target[1] - pickPanel.world[1], h2.target[2] - pickPanel.world[2]);
    record('H2', dTarget < 0.6, `target距面板=${dTarget.toFixed(3)}`, 'controls.target 距被点面板 < 0.6');
    // H5 R 复位（target 已移走，按 R 应回原点）
    await page.keyboard.press('r');
    await page.waitForTimeout(1100);
    const h5 = await safe(() => page.evaluate(() => {
      const t = window.__app.controls.target;
      return Math.hypot(t.x, t.y, t.z);
    }), null);
    record('H5', h5 !== null && h5 < 0.1, `target模长=${h5 && h5.toFixed(3)}`, '< 0.1（回原点）');
  } else {
    record('H2', false, '未找到可点击的面板投影', '—');
    record('H5', false, '未找到可点击的面板投影', '—');
  }

  // H3 Tab 循选：两次按键 selectedPanel 递进变化
  const h3 = await safe(async () => {
    const read = () => page.evaluate(() => window.__app.state.selectedPanel);
    const a = await read();
    await page.keyboard.press('Tab');
    await page.waitForTimeout(250);
    const b = await read();
    await page.keyboard.press('Tab');
    await page.waitForTimeout(250);
    const c = await read();
    return { a, b, c };
  }, null);
  record('H3', h3 && h3.b !== h3.a && h3.c !== h3.b,
    h3 ? `${h3.a} → ${h3.b} → ${h3.c}` : 'Tab 未生效', '两次按键读数均变化');

  // H4 空格暂停：实例矩阵停摆 + state.paused
  const h4 = await safe(async () => {
    await page.keyboard.press(' ');
    const p0 = await page.evaluate(() => {
      const a = window.__app.thrusters.instanceMatrix.array;
      return { pos: [a[12], a[13], a[14]], paused: window.__app.state.paused };
    });
    await page.waitForTimeout(500);
    const p1 = await page.evaluate(() => {
      const a = window.__app.thrusters.instanceMatrix.array;
      return [a[12], a[13], a[14]];
    });
    const delta = Math.hypot(p1[0] - p0.pos[0], p1[1] - p0.pos[1], p1[2] - p0.pos[2]);
    await page.keyboard.press(' ');
    return { delta, paused: p0.paused };
  }, null);
  record('H4', h4 && h4.paused === true && h4.delta < 1e-6,
    h4 ? `paused=${h4.paused} 暂停期间位移=${h4.delta.toFixed(8)}` : '按键未生效', 'paused=true 且 |Δ| < 1e-6');

  // ---- E2 画面有效（截图 buffer → 辅助页解码统计）
  const shotBuf = await page.screenshot({ type: 'png' });
  const e2 = await (async () => {
    const helper = await browser.newPage();
    try {
      const dataUrl = `data:image/png;base64,${shotBuf.toString('base64')}`;
      return await helper.evaluate(async (url) => {
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
        const c = document.createElement('canvas');
        c.width = 64; c.height = 64;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, 64, 64);
        const d = ctx.getImageData(0, 0, 64, 64).data;
        let sum = 0; const seen = new Set();
        for (let i = 0; i < d.length; i += 4) {
          const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          sum += lum;
          seen.add(`${d[i]},${d[i+1]},${d[i+2]}`);
        }
        return { avg: sum / (d.length / 4), colors: seen.size };
      }, dataUrl);
    } catch (e) {
      return { err: String(e) };
    } finally {
      await helper.close();
    }
  })();
  record('E2', e2 && !e2.err && e2.avg > 10 && e2.avg < 245 && e2.colors > 1,
    e2 && !e2.err ? `avg=${e2.avg.toFixed(1)} colors=${e2.colors}` : String(e2 && e2.err), '亮度 ∈ (10,245) 且非纯色');

  // ---- I 组 HUD
  const i1 = await safe(async () => {
    const read = () => page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('body *')).filter((e) => /fps/i.test(e.textContent || '') && e.children.length === 0);
      return els.length ? els[0].textContent.trim() : null;
    });
    const a = await read();
    await page.waitForTimeout(1200);
    const b = await read();
    return { a, b };
  }, null);
  // 语义（预冻结修正）：vsync 锁定环境下「两次读数不同」不可稳定验证（收敛恒定），
  // 改验「计数存在且读数健康（30–240）且带小数位」；动画活性由 F1 参考档覆盖。
  const parse = (s) => { const m = s && s.match(/(\d+(?:\.\d+)?)/); return m ? Number(m[1]) : null; };
  record('I1', i1 && i1.a && i1.b && [i1.a, i1.b].every((s) => {
    const v = parse(s);
    return v !== null && v >= 30 && v <= 240 && /\.\d/.test(s);
  }), i1 ? `${i1.a} → ${i1.b}` : 'FPS 计数未找到', '读数存在且 ∈ [30, 240] 带小数位');
  record('I2', probe.pixelRatio && probe.pixelRatio <= 2, `pixelRatio=${probe.pixelRatio}`, '≤ 2');
  const i3 = await safe(() => page.evaluate(() => {
    const hit = Array.from(document.querySelectorAll('body *')).find((e) => {
      const cs = getComputedStyle(e);
      return (cs.backdropFilter || cs.webkitBackdropFilter || '').includes('blur');
    });
    return hit ? (getComputedStyle(hit).backdropFilter || getComputedStyle(hit).webkitBackdropFilter) : null;
  }), null);
  record('I3', !!i3, i3 || '无 backdrop-filter blur', 'HUD 卡片 backdrop-filter 含 blur');

  // ---- 两帧差分（证动画运行）
  await page.screenshot({ path: path.join(outDir, 'shots', 'frame-a.png') });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, 'shots', 'frame-b.png') });

  // ---- F1 帧率（3 秒 rAF 计数，参考档）
  const fps = await page.evaluate(() => new Promise((resolve) => {
    let n = 0; const t0 = performance.now();
    (function loop() { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(loop); else resolve(n / 3); })();
  }));

  // ---- F2（参考档）prefers-reduced-motion：脉冲/呼吸/粒子停用
  let reduced = { status: 'skipped' };
  try {
    const rp = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    await rp.goto('file://' + pageFile, { waitUntil: 'load' });
    await rp.waitForFunction(() => window.__app && window.__app.thrusters, null, { timeout: 15000 });
    await rp.waitForTimeout(900);
    const a = await rp.evaluate(() => {
      const arr = window.__app.thrusters.instanceMatrix.array;
      return [arr[12], arr[13], arr[14]];
    });
    await rp.waitForTimeout(600);
    const b = await rp.evaluate(() => {
      const arr = window.__app.thrusters.instanceMatrix.array;
      return [arr[12], arr[13], arr[14]];
    });
    reduced = { status: 'ok', paused: Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) < 1e-6 };
    await rp.close();
  } catch { /* 如实记 skipped */ }

  // ---- axe-core 附加观测（CDN 注入；离线则 skipped）
  let axe = { status: 'skipped', issues: null };
  try {
    await page.addScriptTag({ url: 'https://unpkg.com/axe-core@4.10.2/axe.min.js' });
    const r = await page.evaluate(() => window.axe && window.axe.run(document, { resultTypes: ['violations'] }));
    axe = { status: 'ok', issues: r && r.violations ? r.violations.length : null };
  } catch { /* 离线：如实记 skipped */ }

  await browser.close();

  const scored = checks; // A1–I3 全部计入分母（F1/F2 参考档单列）
  const pass = scored.filter((c) => c.pass).length;
  const out = {
    page: pageFile,
    pass, total: scored.length,
    rate: `${pass}/${scored.length}`,
    checks: scored,
    reference: {
      fps: Math.round(fps * 10) / 10, expect: '≥ 45（参考档，不计入达标率）',
      reducedMotion: reduced, expectReduced: '呼吸停用（参考档，不计入达标率）',
    },
    axe,
    shots: ['initial.png', 'rotated.png', 'narrow.png', 'frame-a.png', 'frame-b.png'].map((s) => `shots/${s}`),
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(outDir, 'probe.json'), JSON.stringify(out, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ pass: out.pass, total: out.total, rate: out.rate, fps: out.reference.fps, reduced: reduced.status, axe: axe.status }, null, 2) + '\n');
}

main().catch((e) => { console.error(String((e && e.stack) || e)); process.exit(1); });
