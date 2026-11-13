// 关键区域裁剪截图：375 宽下 #hero/#how/#sop，320 宽下 #how（最紧场景）
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const DIR = '/Users/djhhh/work_area/Ddo-Code-Flow-fix-docs-html-mobile-adaptation/.ddo/runs/fix/20261113-190028-dd1a/inputs';
const SCR = DIR + '/screens';
const PAGE = 'file:///Users/djhhh/work_area/Ddo-Code-Flow-fix-docs-html-mobile-adaptation/docs/index.html';
const proc = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--remote-debugging-port=9338', '--user-data-dir=' + DIR + '/tmp-chrome-profile6',
  '--no-first-run', '--hide-scrollbars',
  '--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1, MAP fonts.gstatic.com 127.0.0.1, MAP api.github.com 127.0.0.1',
  'about:blank',
], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 3000));
const pages = await (await fetch('http://127.0.0.1:9338/json/list')).json();
const ws = new WebSocket(pages.find(t => t.type === 'page').webSocketDebuggerUrl);
let seq = 0; const p = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); } };
await new Promise(r => { ws.onopen = r; });
const S = (method, params = {}) => new Promise(res => { const id = ++seq; p.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
await S('Page.enable'); await S('Runtime.enable');
const ev = name => new Promise(res => {
  const h = e => { const m = JSON.parse(e.data); if (m.method === name) { ws.removeEventListener('message', h); res(m); } };
  ws.addEventListener('message', h);
});

async function shotSection(sel, width, tag, maxH) {
  await S('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 2, mobile: true });
  await S('Page.navigate', { url: PAGE });
  await ev('Page.loadEventFired');
  await new Promise(r => setTimeout(r, 2500));
  const { result } = await S('Runtime.evaluate', { expression: `(() => { const el = document.querySelector('${sel}'); const r = el.getBoundingClientRect(); const top = r.top + window.scrollY; return { top: Math.round(top), h: Math.round(Math.min(r.height, ${maxH})), vw: window.innerWidth }; })()`, returnByValue: true });
  const { top, h } = result.result.value;
  const img = await S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: top, width, height: h, scale: 1 } });
  if (!img.result || !img.result.data) throw new Error('shot failed: ' + JSON.stringify(img).slice(0, 200));
  writeFileSync(`${SCR}/sec-${tag}-w${width}.png`, Buffer.from(img.result.data, 'base64'));
  console.log('saved', tag, width, top, h);
}

await shotSection('#hero', 375, 'hero', 1500);
await shotSection('#how', 375, 'how', 2600);
await shotSection('#sop', 375, 'sop', 1500);
await shotSection('#how', 320, 'how', 2600);
proc.kill(9); try { ws.close(); } catch {}
process.exit(0);
