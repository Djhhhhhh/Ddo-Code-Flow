#!/usr/bin/env node
'use strict';
// model-quick-eval 编排器入口（plan Part 02 §1/§6，FR-1/AC-1）。
// 用法：
//   node eval/bench/cli.js run [--model <名>] --tasks <q…> --baseline-sid <s> --ddo-sid <s>   # --model 缺省 = 本地 claude 已配置模型
//        [--profile <f>] [--ccswitch-db <p>] [--arm-timeout <min>] [--dry-run] [--keep-sandboxes]
//   node eval/bench/cli.js clean --run <轮次Id>
// 输出对齐引擎四通道惯例：stdout JSON / stderr 人话 / exit 0·1·2。

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { assembleProfile, ProfileError } = require('./src/profile');
const sandboxLib = require('./src/sandbox');
const policyLib = require('./src/policy');
const driver = require('./src/driver');
const collectResult = require('./src/collect/result');
const collectProcess = require('./src/collect/process');
const collectToken = require('./src/collect/token');
const { renderCard, renderSummary, renderHtmlForm, exportPng, fmtK } = require('./src/report/render');

const BENCH_ROOT = __dirname;
const REPO_ROOT = path.join(BENCH_ROOT, '..', '..');
// 运行产物统一隔离在仓库 .ddo/eval/ 下（不落 eval/bench/ 源码树）：
//   .ddo/eval/runs/<roundId>/    沙箱、事件流、指标与每题报告（工作区，可 clean）
//   .ddo/eval/reports/<roundId>/ 发布产物（summary/卡片/sheet 等最终交付物）
const RUNS_ROOT = path.join(REPO_ROOT, '.ddo', 'eval', 'runs');
const PUBLISH_ROOT = path.join(REPO_ROOT, '.ddo', 'eval', 'reports');
const ENGINE_CLI = path.join(REPO_ROOT, 'tools', 'cli.js');
const THREE_LOCK = '0.160.0';

function usageError(msg) { process.stderr.write(`[用法错误] ${msg}\n`); process.exit(2); }
function fail(msg) { process.stderr.write(`[失败] ${msg}\n`); process.exit(1); }
function outJson(obj) { process.stdout.write(JSON.stringify(obj, null, 2) + '\n'); }

const BOOL_FLAGS = new Set(['dry-run', 'keep-sandboxes']);

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (!t.startsWith('--')) usageError(`未知位置参数: ${t}`);
    const key = t.slice(2);
    if (BOOL_FLAGS.has(key)) { flags[key] = true; continue; }
    if (i + 1 >= argv.length) usageError(`flag 缺少取值: ${t}`);
    flags[key] = argv[++i];
  }
  return flags;
}

/** 前置硬校验（失败即 fail，不进入执行）。model 可缺省 = 两臂不带 --model，用本地 claude 已配置模型。 */
function preflight({ model, baselineSid, ddoSid, tasks, packs, ccswitchDb, dryRun, dims }) {
  if (!baselineSid || !ddoSid) usageError('缺少 --baseline-sid / --ddo-sid');
  if (baselineSid === ddoSid) fail(`baseline_sid 与 ddo_sid 相同（${baselineSid}）——token 会混合，硬性约束禁止（需求 §5.3）`);
  for (const q of tasks) {
    if (!packs[q]) fail(`题包不存在: ${q}（bank/core 与 bank/rotating 均未找到）`);
    const meta = packs[q].meta;
    if (meta.kind === 'page' && meta.three_lock && meta.three_lock !== THREE_LOCK) {
      fail(`题 ${q} three 版本锁定不符（meta ${meta.three_lock} ≠ ${THREE_LOCK}）`);
    }
  }
  // 题组规则（AC-5）：题 1 页面必备；2–3 题
  if (tasks.length < 2 || tasks.length > 3) fail(`题组为 ${tasks.length} 道（每轮 2–3 题）`);
  if (!(packs[tasks[0]].meta.kind === 'page')) fail('题 1 必须为页面样式题（需求 §3 题位结构）');
  const coreCount = tasks.filter((q) => packs[q].meta.core).length;
  if (coreCount < 1) fail('题组须含至少 1 道冻结核心集题（跨模型可比）');
  if (!dryRun && dims.cost) {
    try { collectToken.resolveDbPath(ccswitchDb); } catch (e) { fail(e.message); }
  }
}

/** dry-run 桩产物：两臂可对照的最小实现（页面题用黄金样例；回归题打最小补丁）。 */
function stubArmArtifacts({ qName, arm, sandboxDir }) {
  if (qName === 'q_threejs-orbit-scene') {
    const variant = arm === 'ddo' ? 'reference' : 'flawed';
    fs.copyFileSync(path.join(sandboxLib.resolvePack(qName), 'acceptance', 'testdata', variant, 'index.html'), path.join(sandboxDir, 'index.html'));
    return;
  }
  if (qName === 'q_regression-trap') {
    if (arm === 'ddo') {
      const p = path.join(sandboxDir, 'bin', 'convert.js');
      let src = fs.readFileSync(p, 'utf8');
      src = src.replace("if (args[0] === '--upper')", "if (args[0] === '--uppercase') { mode = 'upper'; text = args.slice(1).join(' '); }\n  else if (args[0] === '--upper')");
      fs.writeFileSync(p, src);
    } else {
      const p = path.join(sandboxDir, 'lib', 'textlib.js');
      fs.appendFileSync(p, '\n// 手滑改了无关文件（越界改动样例）\n');
      fs.appendFileSync(path.join(sandboxDir, 'README.md'), '\n（未新增 --uppercase 的 baseline 样例）\n');
    }
  }
}

async function runCmd(flags) {
  const startedAt = new Date();
  const cliTasks = flags.tasks ? String(flags.tasks).split(',').map((s) => s.trim()).filter(Boolean) : null;
  let profile;
  try {
    profile = assembleProfile({ profileFile: flags.profile, cliTasks });
  } catch (e) {
    if (e instanceof ProfileError) usageError(e.message);
    throw e;
  }
  const dryRun = flags['dry-run'] === true;
  const armTimeout = Number(flags['arm-timeout'] || 30);
  const packs = {};
  for (const q of profile.tasks) {
    const packDir = sandboxLib.resolvePack(q);
    packs[q] = { dir: packDir, meta: JSON.parse(fs.readFileSync(path.join(packDir, 'meta.json'), 'utf8')), clarify: JSON.parse(fs.readFileSync(path.join(packDir, 'clarify.json'), 'utf8')) };
  }
  preflight({ model: flags.model, baselineSid: flags['baseline-sid'], ddoSid: flags['ddo-sid'], tasks: profile.tasks, packs, ccswitchDb: flags['ccswitch-db'], dryRun, dims: profile.dimensions });

  // 轮次目录 + round.json
  const roundId = `${startedAt.toISOString().replace(/[-:T]/g, '').slice(0, 13).replace('T', '')}-${String(flags.model || 'default').replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 24)}`;
  const roundDir = path.join(RUNS_ROOT, roundId);
  fs.mkdirSync(roundDir, { recursive: true });
  const round = {
    roundId, model: flags.model || null, tasks: profile.tasks, profile,
    baselineSid: flags['baseline-sid'], ddoSid: flags['ddo-sid'],
    dryRun, startedAt: startedAt.toISOString(),
    fingerprint: sandboxLib.environmentFingerprint({ model: flags.model || 'local-default', threeLock: THREE_LOCK }),
    arms: {}, questions: [],
  };
  // 展示标签：显式 model > 会话回执解析的真实模型 > 占位（未解析时如实标注）
  let modelLabel = flags.model || '本地缺省模型';

  const ddoHome = path.join(roundDir, '.ddo-home'); // 每轮覆写（隔离全局 index/history）
  fs.mkdirSync(ddoHome, { recursive: true });

  for (const qName of profile.tasks) {
    const { meta, clarify } = packs[qName];
    const qDir = path.join(roundDir, qName);
    fs.mkdirSync(qDir, { recursive: true });
    // ① 沙箱 + policy
    const arms = {};
    for (const arm of ['baseline', 'ddo']) {
      arms[arm] = sandboxLib.prepareArmSandbox({ roundDir, qName, arm, meta });
    }
    const { policyPath, table } = policyLib.writePolicyArtifacts({ roundQDir: qDir, clarify });
    const qStart = new Date().toISOString();
    round.arms[qName] = { baseline: arms.baseline.dir, ddo: arms.ddo.dir };

    // ② 双臂执行（并行）
    process.stderr.write(`[${qName}] 双臂执行${dryRun ? '（dry-run 桩）' : ''}…\n`);
    let armResults = {};
    if (dryRun) {
      for (const arm of ['baseline', 'ddo']) {
        stubArmArtifacts({ qName, arm, sandboxDir: arms[arm].dir });
        const events = driver.stubArmEvents({ arm, startedAt: qStart, endedAt: new Date().toISOString() });
        const streamPath = path.join(qDir, `${arm}-stream.jsonl`);
        fs.writeFileSync(streamPath, events.join('\n') + '\n');
        armResults[arm] = { arm, status: 'completed', exitCode: 0, startedAt: qStart, endedAt: new Date().toISOString(), turns: [{ subtype: 'success' }], answers: [], streamPath };
      }
    } else {
      const [rb, rd] = await Promise.all([
        driver.runArm({
          arm: 'baseline', sandboxDir: arms.baseline.dir, streamOutDir: qDir,
          promptText: driver.baselineArmPrompt({ taskPrompt: fs.readFileSync(path.join(packs[qName].dir, 'prompt.final.md'), 'utf8') }),
          model: flags.model, sessionId: round.baselineSid, timeoutMin: armTimeout,
          responderTable: profile.dimensions.symmetry ? table : null,
          env: { DDO_HOME: ddoHome }, // 每轮覆写（两臂一致；隔离全局 index/history）
        }),
        driver.runArm({
          arm: 'ddo', sandboxDir: arms.ddo.dir, streamOutDir: qDir,
          promptText: driver.ddoArmPrompt({ taskPrompt: fs.readFileSync(path.join(packs[qName].dir, 'prompt.final.md'), 'utf8'), policyPath }),
          model: flags.model, sessionId: round.ddoSid, timeoutMin: armTimeout,
          env: { DDO_HOME: ddoHome },
        }),
      ]);
      armResults = { baseline: rb, ddo: rd };
      // 未显式指定 model 时，从会话回执解析实际模型（两臂应一致；不一致如实记录）
      if (!round.model) {
        const rbM = rb.resolvedModel || null; const rdM = rd.resolvedModel || null;
        round.resolvedModel = round.resolvedModel || rbM || rdM;
        if (rbM && rdM && rbM !== rdM) {
          round.modelMismatch = true;
          process.stderr.write(`[警告] 两臂解析模型不一致（baseline=${rbM} ddo=${rdM}）——A/B 控变量存疑，已如实记录\n`);
        }
        if (round.resolvedModel) modelLabel = round.resolvedModel;
      }
    }
    const qEnd = new Date().toISOString();

    // ③ 收集与提取（维度按 profile）
    const metricsDir = path.join(qDir, 'metrics');
    fs.mkdirSync(metricsDir, { recursive: true });
    const reportDir = path.join(qDir, 'report');
    fs.mkdirSync(reportDir, { recursive: true });

    // 结果层
    let result;
    if (meta.kind === 'page') {
      const probeScript = path.join(packs[qName].dir, meta.probe || 'acceptance/probe.js');
      const runProbe = async (arm) => {
        const pageFile = path.join(arms[arm].dir, 'index.html');
        if (!fs.existsSync(pageFile)) return { error: 'index.html 未交付' };
        try {
          execFileSync(process.execPath, [probeScript, pageFile, path.join(reportDir, arm)], { encoding: 'utf8', timeout: 180000, stdio: 'pipe' });
          return collectResult.readProbe(path.join(reportDir, arm));
        } catch (e) { return { error: String((e && e.message) || e) }; }
      };
      const baselineOut = await runProbe('baseline');
      const ddoOut = await runProbe('ddo');
      result = collectResult.buildResult({ kind: 'page', baselineOut, ddoOut });
    } else if (profile.dimensions.result) {
      const baselineOut = collectResult.runAcceptance({ packDir: packs[qName].dir, sandboxDir: arms.baseline.dir });
      const ddoOut = collectResult.runAcceptance({ packDir: packs[qName].dir, sandboxDir: arms.ddo.dir });
      result = collectResult.buildResult({ kind: 'code', baselineOut, ddoOut });
    } else {
      result = { skipped: 'profile.dimensions.result = false' };
    }

    // 过程层
    const processMetrics = profile.dimensions.process || profile.dimensions.symmetry
      ? collectProcess.buildProcess({
          baseline: { streamPath: armResults.baseline.streamPath, sandboxDir: arms.baseline.dir },
          ddo: { streamPath: armResults.ddo.streamPath, sandboxDir: arms.ddo.dir },
          whitelist: meta.changeWhitelist, questionRe: driver.QUESTION_RE,
          expectedAmbiguities: (clarify.items || []).length,
          responderAnswers: armResults.baseline.answers || [],
          clarifyItems: clarify.items || [],
        })
      : { skipped: 'dimensions.process/symmetry 均关闭' };

    // 成本层（题窗口；ddo 组按 .usage.jsonl 切阶段窗）
    let token = null;
    if (profile.dimensions.cost) {
      const usageEvents = [];
      const walk = (d) => {
        if (!fs.existsSync(d)) return;
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const p = path.join(d, e.name);
          if (e.isDirectory()) walk(p);
          else if (e.name === '.usage.jsonl') for (const line of fs.readFileSync(p, 'utf8').split('\n').filter(Boolean)) { try { usageEvents.push(JSON.parse(line)); } catch { /* skip */ } }
        }
      };
      walk(path.join(arms.ddo.dir, '.ddo', 'runs'));
      token = collectToken.aggregateToken({
        dbPath: flags['ccswitch-db'], dryRun,
        windows: [
          { key: 'baseline', sid: round.baselineSid, from: qStart, to: qEnd },
          { key: 'ddo', sid: round.ddoSid, from: qStart, to: qEnd, stages: collectToken.stageWindows(usageEvents, qStart, qEnd) },
        ],
      });
    }

    for (const [name, data] of [['result', result], ['process', processMetrics], ['token', token]]) {
      if (data) fs.writeFileSync(path.join(metricsDir, `${name}.json`), JSON.stringify(data, null, 2) + '\n');
    }

    // ④ 报告（按 profile.reports）
    if (profile.reports.includes('card')) {
      const md = renderCard({
        model: modelLabel, qName, qTitle: meta.title, kind: meta.kind,
        result, process: processMetrics, token: token || { groups: [] },
        armReportDirs: { baseline: arms.baseline.dir, ddo: arms.ddo.dir },
      });
      fs.writeFileSync(path.join(reportDir, `card-${qName}.md`), md);
    }
    round.questions.push({
      qName, kind: meta.kind, lineHint: meta.line, arms: armResults,
      reportDir, resultDelta: result && result.delta ? result.delta.结果层 : null,
      symmetry: processMetrics.signals ? (processMetrics.signals.find((s) => s.signal === '澄清对称性') || {}).detail : undefined,
    });
    process.stderr.write(`[${qName}] 完成：${result && result.delta ? result.delta.结果层 : '（结果层关闭）'}\n`);
  }

  // ⑤ 汇总 + 平台物料
  const publishDir = path.join(PUBLISH_ROOT, roundId);
  fs.mkdirSync(publishDir, { recursive: true });
  if (profile.reports.includes('summary')) {
    const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; } };
    const cards = round.questions.map((q) => {
      const token = readJson(path.join(roundDir, q.qName, 'metrics', 'token.json'));
      const g = (key) => (token.groups || []).find((x) => x.key === key) || {};
      return {
        qName: q.qName, kind: q.kind, lineHint: q.lineHint,
        result: readJson(path.join(roundDir, q.qName, 'metrics', 'result.json')),
        symmetry: q.symmetry && q.symmetry.结论,
        tokenLineShort: `；token ${fmtK(g('baseline').total_tokens || 0)} → ${fmtK(g('ddo').total_tokens || 0)}`,
      };
    });
    fs.writeFileSync(path.join(publishDir, 'summary.md'), renderSummary({ model: modelLabel, cards, dryRun }));
  }
  for (const q of round.questions) {
    const card = path.join(roundDir, q.qName, 'report', `card-${q.qName}.md`);
    if (fs.existsSync(card)) fs.copyFileSync(card, path.join(publishDir, `card-${q.qName}.md`));
    if (q.kind === 'page') {
      // 卡片图片相对链接为 <arm>/shots/...：按同结构复制（另备 sheet 用 <arm>-shots）
      for (const arm of ['baseline', 'ddo']) {
        const shots = path.join(roundDir, q.qName, 'report', arm, 'shots');
        if (fs.existsSync(shots)) {
          fs.cpSync(shots, path.join(publishDir, arm, 'shots'), { recursive: true });
          fs.cpSync(shots, path.join(publishDir, `${arm}-shots`), { recursive: true });
        }
      }
      // sheet / 平台物料（页面题）
      const ctx = {
        title: `${modelLabel} · ${q.qName}`, subtitle: '同模型 A/B 对照（2–3 题小样本）',
        baselineRate: '-', ddoRate: '-',
        baselineShot: `baseline-shots/initial.png`, ddoShot: `ddo-shots/initial.png`, shot: `ddo-shots/initial.png`,
        keyPoints: 'Ddo-Code-Flow 在 spec 阶段把规格转 checklist 并逐项验证；代价是更高 token，收益是规格达标项提升（数字见汇总页）。',
        declarations: '2–3 题小样本，体感参考，不代表全面测评。过于简单的任务无收益或负收益（预期结论，如实记录）。token 仅同模型内对照。',
      };
      try {
        const res = JSON.parse(fs.readFileSync(path.join(roundDir, q.qName, 'metrics', 'result.json'), 'utf8'));
        ctx.baselineRate = res.baseline.ok ? `${res.baseline.pass}/${res.baseline.total}` : '失败';
        ctx.ddoRate = res.ddo.ok ? `${res.ddo.pass}/${res.ddo.total}` : '失败';
      } catch { /* 保留占位 */ }
      if (profile.reports.includes('sheet')) {
        fs.writeFileSync(path.join(publishDir, `sheet-${q.qName}.html`), renderHtmlForm({ form: 'sheet', ctx }));
        await exportPng(path.join(publishDir, `sheet-${q.qName}.html`), path.join(publishDir, `sheet-${q.qName}.png`), { width: 1100, height: 700 });
      }
      if (profile.reports.includes('wechat')) {
        fs.writeFileSync(path.join(publishDir, `wechat-${q.qName}.html`), renderHtmlForm({ form: 'wechat', ctx }));
      }
      if (profile.reports.includes('xiaohongshu')) {
        fs.writeFileSync(path.join(publishDir, `xiaohongshu-${q.qName}.html`), renderHtmlForm({ form: 'xiaohongshu', ctx }));
        await exportPng(path.join(publishDir, `xiaohongshu-${q.qName}.html`), path.join(publishDir, `xiaohongshu-${q.qName}.png`), { width: 810, height: 1080 });
      }
    }
  }

  round.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(roundDir, 'round.json'), JSON.stringify(round, null, 2) + '\n');
  // 产物位置一屏说清（可发现性：全部在 .ddo/eval/ 下，不进源码树）
  const summaryPath = path.join(publishDir, 'summary.md');
  process.stderr.write([
    '轮次完成。产物位置（均在 .ddo/eval/ 下，不进源码树）：',
    ...(fs.existsSync(summaryPath) ? [`  汇总页    ${summaryPath}`] : ['  汇总页    （本轮 reports 未含 summary）']),
    ...round.questions.map((q) => `  卡片      ${path.join(publishDir, `card-${q.qName}.md`)}`),
    `  每题详情  ${roundDir}/<题名>/{report,metrics}`,
    `  沙箱根    ${roundDir}`,
    `（沙箱为工作区大目录；显式清理：cli.js clean --run ${roundId}，同时删除 runs/ 与 reports/ 下该轮次）`,
  ].join('\n') + '\n');
  outJson({
    roundId, dryRun, model: modelLabel, tasks: round.tasks,
    questions: round.questions.map((q) => ({ q: q.qName, delta: q.resultDelta, reportDir: q.reportDir })),
    publishDir, summaryPath, runsDir: roundDir,
  });
}

function cleanCmd(flags) {
  if (!flags.run) usageError('clean: 缺少 --run <轮次Id>');
  outJson(sandboxLib.cleanRound(RUNS_ROOT, flags.run, PUBLISH_ROOT));
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = parseArgs(rest);
  if (cmd === 'run') return runCmd(flags);
  if (cmd === 'clean') return cleanCmd(flags);
  usageError(`未知子命令: ${cmd || '(空)'}（run | clean）`);
}

main().catch((e) => fail(String((e && e.message) || e)));
