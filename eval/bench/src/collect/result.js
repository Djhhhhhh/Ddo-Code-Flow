'use strict';
// 结果层归一化（plan Part 03 §4，FR-7/AC-7）：执行题包 acceptance/verify.js（隐藏验收，
// 编排器调用、沙箱为参）+ 页面题探针产物 → result.json（两臂对照 + Δ）。

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

/** 跑题包隐藏验收（代码题）。返回 verify JSON 或 { error }。 */
function runAcceptance({ packDir, sandboxDir }) {
  const verify = path.join(packDir, 'acceptance', 'verify.js');
  if (!fs.existsSync(verify)) return { notApplicable: true, reason: '题包无 acceptance/verify.js' };
  try {
    const stdout = execFileSync(process.execPath, [verify, sandboxDir, packDir], { encoding: 'utf8', timeout: 120000 });
    return JSON.parse(stdout);
  } catch (e) {
    return { error: String((e && e.message) || e), stdout: String(e.stdout || '').slice(0, 400) };
  }
}

/** 页面题：读取探针产物 probe.json（编排器已跑探针）。 */
function readProbe(reportDir) {
  const p = path.join(reportDir, 'probe.json');
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { error: 'probe.json 缺失（探针未跑或失败）' };
}

/** 结果层总装：两臂对照 + 按题 Δ（不做加权总分）。 */
function buildResult({ kind, baselineOut, ddoOut }) {
  const pick = (o) => {
    if (!o || o.error || o.notApplicable) return { ok: false, raw: o };
    if (kind === 'page') {
      return { ok: true, pass: o.pass, total: o.total, rate: `${o.pass}/${o.total}`, fps: o.reference && o.reference.fps };
    }
    return {
      ok: true,
      acceptance: `${o.acceptance.pass}/${o.acceptance.total}`,
      acceptancePass: o.acceptance.pass, acceptanceTotal: o.acceptance.total,
      regression: `${o.regression.pass}/${o.regression.total}`,
      regressionBroken: o.regression.broken,
      outOfScopeFiles: o.changeScope ? o.changeScope.outOfScopeFiles : undefined,
      changedFiles: o.changeScope ? o.changeScope.changedFiles : undefined,
    };
  };
  const b = pick(baselineOut);
  const d = pick(ddoOut);
  return {
    kind,
    baseline: b, ddo: d,
    delta: {
      结果层: b.ok && d.ok ? (kind === 'page' ? `${b.pass}/${b.total} → ${d.pass}/${d.total}` : `${b.acceptance} → ${d.acceptance}；回归 ${b.regression} → ${d.regression}`) : '不可比（存在失败臂）',
      note: '结果层不做加权总分；Δ 按题按指标呈现',
    },
    raw: { baseline: baselineOut, ddo: ddoOut },
  };
}

module.exports = { runAcceptance, readProbe, buildResult };
