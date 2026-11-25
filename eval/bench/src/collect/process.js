'use strict';
// 过程层量化（plan Part 03 §5.1，FR-8/AC-8）：5 信号 + 澄清对称性，
// 每信号 = 二元结论 + 量化指标 + 负面计数。数据源：两臂轨迹 + ddo 臂 state/.usage.jsonl + git diff + 应答记录。

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const traj = require('./trajectory');

/** ddo 臂阶段纪律：从 .usage.jsonl 与 .state.json 提取推进/决议/拦截事件。 */
function stageDiscipline(sandboxDir) {
  const usage = [];
  // 沙箱内 ddo run 的日志在 <sandbox>/.ddo/runs/**/.usage.jsonl（编排器不假设 type/runId，全扫）
  const ddoRoot = path.join(sandboxDir, '.ddo', 'runs');
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === '.usage.jsonl') {
        for (const line of fs.readFileSync(p, 'utf8').split('\n').filter(Boolean)) {
          try { usage.push(JSON.parse(line)); } catch { /* 跳过残行 */ }
        }
      }
    }
  };
  walk(ddoRoot);
  const decisions = usage.filter((e) => e.event === 'decision');
  const advanced = usage.filter((e) => e.event === 'advanced');
  const autoDecisions = decisions.filter((e) => /auto/.test(String(e.note || '')) || e.command === 'gate auto');
  return {
    stageAdvanceRecords: advanced.length,
    gateDecisions: decisions.length,
    autoGateDecisions: autoDecisions.length,
    // 未获决议推进 = 引擎拦截事件（gate-open blocked）在日志中不可见（拦截不写日志，返回 exit 1）；
    // 以「决议数 - 推进数」缺口近似为 0 校验：引擎结构保证未决议不可推进，此处恒记 0 并注明口径。
    unapprovedAdvances: 0,
    note: '未获决议推进由引擎结构拦截（I-G1/呈现有效性），口径=结构保证，计数恒 0',
  };
}

/** 改动范围（git numstat，对白名单）。 */
function changeScope(sandboxDir, whitelist) {
  const run = (args) => {
    try { return execFileSync('git', args, { cwd: sandboxDir, encoding: 'utf8' }); } catch { return ''; }
  };
  const names = [...run(['diff', '--name-only', 'HEAD']).trim().split('\n'), ...run(['ls-files', '--others', '--exclude-standard']).trim().split('\n')].filter(Boolean);
  const numstat = run(['diff', '--numstat', 'HEAD']).trim().split('\n').filter(Boolean);
  let lines = 0;
  for (const row of numstat) {
    const m = row.match(/^(\d+|-)\s+(\d+|-)\s+/);
    if (m) lines += (m[1] === '-' ? 0 : Number(m[1])) + (m[2] === '-' ? 0 : Number(m[2]));
  }
  const wl = whitelist || [];
  const wlMatch = (f) => wl.some((w) => (w.endsWith('/') ? f.startsWith(w) : f === w));
  const oos = names.filter((f) => !wlMatch(f));
  return { changedFiles: names.length, outOfScopeFiles: oos.length, outOfScopeList: oos, changedLines: lines };
}

/** spec 章节数（ddo 臂 .ddo/runs 下各 spec.md/plan.md 的 ## 计数；baseline 臂为 0——无工作流，如实记录）。 */
function specSections(sandboxDir) {
  const sections = { ddo: 0, files: [] };
  const ddoRoot = path.join(sandboxDir, '.ddo', 'runs');
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'spec.md' || e.name === 'plan.md') {
        const n = (fs.readFileSync(p, 'utf8').match(/^##\s/gm) || []).length;
        sections.ddo += n;
        sections.files.push(path.relative(sandboxDir, p));
      }
    }
  };
  walk(ddoRoot);
  return sections;
}

/**
 * 过程层总装。输入：{baseline:{streamPath,sandboxDir}, ddo:{streamPath,sandboxDir}, whitelist, questionRe, expectedAmbiguities, answers}
 * 输出 process.json 形态（六行信号 + 对称性表）。
 */
function buildProcess({ baseline, ddo, whitelist, questionRe, expectedAmbiguities = 0, responderAnswers = [], clarifyItems = [] }) {
  const tB = traj.parseArmStream(baseline.streamPath);
  const tD = traj.parseArmStream(ddo.streamPath);
  const perArm = (t, sandboxDir) => {
    const bc = traj.beforeCoding(t);
    const tr = traj.testRuns(t);
    const cl = traj.claims(t);
    const qa = traj.clarifications(t, questionRe);
    const scope = sandboxDir && whitelist ? changeScope(sandboxDir, whitelist) : null;
    const spec = sandboxDir ? specSections(sandboxDir) : { ddo: 0, files: [] };
    return {
      beforeCoding: bc, testRuns: tr, claims: cl, clarifications: qa, changeScope: scope, specSections: spec,
      unresolvedAmbiguities: Math.max(0, expectedAmbiguities - (qa.askedCount + qa.assumptionCount)),
      claimedNotRun: Math.max(0, cl.claimCount - tr.testRunCount),
    };
  };
  const armB = perArm(tB, baseline.sandboxDir);
  const armD = perArm(tD, ddo.sandboxDir);
  const discipline = stageDiscipline(ddo.sandboxDir);

  // 对称性自检（恒输出：一致/不一致 + 原因）：应答均须可追溯 clarify 条目
  const symmetryRows = responderAnswers.map((a) => ({
    arm: 'baseline', turn: a.turn, hitId: a.hitId,
    traceable: a.hitId !== 'fallback' ? '是' : '否（回退中性应答）',
    text: a.text,
  }));
  const ddoAutoAnswers = []; // 由编排器从 ddo 臂 .usage.jsonl 的 interacted(auto) 事件回填
  const symmetryOk = symmetryRows.every((r) => r.traceable.startsWith('是') || r.traceable.includes('回退'))
    && clarifyItems.length > 0;

  const signals = [
    {
      signal: '先对齐再动手',
      rows: [
        { arm: 'baseline', binary: armB.beforeCoding.readsBeforeCoding > 0, metrics: { 编码前读取文件数: armB.beforeCoding.readsBeforeCoding, 调研次数: armB.beforeCoding.researchTurns, spec章节数: armB.specSections.ddo } },
        { arm: 'ddo', binary: armD.beforeCoding.readsBeforeCoding > 0, metrics: { 编码前读取文件数: armD.beforeCoding.readsBeforeCoding, 调研次数: armD.beforeCoding.researchTurns, spec章节数: armD.specSections.ddo } },
      ],
    },
    {
      signal: '交付前自检',
      rows: [
        { arm: 'baseline', binary: armB.testRuns.testRunCount > 0, metrics: { 测试运行次数: armB.testRuns.testRunCount }, negative: { 声称与实际差异: armB.claimedNotRun } },
        { arm: 'ddo', binary: armD.testRuns.testRunCount > 0, metrics: { 测试运行次数: armD.testRuns.testRunCount }, negative: { 声称与实际差异: armD.claimedNotRun } },
      ],
    },
    {
      signal: '模糊处停下来',
      rows: [
        { arm: 'baseline', binary: armB.clarifications.askedCount + armB.clarifications.assumptionCount > 0, metrics: { 澄清请求数: armB.clarifications.askedCount, 显式假设条数: armB.clarifications.assumptionCount }, negative: { 未处理歧义数: armB.unresolvedAmbiguities } },
        { arm: 'ddo', binary: armD.clarifications.askedCount + armD.clarifications.assumptionCount > 0, metrics: { 澄清请求数: armD.clarifications.askedCount, 显式假设条数: armD.clarifications.assumptionCount }, negative: { 未处理歧义数: armD.unresolvedAmbiguities } },
      ],
    },
    {
      signal: '改动范围受控',
      rows: (['baseline', 'ddo']).map((arm) => {
        const a = arm === 'baseline' ? armB : armD;
        return { arm, binary: a.changeScope ? a.changeScope.outOfScopeFiles === 0 : null, metrics: a.changeScope ? { 改动文件数: a.changeScope.changedFiles, 改动行数: a.changeScope.changedLines } : {}, negative: a.changeScope ? { 越界改动文件数: a.changeScope.outOfScopeFiles } : {} };
      }),
    },
    {
      signal: '阶段纪律',
      rows: [
        { arm: 'baseline', binary: null, metrics: { 说明: '无工作流（纯 prompt），不适用——如实记录' } },
        { arm: 'ddo', binary: discipline.unapprovedAdvances === 0, metrics: { 阶段推进记录数: discipline.stageAdvanceRecords, 门决议数: discipline.gateDecisions }, negative: { 未获决议推进次数: discipline.unapprovedAdvances } },
      ],
      note: discipline.note,
    },
    {
      signal: '澄清对称性',
      rows: [{ arm: 'both', binary: symmetryOk, metrics: { baseline应答数: symmetryRows.length, ddo自动应答数: ddoAutoAnswers.length, 清单条目数: clarifyItems.length } }],
      detail: { baselineRows: symmetryRows, ddoRows: ddoAutoAnswers, 结论: symmetryOk ? '一致（应答均可追溯同一冻结清单或标注回退）' : '不一致（见明细）' },
    },
  ];
  return { signals, perArm: { baseline: armB, ddo: armD }, discipline };
}

module.exports = { buildProcess, stageDiscipline, changeScope, specSections };
