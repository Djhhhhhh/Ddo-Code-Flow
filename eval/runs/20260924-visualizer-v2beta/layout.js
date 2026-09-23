'use strict';
// layout.js — 分层布局纯函数（plan.md「算法设计」的实现）。
// 输入 stages: [{id, dependOn: []}]（DAG）；输出坐标与折线 + 相交自检结果。
//
// 不变量：① 任一边 layer(to) = layer(from) + 1（跨层边经中间层虚拟节点接力，全部边
// 退化为相邻层走廊直线）；② 走廊内边按 source 层内序单调 ⇒ 无交叉（虚拟节点固定
// 层内最右，与真实边的序不发生倒置）；③ 全部线段两两无内部交点（自检断言）。
// 虚拟节点以小圆点渲染（右缘接力桩），不计入业务节点。若图本身非平面导致残留
// 交叉，如实计入 crossings（DEC-1-④ 诚实边界），不做无限重试。

const NODE_W = 160;
const NODE_H = 44;
const GAP_X = 48;
const GAP_Y = 92;

function layout(stages) {
  if (!Array.isArray(stages) || !stages.length) throw new Error('layout: stages 为空（无可布局节点）');
  const ids = stages.map((s) => s.id);
  if (new Set(ids).size !== ids.length) throw new Error('layout: stage id 重复');

  const preds = new Map(ids.map((id) => [id, []]));
  for (const s of stages) {
    for (const d of s.dependOn || []) {
      if (!preds.has(d)) throw new Error(`layout: dependOn 引用不存在的节点 ${d}`);
      preds.get(s.id).push(d);
    }
  }

  // ① 最长路径分层（带环检测）：layer(v) = 1 + max(layer(pred))，无前驱 = 1
  const layerOf = new Map();
  const visiting = new Set();
  function assign(id) {
    if (layerOf.has(id)) return layerOf.get(id);
    if (visiting.has(id)) throw new Error(`layout: stages 依赖存在环（涉及 ${id}）`);
    visiting.add(id);
    const ps = preds.get(id);
    const layer = ps.length ? 1 + Math.max(...ps.map(assign)) : 1;
    visiting.delete(id);
    layerOf.set(id, layer);
    return layer;
  }
  for (const id of ids) assign(id);

  const L = Math.max(...layerOf.values());
  const layers = Array.from({ length: L }, () => []);
  for (const id of ids) layers[layerOf.get(id) - 1].push(id);

  // ② 层内 barycenter 排序（下行/上行各 2 轮，稳定：均值缺失时保持现序）
  const succMap = new Map(ids.map((id) => [id, []]));
  for (const s of stages) for (const d of s.dependOn || []) succMap.get(d).push(s.id);
  const succsOf = (id) => succMap.get(id) || [];
  const meanIdx = (ns, order) => {
    const xs = ns.map((n) => order.indexOf(n)).filter((x) => x !== -1);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  for (let round = 0; round < 2; round++) {
    for (let k = 1; k < L; k++) {
      layers[k] = [...layers[k]].sort((a, b) => {
        const ma = meanIdx(preds.get(a).filter((p) => layerOf.get(p) === k), layers[k - 1]);
        const mb = meanIdx(preds.get(b).filter((p) => layerOf.get(p) === k), layers[k - 1]);
        return (ma ?? layers[k].indexOf(a) * 0.999) - (mb ?? layers[k].indexOf(b) * 0.999);
      });
    }
    for (let k = L - 2; k >= 0; k--) {
      layers[k] = [...layers[k]].sort((a, b) => {
        const sa = succsOf(a).filter((p) => layerOf.get(p) === k + 2);
        const sb = succsOf(b).filter((p) => layerOf.get(p) === k + 2);
        return (meanIdx(sa, layers[k + 1]) ?? layers[k].indexOf(a) * 0.999) - (meanIdx(sb, layers[k + 1]) ?? layers[k].indexOf(b) * 0.999);
      });
    }
  }

  // ③ 跨层边 → 虚拟节点链：中间层逐层右缘接力，全部边变为相邻层直线
  const virtual = new Set();
  const chainEdges = []; // 全部相邻层边（真实 + 经虚拟节点的接力段）
  let vCounter = 0;
  for (const s of stages) {
    for (const from of s.dependOn || []) {
      let cur = from;
      for (let l = layerOf.get(from) + 1; l < layerOf.get(s.id); l++) {
        const v = `__v${vCounter++}`;
        virtual.add(v);
        layers[l - 1].push(v); // 层内最右（barycenter 之后追加，天然固定右缘）
        chainEdges.push([cur, v]);
        cur = v;
      }
      chainEdges.push([cur, s.id]);
    }
  }

  // ④ 坐标：层内均分 x（各层相对最宽层居中），层间固定 y；虚拟节点占窄槽（圆点）
  const slotW = (id) => (virtual.has(id) ? 24 : NODE_W);
  const width = (layer) => layer.reduce((w, id) => w + slotW(id) + GAP_X, -GAP_X);
  const maxW = Math.max(...layers.map(width));
  const positions = new Map();
  layers.forEach((layer, k) => {
    let x = (maxW - width(layer)) / 2;
    for (const id of layer) {
      x += slotW(id) / 2;
      positions.set(id, { x, y: k * (NODE_H + GAP_Y) + NODE_H / 2, layer: k + 1 });
      x += slotW(id) / 2 + GAP_X;
    }
  });

  // ⑤ 边几何：相邻层直线（起点 = 源底边中点，终点 = 目标顶边中点；虚拟节点为圆点）
  const port = (id, bottom) => {
    const p = positions.get(id);
    return virtual.has(id)
      ? { x: p.x, y: p.y + (bottom ? 4 : -4) }
      : { x: p.x, y: p.y + (bottom ? NODE_H / 2 : -NODE_H / 2) };
  };
  const edges = chainEdges.map(([from, to]) => ({ from, to, polyline: [port(from, true), port(to, false)] }));

  // ⑥ 相交自检：全部线段两两判断（O(E²)）；共享端点的汇入/扇出不算，共线重叠算
  let crossings = 0;
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      if (properIntersection(edges[i].polyline, edges[j].polyline)) crossings++;
    }
  }

  return { positions, edges, crossings, layers, virtual, size: { w: maxW, h: L * (NODE_H + GAP_Y) } };
}

/** 两段折线（本实现均为单段直线）是否真交叉：内部交点或共线重叠；端点相接不算。 */
function properIntersection([p1, p2], [p3, p4]) {
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  if (d1 === 0 && d2 === 0 && d3 === 0 && d4 === 0) {
    const horizontal = p1.y === p2.y && p3.y === p4.y;
    if (!horizontal) return false;
    const lo1 = Math.min(p1.x, p2.x); const hi1 = Math.max(p1.x, p2.x);
    const lo2 = Math.min(p3.x, p4.x); const hi2 = Math.max(p3.x, p4.x);
    return Math.min(hi1, hi2) - Math.max(lo1, lo2) > 0.01;
  }
  return false;
}

const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

module.exports = { layout, NODE_W, NODE_H };
