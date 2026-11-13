// 移动端适配验证脚本：CDP 驱动本机 Chrome（无网络，字体/GitHub 数据确定性降级）
// 用法：node verify-layout.mjs <chrome可执行文件路径> <after页面file://URL> <before页面file:://URL> <输出目录>
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [chrome, afterUrl, beforeUrl, outDir] = process.argv.slice(2);
const RUN = '/Users/djhhh/work_area/Ddo-Code-Flow-fix-docs-html-mobile-adaptation/.ddo/runs/fix/20261113-190028-dd1a/inputs/tmp-chrome-profile';
const port = 9333;

const proc = spawn(chrome, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${RUN}`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
  '--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1, MAP fonts.gstatic.com 127.0.0.1, MAP api.github.com 127.0.0.1',
  'about:blank',
], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2500));

const ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
const ws = new WebSocket(ver.webSocketDebuggerUrl);
let seq = 0; const pending = new Map(); const events = [];
const call = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const id = ++seq; pending.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  else events.push(m);
};
await new Promise(r => { ws.onopen = r; });

const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => call(m, p, sessionId);
await S('Page.enable'); await S('Runtime.enable');

const EV = (name, ms) => new Promise(res => {
  const t = setTimeout(res, ms);
  const check = () => { if (events.some(e => e.method === name && e.sessionId === sessionId)) { clearTimeout(t); events.length = 0; res(); } else setTimeout(check, 80); };
  check();
});

async function shot(pageUrl, width, height, tag) {
  await S('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: width <= 900 });
  await S('Page.navigate', { url: pageUrl });
  await EV('Page.loadEventFired', 15000);
  await new Promise(r => setTimeout(r, 2500)); // 等 JS 绘制/自动播放稳定
  const expr = `(() => {
    const doc = document.documentElement;
    const secs = [...document.querySelectorAll('.section')].map(s => ({ id: s.id, sw: s.scrollWidth, cw: s.clientWidth }));
    const g = (sel, prop) => { const el = document.querySelector(sel); return el ? getComputedStyle(el)[prop] : null; };
    const board = document.querySelector('.board');
    const inner = document.querySelector('.board-inner');
    return {
      vw: window.innerWidth,
      docOverflow: doc.scrollWidth > doc.clientWidth,
      docSW: doc.scrollWidth, docCW: doc.clientWidth,
      sectionOverflow: secs.filter(s => s.sw > s.cw + 1),
      sections: secs,
      board: board ? { sw: board.scrollWidth, cw: board.clientWidth, innerW: inner ? inner.offsetWidth : null } : null,
      wiresDisplay: g('.board-wires', 'display'),
      hintDisplay: g('.board-hint', 'display'),
      gateOrder: (() => { const ids = ['n-gate','n-next','n-finish']; const st = getComputedStyle(document.getElementById('n-gate')); return st.order; })(),
    };
  })()`;
  const { result } = await S('Runtime.evaluate', { expression: expr, returnByValue: true });
  const img = await S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  const file = resolve(outDir, `shot-${tag}-w${width}.png`);
  writeFileSync(file, Buffer.from(img.data, 'base64'));
  return { file, ...result.value };
}

const after = resolve(afterUrl.replace(/^file:\/\//, '')), before = resolve(beforeUrl.replace(/^file:\/\//, ''));
const results = {};
results.after = {};
for (const w of [320, 360, 375, 390]) results.after[w] = await shot('file://' + after, w, 700, 'after');
results.after[768] = await shot('file://' + after, 768, 1000, 'after');
for (const w of [1024, 1440]) { results.after[w] = await shot('file://' + after, w, 900, 'after'); results['before' + w] = await shot('file://' + before, w, 900, 'before'); }
writeFileSync(resolve(outDir, 'verify-result.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
proc.kill(9); try { ws.close(); } catch {}
process.exit(0);
