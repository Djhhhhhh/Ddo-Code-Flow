'use strict';
/**
 * previewView.js —— 预览渲染器（纯函数，无脚本侧）：
 *  - renderMarkdown：md 基础格式渲染（标题/列表/代码块/引用/表格/分隔线/行内样式）+ 目录导航；
 *  - renderJsonTree：JSON 折叠树（嵌套 details，深层默认收起，标量按类型着色）；
 *  - buildTree：E 区文件清单 → 嵌套目录树（供 <details> 目录 + radio-hack 页签使用）。
 * 契约：coding:02 修订 15——全部输出为静态 HTML/CSS，不引入脚本。
 */

const { escapeHtml } = require('./stateView');
const esc = escapeHtml;

/* ---------------------------------------------------------------- Markdown */

/** 行内样式：`code` **bold** *italic* [t](u)（先整体转义，再按模式还原标签）。 */
function inlineMd(raw) {
  let s = esc(raw);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  s = s.replace(/\*([^*]+)\*/g, '<i>$1</i>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<span class="lnk" title="$2">$1</span>');
  return s;
}

/** md → { html, toc }；toc=[{level,text,id}]；标题 id = `${idPrefix}h-N`（多文件防锚点串线）。 */
function renderMarkdown(text, idPrefix) {
  const pfx = idPrefix ? String(idPrefix) : '';
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  const toc = [];
  let i = 0;
  let hid = 0;
  const flushPara = (buf) => {
    if (buf.length) out.push(`<p>${buf.map(inlineMd).join('<br>')}</p>`);
    return [];
  };
  let para = [];
  while (i < lines.length) {
    const line = lines[i];
    // 代码围栏
    if (/^```/.test(line)) {
      para = flushPara(para);
      const lang = line.slice(3).trim();
      const buf = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i += 1; }
      i += 1;
      // flowchart TD / mermaid 围栏 → 图形渲染（失败降级代码块）
      // 指令行可能在语言标记（```flowchart TD）或内容首行（```mermaid 下），统一重组
      if (/^(flowchart|mermaid|graph)/i.test(lang) || /^(flowchart|graph)\s+\w+/i.test(buf[0] || '')) {
        const fcSrc = /^(flowchart|graph)\s+\w+/i.test(lang)
          ? `${lang}\n${buf.join('\n')}`
          : buf.join('\n');
        const svg = renderFlowchart(fcSrc, `${pfx}m${out.length}-`);
        if (svg !== null) { out.push(`<div class="mdiagram">${svg}</div>`); continue; }
      }
      out.push(`<pre class="code">${esc(buf.join('\n'))}</pre>`);
      continue;
    }
    // 标题
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      para = flushPara(para);
      const level = h[1].length;
      const text = h[2].trim();
      const id = `${pfx}h-${hid++}`;
      toc.push({ level, text, id });
      out.push(`<h${level} id="${id}">${inlineMd(text)}</h${level}>`);
      i += 1;
      continue;
    }
    // 分隔线
    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) {
      para = flushPara(para);
      out.push('<hr>');
      i += 1;
      continue;
    }
    // 表格：当前行含 | 且下一行是 |---| 分隔
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      para = flushPara(para);
      const cells = (l) => l.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(cells(lines[i]));
        i += 1;
      }
      out.push(`<table class="mdt"><tr>${head.map((c) => `<th>${inlineMd(c)}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${inlineMd(c)}</td>`).join('')}</tr>`).join('')}</table>`);
      continue;
    }
    // 引用块
    if (/^\s*>\s?/.test(line)) {
      para = flushPara(para);
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i += 1; }
      out.push(`<blockquote>${buf.map(inlineMd).join('<br>')}</blockquote>`);
      continue;
    }
    // 无序/有序列表（按缩进支持一层嵌套）
    const isUl = (l) => /^(\s*)[-*•]\s+(.*)$/.exec(l);
    const isOl = (l) => /^(\s*)\d+[.、)]\s+(.*)$/.exec(l);
    const mu = isUl(line); const mo = isOl(line);
    if (mu || mo) {
      para = flushPara(para);
      const tag = mu ? 'ul' : 'ol';
      const items = [];
      while (i < lines.length) {
        const m = isUl(lines[i]) || isOl(lines[i]);
        if (!m) {
          // 续行：浅缩进（1–3 空格）并入上一项；深缩进（≥4，疑似代码）终止列表
          if (/^ {1,3}\S/.test(lines[i]) && items.length) {
            items[items.length - 1].text += ` ${lines[i].trim()}`;
            i += 1;
            continue;
          }
          break;
        }
        items.push({ indent: m[1].length, text: m[2] });
        i += 1;
      }
      const top = items.filter((it) => it.indent < 2);
      let html = '';
      let idx = 0;
      for (const it of top) {
        const kids = [];
        let j = items.indexOf(it) + 1;
        while (j < items.length && items[j].indent >= 2) { kids.push(items[j]); j += 1; }
        html += `<li>${inlineMd(it.text)}${kids.length ? `<ul>${kids.map((k) => `<li>${inlineMd(k.text)}</li>`).join('')}</ul>` : ''}</li>`;
        idx += 1;
      }
      out.push(`<${tag}>${html}</${tag}>`);
      continue;
    }
    // 空行 = 段落切分
    if (!line.trim()) {
      para = flushPara(para);
      i += 1;
      continue;
    }
    para.push(line);
    i += 1;
  }
  flushPara(para);
  return { html: out.join('\n'), toc };
}

/* ------------------------------------------------------- Flowchart(Mermaid 子集) */

const SHAPE_RE = /^(\w+)(?:\[([^\]]*)\]|\(([^)]*)\)|\{([^}]*)\}|\(\[([^\]]*)\]\))?\s*$/;

/** 文本显示宽估算（CJK≈2 单位）。 */
function textW(s) {
  let u = 0;
  for (const ch of String(s)) u += ch.charCodeAt(0) > 0x2e7f ? 2 : 1;
  return u;
}

/** 从 from 侧剥离开放标签（`-- 标签` / `-. 标签` / `== 标签`），返回 [from, label]。 */
function stripOpenLabel(from) {
  const m = /(?:-{2,3}|-\.|={2})\s+([^\]|]+?)\s*$/.exec(from);
  if (m && m.index > 0) return [from.slice(0, m.index).trim(), m[1].trim()];
  return [from.trim(), ''];
}

/** 节点 token 提取（行首）：id[形] → 返回 [token, 余串]。 */
const NODE_TOK = /^(\w+(?:\[[^\]]*\]|\([^)]*\)|\{[^}]*\}|\(\[[^\]]*\]\))?)/;

/**
 * 边行解析（支持链式 A --> B --> C 与开放标签 `-- 标签 -->`）。
 * 返回 { ok, list:[{from,to,label,type}] }；ok=false 整体降级。
 */
function parseEdgeLine(line, addNode) {
  const list = [];
  let rest = String(line).trim();
  let prevTo = null; // 链式续段继承：A --> B --> C 的第二段左侧为空
  const guard = 32;
  for (let k = 0; k < guard && rest; k += 1) {
    // 行首管道标签（罕见前置形态）
    const pm = /^\|([^|]*)\|\s*/.exec(rest);
    let pipeLabel = '';
    if (pm) { pipeLabel = pm[1].trim(); rest = rest.slice(pm[0].length); }
    // 锚定真箭头（--/-. 等单独的破折号不构成箭头，标签内部破折号天然被跳过）
    const am = /^(.*?)(-\.->|={2,}>|-{2,3}>)\s*(.*)$/s.exec(rest);
    if (!am) {
      const nm = NODE_TOK.exec(rest);
      if (!nm) return { ok: false };
      const a2 = addNode(nm[1]);
      if (a2 === null) return { ok: false };
      rest = rest.slice(nm[0].length).trim();
      if (rest) return { ok: false }; // 节点后还有无法识别的内容
      break;
    }
    // 箭头右侧管道标签：A -->|标签| B
    let right = am[3].trim();
    const rpm = /^\|([^|]*)\|\s*/.exec(right);
    if (rpm) { pipeLabel = pipeLabel || rpm[1].trim(); right = right.slice(rpm[0].length); }
    let from; let lbl;
    [from, lbl] = stripOpenLabel(am[1]);
    const arrow = am[2];
    const type = arrow.startsWith('-.') ? 'dotted' : arrow.startsWith('=') ? 'bold' : 'solid';
    let fa;
    if (!from && prevTo) fa = prevTo; // 链式续段：省略左侧
    else fa = addNode(from);
    if (fa === null || fa === undefined) return { ok: false };
    // to 侧：先取行首节点 token；其后若紧跟箭头则链式继续
    const tm = NODE_TOK.exec(right);
    if (!tm) return { ok: false };
    const tb = addNode(tm[1]);
    if (tb === null) return { ok: false };
    list.push({ from: fa, to: tb, label: pipeLabel || lbl, type });
    prevTo = tb;
    rest = right.slice(tm[0].length).trim();
  }
  return { ok: true, list };
}

/**
 * flowchart 源 → SVG（Mermaid 子集：flowchart/graph TD|TB|LR + 矩形/圆角/菱形/胶囊
 * + -->/-.->/==> 边 + |标签| 与 `-- 标签 -->` 开放标签 + 链式边）。解析失败返回 null。
 */
function renderFlowchart(src, prefix) {
  const lines = String(src).replace(/\r\n?/g, '\n').split('\n')
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('%%'));
  if (!lines.length) return null;
  const head = /^(?:flowchart|graph)\s+(TD|TB|LR|BT|RL)$/i.exec(lines[0]);
  if (!head) return null;
  const order = [];
  const nodes = new Map();
  const edges = [];
  const addNode = (tok) => {
    const m = SHAPE_RE.exec(String(tok).trim());
    if (!m) return null;
    const id = m[1];
    const label = m[2] ?? m[3] ?? m[4] ?? m[5] ?? id;
    const shape = m[5] !== undefined ? 'stadium' : m[4] !== undefined ? 'diamond' : m[3] !== undefined ? 'round' : 'rect';
    if (!nodes.has(id)) {
      nodes.set(id, { id, label, shape });
      order.push(id);
    } else if (label !== id) {
      nodes.get(id).label = label;
      nodes.get(id).shape = shape;
    }
    return id;
  };
  for (let li = 1; li < lines.length; li += 1) {
    const line = lines[li].replace(/^\s*(?:flowchart|graph)\s+\w+\s*/i, '');
    const parsed = parseEdgeLine(line, addNode);
    if (!parsed.ok) return null;
    edges.push(...parsed.list);
  }
  if (!nodes.size) return null;
  // 分层：入度松弛（Kahn），环回退首现顺序
  const layer = new Map(order.map((id) => [id, 0]));
  const indeg = new Map(order.map((id) => [id, 0]));
  edges.forEach((e) => indeg.set(e.to, (indeg.get(e.to) || 0) + 1));
  const queue = order.filter((id) => !indeg.get(id));
  if (!queue.length) queue.push(order[0]);
  const seen = new Set();
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    edges.filter((e) => e.from === id).forEach((e) => {
      layer.set(e.to, Math.max(layer.get(e.to) || 0, (layer.get(id) || 0) + 1));
      queue.push(e.to);
    });
  }
  // 布局
  const byLayer = new Map();
  order.forEach((id) => {
    const l = Math.min(layer.get(id) ?? 0, order.length);
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l).push(id);
  });
  const GAPX = 36; const GAPY = 56; const PAD = 24;
  const size = (nd) => {
    const t = textW(nd.label) * 6.6 + 34;
    return { w: Math.max(78, nd.shape === 'diamond' ? t + 34 : t), h: nd.shape === 'diamond' ? 52 : 38 };
  };
  const pos = new Map();
  const layerKeys = [...byLayer.keys()].sort((x, y) => x - y);
  let crossMax = 0;
  layerKeys.forEach((l) => { crossMax = Math.max(crossMax, byLayer.get(l).length); });
  const colW = Math.max(...order.map((id) => size(nodes.get(id)).w)) + GAPX;
  layerKeys.forEach((l) => {
    const row = byLayer.get(l);
    const totalW = row.length * colW - GAPX;
    row.forEach((id, i) => {
      const { w, h } = size(nodes.get(id));
      const cx = (crossMax * colW - GAPX - totalW) / 2 + i * colW + colW / 2 - GAPX / 2;
      pos.set(id, { x: cx - w / 2, y: 0, w, h, cx, cy: 0 });
    });
  });
  let accY = PAD;
  layerKeys.forEach((l) => {
    let hMax = 0;
    byLayer.get(l).forEach((id) => {
      const p = pos.get(id);
      p.y = accY;
      p.cy = accY + p.h / 2;
      hMax = Math.max(hMax, p.h);
    });
    accY += hMax + GAPY;
  });
  const W = crossMax * colW - GAPX + PAD * 2;
  const H = accY - GAPY + PAD;
  const mid = (id) => pos.get(id);
  // 绘制
  const pfx = prefix || 'm';
  const parts = [`<defs><marker id="${pfx}arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--ink-3)"/></marker></defs>`];
  edges.forEach((e) => {
    const a = mid(e.from); const b = mid(e.to);
    const style = e.type === 'dotted' ? 'stroke-dasharray="3 4"' : e.type === 'bold' ? 'stroke-width="3"' : e.type === 'plain' ? '' : '';
    const sw = e.type === 'bold' ? 3 : 1.8;
    const x1 = a.x + a.w; const y1 = a.cy;
    const x2 = b.x; const y2 = b.cy;
    const mx = (x1 + x2) / 2;
    parts.push(`<path d="M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}" fill="none" stroke="var(--line)" stroke-width="${sw}" ${style} marker-end="url(#${pfx}arrow)"/>`);
    if (e.label) {
      parts.push(`<rect x="${mx - textW(e.label) * 3.3 - 5}" y="${(y1 + y2) / 2 - 9}" width="${textW(e.label) * 6.6 + 10}" height="18" rx="9" fill="var(--code-bg)" stroke="var(--line-soft)"/>`);
      parts.push(`<text x="${mx}" y="${(y1 + y2) / 2 + 4}" text-anchor="middle" font-size="10.5" fill="var(--ink-2)">${esc(e.label)}</text>`);
    }
  });
  order.forEach((id) => {
    const nd = nodes.get(id); const p = pos.get(id);
    const t = `<text x="${p.cx}" y="${p.cy + 4}" text-anchor="middle" font-size="11.5" fill="var(--ink)">${esc(nd.label)}</text>`;
    if (nd.shape === 'diamond') {
      parts.push(`<path d="M${p.cx} ${p.y} L${p.x + p.w} ${p.cy} L${p.cx} ${p.y + p.h} L${p.x} ${p.cy} Z" fill="var(--panel-2)" stroke="var(--cyan-dim)" stroke-width="1.5"/>${t}`);
    } else if (nd.shape === 'stadium') {
      parts.push(`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.h / 2}" fill="var(--panel-2)" stroke="var(--cyan)" stroke-width="1.5"/>${t}`);
    } else if (nd.shape === 'round') {
      parts.push(`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="9" fill="var(--panel-2)" stroke="var(--cyan-dim)" stroke-width="1.5"/>${t}`);
    } else {
      parts.push(`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="4" fill="var(--panel-2)" stroke="var(--line)" stroke-width="1.5"/>${t}`);
    }
  });
  return `<svg class="mermaid" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" role="img" aria-label="flowchart">${parts.join('')}</svg>`;
}



/** JSON 值 → 折叠树 HTML（嵌套 details；depth≥2 默认收起）。 */
function jsonNode(value, key, depth) {
  const k = key !== undefined ? `<span class="jk">"${esc(String(key))}"</span><span class="jp">: </span>` : '';
  if (value === null) return `<div class="jrow">${k}<span class="j-null">null</span></div>`;
  if (typeof value === 'string') return `<div class="jrow">${k}<span class="j-str">"${esc(value)}"</span></div>`;
  if (typeof value === 'number') return `<div class="jrow">${k}<span class="j-num">${value}</span></div>`;
  if (typeof value === 'boolean') return `<div class="jrow">${k}<span class="j-bool">${value}</span></div>`;
  const isArr = Array.isArray(value);
  const entries = isArr ? value.map((v, i2) => [i2, v]) : Object.entries(value);
  const open = depth < 2 ? ' open' : '';
  const brace = isArr ? '[' : '{';
  const kids = entries.map(([kk, v]) => jsonNode(v, kk, depth + 1)).join('');
  return `<details class="j"${open}><summary>${k}<span class="jp">${brace}${entries.length}${isArr ? ']' : '}'}</span></summary><div class="jkids">${kids}</div></details>`;
}

/** JSON 文本 → 折叠树；解析失败返回 null（降级纯文本）。 */
function renderJsonTree(text) {
  try {
    const data = JSON.parse(text);
    return jsonNode(data, undefined, 0);
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------- 树 */

/** 文件清单 → 嵌套目录树 {dirs:Map, files:[]}（按 rel 路径段切分，避免绝对路径拆树）。 */
function buildTree(files) {
  const root = { name: '', dirs: new Map(), files: [] };
  for (const f of files) {
    const segs = String(f.rel || f.path || '').replace(/\\/g, '/').split('/').filter(Boolean);
    let node = root;
    for (let i = 0; i < segs.length - 1; i += 1) {
      const seg = segs[i];
      if (!node.dirs.has(seg)) node.dirs.set(seg, { name: seg, dirs: new Map(), files: [] });
      node = node.dirs.get(seg);
    }
    node.files.push(f);
  }
  return root;
}

module.exports = { renderMarkdown, renderJsonTree, renderFlowchart, buildTree, inlineMd };
