#!/usr/bin/env node
'use strict';
// q_threejs-orbit-scene 页面题探针（plan Part 03 §3，FR-6/AC-6）。
// 用法：node bank/core/q_threejs-orbit-scene/acceptance/probe.js <index.html 绝对路径> <输出目录> [--rotate-drag <px>]
// 输出：<outdir>/probe.json（达标项/总项 + 逐项 {id,判定,实测,期望}）+ shots/（初始/拖拽旋转/窄屏/两帧）。
// 依赖：eval/bench devDependency playwright（chromium）。A1–E2 共 19 项为达标分母；F1 参考档单列；axe 附加观测。

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

  await page.goto('file://' + pageFile, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__app && window.__app.scene && window.__app.galaxy, null, { timeout: 15000 });
  await page.waitForTimeout(800); // 首帧渲染稳定

  // ---- 场景遍历（A/B 组）
  const probe = await page.evaluate(() => {
    const app = window.__app;
    const meshes = []; const lines = []; const lights = [];
    app.scene.traverse((o) => {
      if (o.isMesh) meshes.push(o);
      if (o.isLine) lines.push(o);
      if (o.isLight) lights.push(o);
    });
    const center = meshes.find((m) => m.geometry && m.geometry.type === 'IcosahedronGeometry');
    const spheres = meshes.filter((m) => m.geometry && m.geometry.type === 'SphereGeometry');
    const torus = meshes.find((m) => m.geometry && m.geometry.type === 'TorusGeometry');
    const colorCount = {};
    const sphereInfo = [];
    spheres.forEach((s) => {
      const hex = '#' + s.material.color.getHexString();
      colorCount[hex] = (colorCount[hex] || 0) + 1;
      sphereInfo.push({
        pos: s.getWorldPosition(new (Object.getPrototypeOf(app.camera.position).constructor)()).toArray(),
        rot: [s.rotation.x, s.rotation.y, s.rotation.z],
        castShadow: !!s.castShadow,
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
      },
      sphereCount: spheres.length, colorCount, sphereInfo,
      lineCount: lines.length,
      lineColors: lines.map((l) => '#' + l.material.color.getHexString()),
      torus: torus && { radius: torus.geometry.parameters.radius, tube: torus.geometry.parameters.tube },
      lightKinds: lights.map((l) => l.type),
      dirCast: dir ? !!dir.castShadow : false,
      shadowEnabled: !!app.renderer.shadowMap.enabled,
      damping: !!app.controls.enableDamping,
      minD: app.controls.minDistance, maxD: app.controls.maxDistance,
      galaxyRotY: app.galaxy.rotation.y,
    };
  });

  // A1 可观测性（五字段非空）
  record('A1', probe.hasScene && probe.hasCamera && probe.hasRenderer && probe.hasControls && probe.hasGalaxy,
    probe.appKeys.join(','), 'scene,camera,renderer,controls, galaxy 五字段非空');
  // A2 中心几何体
  record('A2', probe.center && probe.center.type === 'IcosahedronGeometry'
    && Math.abs((probe.center.params.detail || 0) - 0) < 1e-9
    && Math.abs(probe.center.params.radius - 1) < 0.05,
    probe.center && `${probe.center.type} r=${probe.center.params && probe.center.params.radius} d=${probe.center.params && probe.center.params.detail}`,
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
  // A7 轨道环
  record('A7', probe.torus && Math.abs(probe.torus.radius - 3.2) < 1e-6 && Math.abs(probe.torus.tube - 0.02) < 1e-6,
    probe.torus && `r=${probe.torus.radius} tube=${probe.torus.tube}`, '3.2 / 0.02');
  // A8 中心材质
  record('A8', probe.center && Math.abs(probe.center.metalness - 0.8) <= 0.05 && Math.abs(probe.center.roughness - 0.2) <= 0.05
    && probe.center.color.toLowerCase() === '#4a90d9',
    probe.center && `m=${probe.center.metalness} r=${probe.center.roughness} c=${probe.center.color}`, '0.8 / 0.2 / #4A90D9（±0.05）');
  // A9 颜色分组
  const want = { '#22c55e': 3, '#ef4444': 2, '#3b82f6': 2, '#9ca3af': 1 };
  const colorOk = Object.keys(want).every((k) => (probe.colorCount[k] || 0) === want[k]);
  record('A9', colorOk, JSON.stringify(probe.colorCount), JSON.stringify(want));
  // B1 光源构成
  const kinds = probe.lightKinds;
  record('B1', kinds.includes('AmbientLight') && kinds.includes('DirectionalLight') && kinds.includes('PointLight'), kinds.join(','), '三类各 ≥ 1');
  // B2 阴影开启
  record('B2', probe.shadowEnabled === true, String(probe.shadowEnabled), 'true');
  // B3 投影/接收
  record('B3', probe.center && probe.center.castShadow && probe.center.receiveShadow && probe.dirCast,
    `center cast=${probe.center && probe.center.castShadow} receive=${probe.center && probe.center.receiveShadow} dirCast=${probe.dirCast}`, '全真');
  // C1 阻尼 / C2 缩放范围
  record('C1', probe.damping === true, String(probe.damping), 'true');
  record('C2', Math.abs(probe.minD - 4) <= 0.1 && Math.abs(probe.maxD - 12) <= 0.1, `${probe.minD} / ${probe.maxD}`, '4 / 12（±0.1）');

  // ---- 截图：初始
  await page.screenshot({ path: path.join(outDir, 'shots', 'initial.png') });

  // ---- D1/D2 动画（500ms 两次读）
  const rot1 = await page.evaluate(() => ({
    g: window.__app.galaxy.rotation.y,
    s: window.__app.galaxy.children.filter((o) => o.isMesh && o.geometry.type === 'SphereGeometry').map((o) => o.rotation.x + o.rotation.y + o.rotation.z),
  }));
  await page.waitForTimeout(500);
  const rot2 = await page.evaluate(() => ({
    g: window.__app.galaxy.rotation.y,
    s: window.__app.galaxy.children.filter((o) => o.isMesh && o.geometry.type === 'SphereGeometry').map((o) => o.rotation.x + o.rotation.y + o.rotation.z),
  }));
  record('D1', rot2.g > rot1.g, `Δgalaxy=${(rot2.g - rot1.g).toFixed(4)}`, '> 0');
  const satDelta = rot1.s.map((v, i) => rot2.s[i] - v);
  record('D2', satDelta.some((d) => d > 0), `卫星自转增量=[${satDelta.map((d) => d.toFixed(4)).join(',')}]`, '存在 > 0');

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
          seen.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
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

  // ---- 两帧差分（证动画运行）
  await page.screenshot({ path: path.join(outDir, 'shots', 'frame-a.png') });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, 'shots', 'frame-b.png') });

  // ---- F1 帧率（3 秒 rAF 计数，参考档）
  const fps = await page.evaluate(() => new Promise((resolve) => {
    let n = 0; const t0 = performance.now();
    (function loop() { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(loop); else resolve(n / 3); })();
  }));

  // ---- axe-core 附加观测（CDN 注入；离线则 skipped）
  let axe = { status: 'skipped', issues: null };
  try {
    await page.addScriptTag({ url: 'https://unpkg.com/axe-core@4.10.2/axe.min.js' });
    const r = await page.evaluate(() => window.axe && window.axe.run(document, { resultTypes: ['violations'] }));
    axe = { status: 'ok', issues: r && r.violations ? r.violations.length : null };
  } catch { /* 离线：如实记 skipped */ }

  await browser.close();

  const scored = checks; // A1–E2 全部计入分母（F1 参考档单列）
  const pass = scored.filter((c) => c.pass).length;
  const out = {
    page: pageFile,
    pass, total: scored.length,
    rate: `${pass}/${scored.length}`,
    checks: scored,
    reference: { fps: Math.round(fps * 10) / 10, expect: '≥ 45（参考档，不计入达标率）' },
    axe,
    shots: ['initial.png', 'rotated.png', 'narrow.png', 'frame-a.png', 'frame-b.png'].map((s) => `shots/${s}`),
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(outDir, 'probe.json'), JSON.stringify(out, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ pass: out.pass, total: out.total, rate: out.rate, fps: out.reference.fps, axe: axe.status }, null, 2) + '\n');
}

main().catch((e) => { console.error(String(e && e.message || e)); process.exit(1); });
