// 像素对比 v2：PNG 以 base64 注入 about:blank 页，页内 createImageBitmap + canvas 逐像素比较
// 噪声基线 = 同一改前文件两次加载之差（fx 随机装饰层必然产生少量差异像素）
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const DIR = '/Users/djhhh/work_area/Ddo-Code-Flow-fix-docs-html-mobile-adaptation/.ddo/runs/fix/20261113-190028-dd1a/inputs';
const SCR = DIR + '/screens';
const proc = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--remote-debugging-port=9336', '--user-data-dir=' + DIR + '/tmp-chrome-profile4',
  '--no-first-run', 'about:blank',
], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 3000));
const pages = await (await fetch('http://127.0.0.1:9336/json/list')).json();
const page = pages.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let seq = 0; const p = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); } };
await new Promise(r => { ws.onopen = r; });
const S = (method, params = {}) => new Promise(res => { const id = ++seq; p.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
await S('Runtime.enable');

const CMP = async (a, b) => {
  const dec = s => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  const load = async s => { const bmp = await createImageBitmap(new Blob([dec(s)])); const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; c.getContext('2d').drawImage(bmp, 0, 0); return c.getContext('2d').getImageData(0, 0, bmp.width, bmp.height); };
  const A = await load(a), B = await load(b);
  if (A.width !== B.width || A.height !== B.height) return { sizeMismatch: [A.width + 'x' + A.height, B.width + 'x' + B.height] };
  let diff = 0, minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
  for (let y = 0; y < A.height; y++) for (let x = 0; x < A.width; x++) {
    const i = (y * A.width + x) * 4;
    if (Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]) > 24) {
      diff++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return { diffPixels: diff, total: A.width * A.height, ratioPct: +(diff / (A.width * A.height) * 100).toFixed(4), bbox: diff ? [minX, minY, maxX, maxY] : null };
};

const b64 = f => readFileSync(f).toString('base64');
const out = {};
for (const w of [1024, 1440]) {
  const before = b64(`${SCR}/shot-before-w${w}.png`), before2 = b64(`${SCR}/shot-before2-w${w}.png`), after = b64(`${SCR}/shot-after-w${w}.png`);
  for (const [tag, x, y] of [['noise', before, before2], ['delta', before, after]]) {
    const r = await S('Runtime.evaluate', { expression: `(${CMP})(${JSON.stringify(x)},${JSON.stringify(y)})`, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    out[`${tag}_w${w}`] = r.result.result.value;
  }
}
writeFileSync(SCR + '/pixel-compare.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
proc.kill(9); try { ws.close(); } catch {}
process.exit(0);
