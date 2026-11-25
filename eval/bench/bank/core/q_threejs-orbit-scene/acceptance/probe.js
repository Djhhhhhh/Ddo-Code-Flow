#!/usr/bin/env node
'use strict';
// q_threejs-orbit-scene 页面题探针 v2（难度升级：视觉质感 + 交互深度）。
// 用法：node bank/core/q_threejs-orbit-scene/acceptance/probe.js <index.html 绝对路径> <输出目录> [--rotate-drag <px>]
// 输出：<outdir>/probe.json（达标项/总项 + 逐项 {id,判定,实测,期望}）+ shots/（初始/拖拽旋转/窄屏/两帧）。
// 依赖：eval/bench devDependency playwright（chromium）。
// 计分项 A1–I3 共 33 项为达标分母；F1 帧率 / F2 reduced-motion 为参考档单列；axe 附加观测。
// 健壮性约定：产物缺字段（如 __app.satellites 不存在）记该项失败，不让探针崩溃。

const path = require('node:path');
const fs = require('node:fs');

async function main() {
  const [pageFileArg, outDirArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!pageFileArg || !outDirArg) {
    console.error('用法: node bank/core/q_threejs-orbit-scene/acceptance/probe.js <index.html> <outdir>');
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
  await page.waitForFunction(() => window.__app && window.__app.scene && window.__app.galaxy, null, { timeout: 15000 });
  await page.waitForTimeout(800); // 首帧渲染稳定

  // ---- 场景遍历（A/B 组 + v2 新增结构）
  const probe = await page.evaluate(() => {
    const app = window.__app;
    const meshes = []; const lines = []; const lights = []; const points = [];
    app.scene.traverse((o) => {
      if (o.isMesh) meshes.push(o);
      if (o.isLine) lines.push(o);
      if (o.isLight) lights.push(o);
      if (o.isPoints) points.push(o);
    });
    const center = meshes.find((m) => m.geometry && m.geometry.type === 'IcosahedronGeometry' && !m.material.wireframe);
    const wire = meshes.find((m) => m.geometry && m.geometry.type === 'IcosahedronGeometry' && m.material.wireframe);
    const spheres = meshes.filter((m) => m.geometry && m.geometry.type === 'SphereGeometry');
    const tori = meshes.filter((m) => m.geometry && m.geometry.type === 'TorusGeometry');
    const colorCount = {};
    const sphereInfo = [];
    spheres.forEach((s) => {
      const hex = '#' + s.material.color.getHexString();
      colorCount[hex] = (colorCount[hex] || 0) + 1;
      sphereInfo.push({
        pos: s.getWorldPosition(new (Object.getPrototypeOf(app.camera.position).constructor)()).toArray(),
        rot: [s.rotation.x, s.rotation.y, s.rotation.z],
        castShadow: !!s.castShadow,
        emissive: s.material.emissive ? '#' + s.material.emissive.getHexString() : null,
        emissiveIntensity: s.material.emissiveIntensity !== undefined ? s.material.emissiveIntensity : null,
      });
    });
    const dir = lights.find((l) => l.isDirectionalLight);
    return {
      appKeys: Object.keys(app),
      hasScene: !!app.scene, hasCamera: !!app.camera, hasRenderer: !!app.renderer, hasControls: !!app.controls, hasGalaxy: !!app.galaxy,
      center: center && {
        type: center.geometry.type, params: center.geometry.parameters,
        metalness: center.material.metalness, roughness: center.material.roughness,
        color: '#' + center.material.color.getHexString(),
        castShadow: !!center.castShadow, receiveShadow: !!center.receiveShadow,
        posY: center.position.y,
      },
      wire: wire && { radius: wire.geometry.parameters.radius, opacity: wire.material.opacity },
      sphereCount: spheres.length, colorCount, sphereInfo,
      lineCount: lines.length,
      lineColors: lines.map((l) => '#' + l.material.color.getHexString()),
      tori: tori.map((t) => ({ radius: t.geometry.parameters.radius, tube: t.geometry.parameters.tube, rotX: t.rotation.x, opacity: t.material.opacity })),
      starPoints: points.reduce((n, p) => n + (p.geometry && p.geometry.attributes && p.geometry.attributes.position ? p.geometry.attributes.position.count : 0), 0),
      lightKinds: lights.map((l) => l.type),
      pointLights: lights.filter((l) => l.type === 'PointLight').map((l) => ({ color: '#' + l.color.getHexString(), intensity: l.intensity })),
      dirCast: dir ? !!dir.castShadow : false,
      shadowEnabled: !!app.renderer.shadowMap.enabled,
      damping: !!app.controls.enableDamping,
      minD: app.controls.minDistance, maxD: app.controls.maxDistance,
      galaxyRotY: app.galaxy.rotation.y,
      composer: !!app.composer,
      bloom: (() => {
        if (!app.composer || !app.composer.passes) return null;
        const p = app.composer.passes.find((x) => x.constructor && /unrealbloom/i.test(x.constructor.name)) ||
          app.composer.passes.find((x) => typeof x.strength === 'number');
        return p ? { strength: p.strength, radius: p.radius } : null;
      })(),
      satellites: Array.isArray(app.satellites) ? app.satellites.length : null,
      pixelRatio: app.renderer.getPixelRatio ? app.renderer.getPixelRatio() : null,
    };
  });

  // A1 可观测性（五字段非空）
  record('A1', probe.hasScene && probe.hasCamera && probe.hasRenderer && probe.hasControls && probe.hasGalaxy,
    probe.appKeys.join(','), 'scene,camera,renderer,controls, galaxy 五字段非空');
  // A2 中心几何体
  record('A2', probe.center && probe.center.type === 'IcosahedronGeometry'
    && Math.abs((probe.center.params.detail || 0) - 0) < 1e-9
    && Math.abs(probe.center.params.radius - 1) < 0.05,
    probe.center && `${probe.center.type} r=${probe.center.params && probe.center.params.radius} d=${probe.center.params && probe.center.detail}`,
    'IcosahedronGeometry / 1 / 0');
  // A3 卫星数量
  record('A3', probe.sphereCount === 8, `${probe.sphereCount}`, '8');
  // A4 分布半径（±0.05）
  const dists = probe.sphereInfo.map((s) => Math.hypot(s.pos[0], s.pos[1], s.pos[2]));
  const radiusOk = probe.sphereCount === 8 && dists.every((d) => Math.abs(d - 3) <= 0.05);
  record('A4', radiusOk, dists.map((d) => d.toFixed(3)).join(','), '8 个均 |d-3| ≤ 0.05');
  // A5 球面均匀度（两两夹角最小值 ≥ 35°；A4 未过则关联降级）
  let minAngle = null;
  if (probe.sphereCount >= 2) {
    const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
    minAngle = 180;
    for (let i = 0; i < probe.sphereCount; i++) {
      for (let j = i + 1; j < probe.sphereCount; j++) {
        const a = norm(probe.sphereInfo[i].pos); const b = norm(probe.sphereInfo[j].pos);
        const dot = a.reduce((s, x, k) => s + x * b[k], 0);
        minAngle = Math.min(minAngle, (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI);
      }
    }
  }
  record('A5', radiusOk && minAngle !== null && minAngle >= 35, minAngle === null ? 'n/a' : `${minAngle.toFixed(1)}°`, '≥ 35°（A4 未过则同判失败）');
  // A6 连接线（按颜色计数：场景可能含网格等辅助线，仅统计 #334155 连接线）
  const connCount = (probe.lineColors || []).filter((c) => c === '#334155').length;
  record('A6', connCount === 8, `${probe.lineCount} 条线中 #334155=${connCount}`, '8 条 #334155');
  // A7 轨道环（内环）
  const innerTorus = (probe.tori || []).find((t) => Math.abs(t.radius - 3.2) < 1e-6);
  record('A7', innerTorus && Math.abs(innerTorus.tube - 0.02) < 1e-6,
    innerTorus && `r=${innerTorus.radius} tube=${innerTorus.tube}`, '3.2 / 0.02');
  // A8 中心材质
  record('A8', probe.center && Math.abs(probe.center.metalness - 0.8) <= 0.05 && Math.abs(probe.center.roughness - 0.2) <= 0.05
    && probe.center.color.toLowerCase() === '#4a90d9',
    probe.center && `m=${probe.center.metalness} r=${probe.center.roughness} c=${probe.center.color}`, '0.8 / 0.2 / #4A90D9（±0.05）');
  // A9 颜色分组
  const want = { '#22c55e': 3, '#ef4444': 2, '#3b82f6': 2, '#9ca3af': 1 };
  const colorOk = Object.keys(want).every((k) => (probe.colorCount[k] || 0) === want[k]);
  record('A9', colorOk, JSON.stringify(probe.colorCount), JSON.stringify(want));
  // A10（v2）中心线框叠加
  record('A10', probe.wire && Math.abs(probe.wire.radius - 1.04) <= 0.08 && probe.wire.opacity <= 0.45,
    probe.wire && `r=${probe.wire.radius} opacity=${probe.wire.opacity}`, '线框 Icosahedron r≈1.04 / opacity ≤ 0.45');
  // A11（v2）外环（倾斜 60°、半透明）
  const outer = (probe.tori || []).find((t) => Math.abs(t.radius - 4.6) <= 0.1);
  const outerDeg = outer ? (outer.rotX * 180) / Math.PI : null;
  record('A11', outer && Math.abs(outerDeg - 60) <= 6 && outer.opacity <= 0.5,
    outer && `r=${outer.radius} rotX=${outerDeg.toFixed(1)}° opacity=${outer.opacity}`, 'r≈4.6 / 绕 x 倾斜 60°（±6°）/ opacity ≤ 0.5');
  // B1 光源构成
  const kinds = probe.lightKinds;
  record('B1', kinds.includes('AmbientLight') && kinds.includes('DirectionalLight') && kinds.includes('PointLight'), kinds.join(','), '三类各 ≥ 1');
  // B2 阴影开启
  record('B2', probe.shadowEnabled === true, String(probe.shadowEnabled), 'true');
  // B3 投影/接收
  record('B3', probe.center && probe.center.castShadow && probe.center.receiveShadow && probe.dirCast,
    `center cast=${probe.center && probe.center.castShadow} receive=${probe.center && probe.center.receiveShadow} dirCast=${probe.dirCast}`, '全真');
  // B4（v2）底部冷色补光（第二盏 PointLight，#38BDF8）
  const rim = (probe.pointLights || []).find((l) => l.color === '#38bdf8' && l.intensity > 0.1);
  record('B4', !!rim, JSON.stringify(probe.pointLights), '存在 #38BDF8 冷色 PointLight');
  // C1 阻尼 / C2 缩放范围
  record('C1', probe.damping === true, String(probe.damping), 'true');
  record('C2', Math.abs(probe.minD - 4) <= 0.1 && Math.abs(probe.maxD - 12) <= 0.1, `${probe.minD} / ${probe.maxD}`, '4 / 12（±0.1）');

  // ---- 截图：初始
  await page.screenshot({ path: path.join(outDir, 'shots', 'initial.png') });

  // ---- D1/D2 动画（500ms 两次读）
  const rot1 = await page.evaluate(() => ({
    g: window.__app.galaxy.rotation.y,
    cy: (window.__app.galaxy.children.find((o) => o.geometry && o.geometry.type === 'IcosahedronGeometry' && !o.material.wireframe) || {}).position ? window.__app.galaxy.children.find((o) => o.geometry && o.geometry.type === 'IcosahedronGeometry' && !o.material.wireframe).position.y : null,
    s: window.__app.galaxy.children.filter((o) => o.isMesh && o.geometry.type === 'SphereGeometry').map((o) => o.rotation.x + o.rotation.y + o.rotation.z),
    f: (window.__app.galaxy.children.filter((o) => o.isMesh && o.geometry.type === 'SphereGeometry').find((o) => '#' + o.material.color.getHexString() === '#ef4444') || {}).material
      ? window.__app.galaxy.children.filter((o) => o.isMesh && o.geometry.type === 'SphereGeometry').find((o) => '#' + o.material.color.getHexString() === '#ef4444').material.emissiveIntensity : null,
  }));
  await page.waitForTimeout(500);
  const rot2 = await page.evaluate(() => ({
    g: window.__app.galaxy.rotation.y,
    s: window.__app.galaxy.children.filter((o) => o.isMesh && o.geometry.type === 'SphereGeometry').map((o) => o.rotation.x + o.rotation.y + o.rotation.z),
    cy: (window.__app.galaxy.children.find((o) => o.geometry && o.geometry.type === 'IcosahedronGeometry' && !o.material.wireframe) || {}).position ? window.__app.galaxy.children.find((o) => o.geometry && o.geometry.type === 'IcosahedronGeometry' && !o.material.wireframe).position.y : null,
    f: (window.__app.galaxy.children.filter((o) => o.isMesh && o.geometry.type === 'SphereGeometry').find((o) => '#' + o.material.color.getHexString() === '#ef4444') || {}).material
      ? window.__app.galaxy.children.filter((o) => o.isMesh && o.geometry.type === 'SphereGeometry').find((o) => '#' + o.material.color.getHexString() === '#ef4444').material.emissiveIntensity : null,
  }));
  record('D1', rot2.g > rot1.g, `Δgalaxy=${(rot2.g - rot1.g).toFixed(4)}`, '> 0');
  const satDelta = rot1.s.map((v, i) => rot2.s[i] - v);
  record('D2', satDelta.some((d) => d > 0), `卫星自转增量=[${satDelta.map((d) => d.toFixed(4)).join(',')}]`, '存在 > 0');
  // D3（v2）中心浮动
  record('D3', rot1.cy !== null && rot2.cy !== null && Math.abs(rot2.cy - rot1.cy) > 1e-4,
    `y ${rot1.cy && rot1.cy.toFixed(4)} → ${rot2.cy && rot2.cy.toFixed(4)}`, '|Δy| > 1e-4');
  // D4（v2）失败卫星闪烁（emissiveIntensity 变化）
  record('D4', rot1.f !== null && rot1.f !== undefined && Math.abs(rot2.f - rot1.f) > 1e-3,
    `emissiveIntensity ${rot1.f && rot1.f.toFixed(3)} → ${rot2.f && rot2.f.toFixed(3)}`, '|Δ| > 1e-3');

  // ---- E1 标题与图例
  const e1 = await page.evaluate(() => {
    const t = document.body.innerText;
    return ['任务星系', '成功', '失败', '进行中', '待定'].filter((w) => t.includes(w)).length;
  });
  record('E1', e1 === 5, `${e1}/5`, '5/5');

  // ---- 旋转 90°（真实拖拽）
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

  // ---- C3 响应式（375×812）
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(400);
  const resp = await page.evaluate(() => {
    const c = window.__app.renderer.domElement;
    return { w: c.clientWidth, aspect: window.__app.camera.aspect, expAspect: window.innerWidth / window.innerHeight };
  });
  const canvasW = await page.locator('canvas').boundingBox();
  record('C3', canvasW && Math.abs(canvasW.width - 375) <= 2 && Math.abs(resp.aspect - resp.expAspect) < 0.01,
    `canvas=${canvasW && canvasW.width.toFixed(0)}px aspect=${resp.aspect.toFixed(3)} 期望=${resp.expAspect.toFixed(3)}`, '差 ≤ 2 且 aspect 正确');
  await page.screenshot({ path: path.join(outDir, 'shots', 'narrow.png') });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(300);

  // ---- H 组（v2 交互深度）----
  // 投影挑选一颗「成功」卫星：在相机前方、视口中央区域、远离画面中心（避免被中心体遮挡）
  const pick = await safe(async () => page.evaluate(() => {
    const app = window.__app;
    const v = new (Object.getPrototypeOf(app.camera.position).constructor)();
    for (let i = 0; i < app.satellites.length; i++) {
      const s = app.satellites[i];
      const mesh = s.mesh || s;
      if (s.status && s.status !== '成功' && '#' + mesh.material.color.getHexString() !== '#22c55e') continue;
      if ('#' + mesh.material.color.getHexString() !== '#22c55e') continue;
      mesh.getWorldPosition(v);
      const world = v.clone();
      v.project(app.camera);
      if (v.z >= 1) continue;
      const x = (v.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
      const dc = Math.hypot(x - window.innerWidth / 2, y - window.innerHeight / 2);
      if (dc < 150 || x < 60 || y < 60 || x > window.innerWidth - 60 || y > window.innerHeight - 60) continue;
      return { x, y, index: i, world: world.toArray() };
    }
    return null;
  }), null);

  const textBefore = await safe(() => page.evaluate(() => document.body.innerText), '');
  // H1 悬停：放大 + emissive 提亮 + tooltip 文本出现
  if (pick) {
    await page.mouse.move(pick.x, pick.y);
    await page.waitForTimeout(500);
    const h1 = await safe(() => page.evaluate((idx) => {
      const app = window.__app;
      const s = app.satellites[idx];
      const mesh = s.mesh || s;
      return { scale: mesh.scale.x, ei: mesh.material.emissiveIntensity };
    }, pick.index), {});
    const textHover = await safe(() => page.evaluate(() => document.body.innerText), '');
    record('H1', h1.scale > 1.2 && (h1.ei === null || h1.ei === undefined || h1.ei >= 0.6) && textHover !== textBefore,
      `scale=${h1.scale && h1.scale.toFixed(2)} emissiveIntensity=${h1.ei} 文本${textHover !== textBefore ? '有新增' : '无变化'}`,
      'scale > 1.2 且 emissiveIntensity ≥ 0.6 且 tooltip 文本出现');
    // H2 点击聚焦：controls.target 过渡 + 详情文本
    await page.mouse.click(pick.x, pick.y);
    await page.waitForTimeout(1100);
    const h2 = await safe(() => page.evaluate(() => {
      const t = window.__app.controls.target;
      return { target: [t.x, t.y, t.z] };
    }), {});
    const dTarget = Math.hypot(h2.target[0] - pick.world[0], h2.target[1] - pick.world[1], h2.target[2] - pick.world[2]);
    const textClick = await safe(() => page.evaluate(() => document.body.innerText), '');
    record('H2', dTarget < 0.8 && textClick !== textBefore,
      `target距卫星=${dTarget.toFixed(3)} 文本${textClick !== textBefore ? '有新增' : '无变化'}`,
      'controls.target 距被点卫星 < 0.8 且详情文本出现');
    await page.mouse.move(30, 400); // 移出卫星，避免后续误悬停
    await page.waitForTimeout(300);
  } else {
    record('H1', false, '未找到可交互的「成功」卫星投影', '—');
    record('H2', false, '未找到可交互的「成功」卫星投影', '—');
  }

  // H3 图例过滤：点击「成功」图例 → 3 颗隐藏；再点恢复
  const h3 = await safe(async () => {
    const legend = page.getByText('成功', { exact: true }).first();
    await legend.click();
    await page.waitForTimeout(400);
    const hidden = await page.evaluate(() => window.__app.satellites.filter((s) => {
      const m = s.mesh || s;
      return '#' + m.material.color.getHexString() === '#22c55e' && m.visible === false;
    }).length);
    await legend.click();
    await page.waitForTimeout(300);
    const restored = await page.evaluate(() => window.__app.satellites.filter((s) => {
      const m = s.mesh || s;
      return '#' + m.material.color.getHexString() === '#22c55e' && m.visible === true;
    }).length);
    return { hidden, restored };
  }, null);
  record('H3', h3 && h3.hidden === 3 && h3.restored === 3,
    h3 ? `隐藏=${h3.hidden} 恢复=${h3.restored}` : '图例不可点或 satellites 未暴露', '隐藏 3 / 恢复 3');

  // H4 空格暂停：动画停摆（controls 不受影响不测）
  const h4 = await safe(async () => {
    await page.keyboard.press(' ');
    const a = await page.evaluate(() => window.__app.galaxy.rotation.y);
    await page.waitForTimeout(500);
    const b = await page.evaluate(() => window.__app.galaxy.rotation.y);
    const delta = b - a;
    await page.keyboard.press(' ');
    return { delta };
  }, null);
  record('H4', h4 && Math.abs(h4.delta) < 1e-6, h4 ? `暂停期间Δgalaxy=${h4.delta.toFixed(8)}` : '按键未生效', '|Δ| < 1e-6');

  // ---- E2 画面有效（亮度与非纯色）：截图 buffer → 辅助页解码统计（WebGL 画布页内回读会被清屏）
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

  // ---- G 组（v2 视觉质感）
  record('G1', probe.starPoints >= 800, `${probe.starPoints} 点`, '≥ 800');
  record('G2', probe.bloom && probe.bloom.strength >= 0.3 && probe.bloom.strength <= 0.9 && probe.composer,
    probe.bloom ? `bloom strength=${probe.bloom.strength}` : 'composer/bloom 未暴露', 'composer + UnrealBloomPass strength ∈ [0.3, 0.9]');

  // ---- I 组（v2 HUD 与渲染质量）
  const i1 = await safe(async () => {
    const read = () => page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('body *')).filter((e) => /fps/i.test(e.textContent || '') && e.children.length === 0);
      return els.length ? els[0].textContent.trim() : null;
    });
    const a = await read();
    await page.waitForTimeout(700);
    const b = await read();
    return { a, b };
  }, null);
  record('I1', i1 && i1.a && i1.b && i1.a !== i1.b, i1 ? `${i1.a} → ${i1.b}` : 'FPS 计数未找到/未更新', '两次读数不同');
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

  // ---- F2（v2 参考档）prefers-reduced-motion：自转停用（单开页面模拟）
  let reduced = { status: 'skipped' };
  try {
    const rp = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    await rp.goto('file://' + pageFile, { waitUntil: 'load' });
    await rp.waitForFunction(() => window.__app && window.__app.galaxy, null, { timeout: 15000 });
    await rp.waitForTimeout(800);
    const a = await rp.evaluate(() => window.__app.galaxy.rotation.y);
    await rp.waitForTimeout(600);
    const b = await rp.evaluate(() => window.__app.galaxy.rotation.y);
    reduced = { status: 'ok', paused: Math.abs(b - a) < 1e-6, delta: b - a };
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
      reducedMotion: reduced, expectReduced: '自转停用（参考档，不计入达标率）',
    },
    axe,
    shots: ['initial.png', 'rotated.png', 'narrow.png', 'frame-a.png', 'frame-b.png'].map((s) => `shots/${s}`),
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(outDir, 'probe.json'), JSON.stringify(out, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ pass: out.pass, total: out.total, rate: out.rate, fps: out.reference.fps, reduced: reduced.status, axe: axe.status }, null, 2) + '\n');
}

main().catch((e) => { console.error(String((e && e.stack) || e)); process.exit(1); });
