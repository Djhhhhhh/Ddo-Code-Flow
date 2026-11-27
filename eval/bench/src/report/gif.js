'use strict';
// 双臂交付 GIF 采集（#100 跟进：交互样式以动图呈现）。
// 方式：playwright 打开两臂交付页 → 录制「空闲动画 2s → 画布拖拽 → 1.5s」→ ffmpeg palette 两步转 GIF。
// 不动题库探针（probe.js 仍是唯一判分层）；本模块只产展示素材，失败降级为无 GIF（回退 PNG）。
// 缓存：GIF 落在 runs/<rid>/<q>/report/<arm>/shots/demo.gif，report 重跑不重录（删文件即重录）。
// 看门狗：整段录制/转码硬超时（默认 150s）——本机浏览器偶发挂起时降级而不是卡死 report。

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { launchBrowser } = require('./render'); // 与 exportPng 同源：bundled 缺失回退本机 Chrome 通道

const skipReason = () => {
  if (process.env.BENCH_SKIP_GIF === '1') return 'BENCH_SKIP_GIF=1';
  if (process.env.BENCH_SKIP_PNG === '1') return 'BENCH_SKIP_PNG=1（测试环境）';
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return null; } catch { return 'ffmpeg 不可用'; }
};

/** 单臂录制主体（无自身超时，由外层看门狗兜底）。stages 收集阶段标记用于失败定位。 */
async function recordNow({ htmlPath, outGif, tmpDir, width, fps, seconds, stages }) {
  const browser = await launchBrowser();
  stages.push('browser');
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      recordVideo: { dir: tmpDir, size: { width: 1280, height: 800 } },
    });
    stages.push('context');
    const page = await context.newPage();
    stages.push('page');
    await page.goto(`file://${htmlPath}`, { waitUntil: 'domcontentloaded', timeout: 30_000 }); // 不等 CDN 子资源
    stages.push('goto');
    // 就绪判定：页面题契约暴露 window.__app；等不到则退化为 canvas 出现（黑屏头交给 -sseof 裁尾兜底）
    await page.waitForFunction(() => Boolean(window.__app && document.querySelector('canvas')), { timeout: 20_000 })
      .catch(() => page.waitForSelector('canvas', { timeout: 10_000 }).catch(() => { /* 无画布也继续录 */ }));
    stages.push('ready');
    await page.waitForTimeout(1800); // 自身动画（计入成片头部）
    const box = await page.locator('canvas').boundingBox();
    if (box) {
      const cx = box.x + box.width / 2; const cy = box.y + box.height / 2;
      await page.mouse.move(cx, cy); await page.mouse.down();
      await page.mouse.move(cx + 420, cy, { steps: 12 }); // 与探针同参数的真实拖拽
      await page.mouse.up();
    }
    stages.push('drag');
    await page.waitForTimeout(2200);
    const video = page.video();
    await context.close(); // 落盘 webm
    const webm = await video.path();
    stages.push('webm');
    const palette = path.join(tmpDir, 'palette.png');
    // -sseof 取片尾 seconds 秒：加载期黑帧一律裁掉，成片恒为「就绪动画 → 拖拽 → 稳定」
    execFileSync('ffmpeg', ['-y', '-sseof', `-${seconds}`, '-i', webm, '-vf', `fps=${fps},scale=${width}:-1:flags=lanczos,palettegen`, palette], { stdio: 'ignore', timeout: 60_000 });
    execFileSync('ffmpeg', ['-y', '-sseof', `-${seconds}`, '-i', webm, '-i', palette, '-lavfi', `fps=${fps},scale=${width}:-1:flags=lanczos[x];[x][1:v]paletteuse`, '-t', String(seconds), outGif], { stdio: 'ignore', timeout: 60_000 });
    stages.push('gif');
  } finally {
    await browser.close().catch(() => { /* 看门狗触发时尽力关闭 */ });
  }
}

/**
 * 录制单臂 GIF。htmlPath = 交付页绝对路径；outGif = 目标 gif 路径。
 * 返回 { skipped, reason? }；已存在缓存直接复用（skipped:false，reason:'cache'）。
 */
async function recordArmGif({ htmlPath, outGif, width = 1080, fps = 15, seconds = 4.5, watchdogMs = 150_000 }) {
  if (!fs.existsSync(htmlPath)) return { skipped: true, reason: `交付页不存在: ${htmlPath}` };
  if (fs.existsSync(outGif)) return { skipped: false, reason: 'cache' };
  const why = skipReason();
  if (why) return { skipped: true, reason: why };

  const tmpDir = fs.mkdtempSync(path.join(path.dirname(outGif), 'gif-tmp-'));
  const stages = [];
  let timedOut = false;
  const watchdog = new Promise((resolve) => setTimeout(() => { timedOut = true; resolve(null); }, watchdogMs));
  try {
    const done = await Promise.race([
      recordNow({ htmlPath, outGif, tmpDir, width, fps, seconds, stages }).then(() => 'ok'),
      watchdog,
    ]);
    if (done !== 'ok') {
      return { skipped: true, reason: `录制超时（>${Math.round(watchdogMs / 1000)}s，停在 ${stages.join('→') || '启动前'}）` };
    }
    if (!fs.existsSync(outGif)) return { skipped: true, reason: `转码未产出（停在 ${stages.join('→')}）` };
    return { skipped: false };
  } catch (e) {
    try { fs.rmSync(outGif, { force: true }); } catch { /* 半成品清理尽力而为 */ }
    return { skipped: true, reason: `录制/转码失败（${stages.join('→') || '启动前'}）: ${e.message.split('\n')[0]}` };
  } finally {
    clearTimeout(watchdog);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

module.exports = { recordArmGif };
