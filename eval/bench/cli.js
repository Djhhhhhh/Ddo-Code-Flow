#!/usr/bin/env node
'use strict';
// model-quick-eval 编排器入口（issue #94 报告层重构）。
// 用法：
//   node eval/bench/cli.js run [--model <名>] --tasks <q…> --baseline-sid <s> --ddo-sid <s>   # --model 缺省 = 本地 claude 已配置模型
//        [--profile <f>] [--ccswitch-db <p>] [--arm-timeout <min>] [--dry-run] [--keep-sandboxes]
//        # run 恒产核心集报告（card+summary）；平台物料改经 report 子命令（report-* 原子任务装配）
//   node eval/bench/cli.js report --form <sheet|wechat|xiaohongshu> --round <轮次Id>          # 平台物料唯一渲染入口（确定性内核）
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
const { renderCard, renderSummary, fmtK } = require('./src/report/render');
const forms = require('./src/report/forms');
const { createProgress, createHeartbeat, renderRoundStart, renderRoundEnd } = require('./src/progress');

const BENCH_ROOT = __dirname;
const REPO_ROOT = path.join(BENCH_ROOT, '..', '..');
// 运行产物统一隔离在仓库 .ddo/eval/ 下（不落 eval/bench/ 源码树）：
//   .ddo/eval/runs/<roundId>/    沙箱、事件流、指标与每题报告（工作区，可 clean）
//   .ddo/eval/reports/<roundId>/ 发布产物（summary/卡片/sheet 等最终交付物）
const RUNS_ROOT = path.join(REPO_ROOT, '.ddo', 'eval', 'runs');
const PUBLISH_ROOT = path.join(REPO_ROOT, '.ddo', 'eval', 'reports');
const ENGINE_CLI = path.join(REPO_ROOT, 'tools', 'cli.js');
// 平台版本锁唯一声明源（原 meta.three_lock/cdns 已废除；题面 three@<版本> 由 preflight 校验一致性）。
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

/** 前置硬校验（失败即 fail，不进入执行）。model 可缺省 = 两臂不带 --model，用本地 claude 已配置模型。
 *  qpack 必填字段由 sandbox.readQpack 在题包读取时校验（单源）；此处补 page 题题面平台版本一致性。
 *  题组组成自由化（issue #92 DEC-9）：数量/顺序/形态不做硬校验，题组策略由 profile/--tasks 承载。 */
function preflight({ model, baselineSid, ddoSid, tasks, packs, ccswitchDb, dryRun, dims }) {
  if (!baselineSid || !ddoSid) usageError('缺少 --baseline-sid / --ddo-sid');
  if (baselineSid === ddoSid) fail(`baseline_sid 与 ddo_sid 相同（${baselineSid}）——token 会混合，硬性约束禁止（需求 §5.3）`);
  for (const q of tasks) {
    if (!packs[q]) fail(`题包不存在: ${q}（bank/core 与 bank/rotating 均未找到）`);
    const { qpack, dir } = packs[q];
    if (qpack.form === 'page') {
      const promptText = fs.readFileSync(path.join(dir, 'prompt.md'), 'utf8');
      const versions = [...promptText.matchAll(/three@(\d+(?:\.\d+)*)/g)].map((m) => m[1]);
      const bad = versions.find((v) => v !== THREE_LOCK);
      if (bad) fail(`题 ${q} 题面 three 版本不符（prompt.md three@${bad} ≠ 平台锁 ${THREE_LOCK}）`);
    }
  }
  if (!dryRun && dims.cost) {
    try { collectToken.resolveDbPath(ccswitchDb); } catch (e) { fail(e.message); }
  }
}

/** dry-run 桩调度（issue #92 DEC-6）：题包自带 acceptance/stub.js（`async ({arm, sandboxDir, packDir})`）；
 *  无文件 = 无操作（合法形态）。题结构知识归题包，编排器不按题名分支。 */
async function runPackStub({ qName, arm, sandboxDir }) {
  const packDir = sandboxLib.resolvePack(qName);
  const stubPath = path.join(packDir, 'acceptance', 'stub.js');
  if (!fs.existsSync(stubPath)) return;
  await require(stubPath)({ arm, sandboxDir, packDir });
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
    packs[q] = { dir: packDir, qpack: sandboxLib.readQpack(packDir), clarify: JSON.parse(fs.readFileSync(path.join(packDir, 'clarify.json'), 'utf8')) };
  }
  preflight({ model: flags.model, baselineSid: flags['baseline-sid'], ddoSid: flags['ddo-sid'], tasks: profile.tasks, packs, ccswitchDb: flags['ccswitch-db'], dryRun, dims: profile.dimensions });

  // 轮次目录 + round.json
  const roundId = `${startedAt.toISOString().replace(/[-:T]/g, '').slice(0, 13).replace('T', '')}-${String(flags.model || 'default').replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 24)}`;
  const roundDir = path.join(RUNS_ROOT, roundId);
  fs.mkdirSync(roundDir, { recursive: true });
  // 执行进度双通道（issue #93 G1/G2）：stderr 人话公告/心跳/预警/轮末清单 + progress.jsonl 事件流
  const progress = createProgress({ roundDir });
  process.stderr.write(renderRoundStart({ roundId, roundDir, tasks: profile.tasks, armTimeoutMin: armTimeout }) + '\n');
  progress.emit('round-start', { detail: { roundId, roundDir, tasks: profile.tasks, armTimeoutMin: armTimeout } });
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

  for (const [qIdx, qName] of profile.tasks.entries()) {
    const { qpack, clarify } = packs[qName];
    const qDir = path.join(roundDir, qName);
    fs.mkdirSync(qDir, { recursive: true });
    // ① 沙箱 + policy
    const arms = {};
    for (const arm of ['baseline', 'ddo']) {
      arms[arm] = sandboxLib.prepareArmSandbox({ roundDir, qName, arm, qpack });
    }
    const { policyPath, table } = policyLib.writePolicyArtifacts({ roundQDir: qDir, clarify });
    const qStart = new Date().toISOString();
    round.arms[qName] = { baseline: arms.baseline.dir, ddo: arms.ddo.dir };
    progress.emit('q-start', { q: qName, detail: { form: qpack.form } });
    // 心跳（DEC-P2/DEC-P3）：真实模式 60s 定时器增量扫描；dry-run 在桩流写盘后 tick() 同步驱动
    const heartbeat = createHeartbeat({
      progress, arms: { baseline: path.join(qDir, 'baseline-stream.jsonl'), ddo: path.join(qDir, 'ddo-stream.jsonl') },
      qLabel: qName, qIndex: qIdx + 1, qTotal: profile.tasks.length, timeoutMin: armTimeout, startedAtMs: Date.now(),
    });

    // ② 双臂执行（并行）
    process.stderr.write(`[${qName}] 双臂执行${dryRun ? '（dry-run 桩）' : ''}…\n`);
    let armResults = {};
    if (dryRun) {
      for (const arm of ['baseline', 'ddo']) {
        await runPackStub({ qName, arm, sandboxDir: arms[arm].dir });
        const events = driver.stubArmEvents({ arm, startedAt: qStart, endedAt: new Date().toISOString() });
        const streamPath = path.join(qDir, `${arm}-stream.jsonl`);
        fs.writeFileSync(streamPath, events.join('\n') + '\n');
        armResults[arm] = { arm, status: 'completed', exitCode: 0, startedAt: qStart, endedAt: new Date().toISOString(), turns: [{ subtype: 'success' }], answers: [], streamPath };
      }
      heartbeat.tick(); // dry-run 桩事件同样驱动（DEC-P3）：同步扫描桩流 → arm-turn 事件 + 心跳行 + 预警评估
      for (const arm of ['baseline', 'ddo']) progress.emit('arm-done', { q: qName, arm, detail: { status: 'completed', exitCode: 0 } });
    } else {
      heartbeat.start();
      const [rb, rd] = await Promise.all([
        driver.runArm({
          arm: 'baseline', sandboxDir: arms.baseline.dir, streamOutDir: qDir,
          promptText: driver.baselineArmPrompt({ taskPrompt: fs.readFileSync(path.join(packs[qName].dir, 'prompt.md'), 'utf8') }),
          model: flags.model, sessionId: round.baselineSid, timeoutMin: armTimeout,
          responderTable: profile.dimensions.symmetry ? table : null,
          env: { DDO_HOME: ddoHome }, // 每轮覆写（两臂一致；隔离全局 index/history）
        }),
        driver.runArm({
          arm: 'ddo', sandboxDir: arms.ddo.dir, streamOutDir: qDir,
          promptText: driver.ddoArmPrompt({ taskPrompt: fs.readFileSync(path.join(packs[qName].dir, 'prompt.md'), 'utf8'), policyPath }),
          model: flags.model, sessionId: round.ddoSid, timeoutMin: armTimeout,
          env: { DDO_HOME: ddoHome },
        }),
      ]);
      armResults = { baseline: rb, ddo: rd };
      heartbeat.stop();
      for (const arm of ['baseline', 'ddo']) progress.emit('arm-done', { q: qName, arm, detail: { status: armResults[arm].status, exitCode: armResults[arm].exitCode } });
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
    if (qpack.form === 'page') {
      const probeScript = path.join(packs[qName].dir, 'acceptance', 'probe.js'); // 固定路径约定（原 meta.probe）
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
          whitelist: qpack.changeWhitelist, questionRe: driver.QUESTION_RE,
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
    progress.emit('q-collect', { q: qName, detail: { result: !(result && result.skipped), process: !(processMetrics && processMetrics.skipped), cost: token !== null } });

    // ④ 核心集报告（issue #94 DEC-1：card 恒产，不受 profile.reports 控制）
    {
      const md = renderCard({
        model: modelLabel, qName, qTitle: qpack.title, form: qpack.form,
        result, process: processMetrics, token: token || { groups: [] },
        armReportDirs: { baseline: arms.baseline.dir, ddo: arms.ddo.dir },
        expectedBehaviors: (qpack.meta && qpack.meta.expectedBehaviors) || [],
        taskCount: profile.tasks.length,
      });
      fs.writeFileSync(path.join(reportDir, `card-${qName}.md`), md);
    }
    round.questions.push({
      qName, form: qpack.form, track: qpack.track, arms: armResults,
      reportDir, resultDelta: result && result.delta ? result.delta.结果层 : null,
      symmetry: processMetrics.signals ? (processMetrics.signals.find((s) => s.signal === '澄清对称性') || {}).detail : undefined,
    });
    process.stderr.write(`[${qName}] 完成：${result && result.delta ? result.delta.结果层 : '（结果层关闭）'}\n`);
    progress.emit('q-end', { q: qName, detail: { delta: result && result.delta ? result.delta.结果层 : null } });
  }

  // ⑤ 汇总 + 核心集发布（issue #94 DEC-1：summary 恒产；平台物料改经 report 子命令，run 不再内联渲染）
  const publishDir = path.join(PUBLISH_ROOT, roundId);
  fs.mkdirSync(publishDir, { recursive: true });
  const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; } };
  const cards = round.questions.map((q) => {
    const token = readJson(path.join(roundDir, q.qName, 'metrics', 'token.json'));
    const g = (key) => (token.groups || []).find((x) => x.key === key) || {};
    return {
      qName: q.qName, form: q.form, track: q.track,
      result: readJson(path.join(roundDir, q.qName, 'metrics', 'result.json')),
      symmetry: q.symmetry && q.symmetry.结论,
      tokenLineShort: `${fmtK(g('baseline').total_tokens || 0)} → ${fmtK(g('ddo').total_tokens || 0)}`,
    };
  });
  fs.writeFileSync(path.join(publishDir, 'summary.md'), renderSummary({ model: modelLabel, cards, dryRun, taskCount: profile.tasks.length }));
  for (const q of round.questions) {
    const card = path.join(roundDir, q.qName, 'report', `card-${q.qName}.md`);
    if (fs.existsSync(card)) fs.copyFileSync(card, path.join(publishDir, `card-${q.qName}.md`));
    if (q.form === 'page') {
      // 卡片图片相对链接为 <arm>/shots/...：按同结构复制（平台物料截图由 report 子命令在 report-<form>/ 内自管）
      for (const arm of ['baseline', 'ddo']) {
        const shots = path.join(roundDir, q.qName, 'report', arm, 'shots');
        if (fs.existsSync(shots)) fs.cpSync(shots, path.join(publishDir, arm, 'shots'), { recursive: true });
      }
    }
  }

  round.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(roundDir, 'round.json'), JSON.stringify(round, null, 2) + '\n');
  // 产物位置一屏说清（可发现性：全部在 .ddo/eval/ 下，不进源码树）
  const summaryPath = path.join(publishDir, 'summary.md');
  process.stderr.write(renderRoundEnd({ questions: round.questions, summaryPath }) + '\n'); // 轮末清单（G1）
  process.stderr.write([
    '轮次完成。产物位置（均在 .ddo/eval/ 下，不进源码树）：',
    ...(fs.existsSync(summaryPath) ? [`  汇总页    ${summaryPath}`] : ['  汇总页    （本轮 reports 未含 summary）']),
    ...round.questions.map((q) => `  卡片      ${path.join(publishDir, `card-${q.qName}.md`)}`),
    `  每题详情  ${roundDir}/<题名>/{report,metrics}`,
    `  进度事件  ${path.join(roundDir, 'progress.jsonl')}`,
    `  沙箱根    ${roundDir}`,
    `（沙箱为工作区大目录；显式清理：cli.js clean --run ${roundId}，同时删除 runs/ 与 reports/ 下该轮次）`,
  ].join('\n') + '\n');
  progress.emit('round-end', {
    detail: {
      questions: round.questions.map((q) => ({ q: q.qName, delta: q.resultDelta === undefined ? null : q.resultDelta })),
      elapsedMin: Number(((Date.now() - startedAt.getTime()) / 60000).toFixed(1)),
    },
  });
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

/** report 子命令（issue #94 DEC-3：平台物料唯一渲染入口，确定性内核）。
 *  输入口径见 eval/bench/docs/report-contract.md：round.json + 逐题 metrics + qpack + shots；
 *  与 ddo run 的 runDir 解耦（eval-result.json 仅为任务侧定位/核对输入，此处不依赖）。
 *  幂等：同一轮次数据重跑产物一致；覆写 report-<form>/ 内同名文件，不触碰其他既有文件。 */
async function reportCmd(flags) {
  if (!flags.form) usageError('report: 缺少 --form <sheet|wechat|xiaohongshu>');
  if (!flags.round) usageError('report: 缺少 --round <轮次Id>');
  if (!forms.FORMS.includes(flags.form)) usageError(`report: 未注册形式 ${flags.form}（注册表: ${forms.FORMS.join(' | ')}）`);
  const roundDir = path.join(RUNS_ROOT, flags.round);
  const roundJsonPath = path.join(roundDir, 'round.json');
  if (!fs.existsSync(roundJsonPath)) fail(`轮次不存在: ${roundJsonPath}`);
  const round = JSON.parse(fs.readFileSync(roundJsonPath, 'utf8'));
  const publishDir = path.join(PUBLISH_ROOT, flags.round);
  fs.mkdirSync(publishDir, { recursive: true });
  const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
  const fmtRate = (o) => (o && o.ok ? `${o.pass}/${o.total}` : '失败');
  const pageQs = [];
  for (const q of round.questions || []) {
    if (q.form !== 'page') continue;
    const qDir = path.join(roundDir, q.qName);
    let result = {};
    try { result = readJson(path.join(qDir, 'metrics', 'result.json')); } catch { /* 如实标注：失败 */ }
    let tokenShort = ''; let tokenB = ''; let tokenD = ''; let tokenRatio = '';
    try {
      const tk = readJson(path.join(qDir, 'metrics', 'token.json'));
      const g = (key) => (tk.groups || []).find((x) => x.key === key) || {};
      const bt = g('baseline').total_tokens || 0; const dt = g('ddo').total_tokens || 0;
      tokenShort = `${fmtK(bt)} → ${fmtK(dt)}`;
      tokenB = fmtK(bt); tokenD = fmtK(dt);
      if (bt > 0) tokenRatio = `×${(dt / bt).toFixed(1)}`;
    } catch { tokenShort = ''; }
    const qpack = sandboxLib.readQpack(sandboxLib.resolvePack(q.qName));
    pageQs.push({
      qName: q.qName, title: qpack.title, form: 'page', track: q.track || q.trackHint, // 兼容旧轮次 trackHint
      baselineRate: fmtRate(result.baseline), ddoRate: fmtRate(result.ddo),
      delta: (result.delta && result.delta.结果层) || '',
      tokenShort, tokenB, tokenD, tokenRatio,
      armShotsDirs: {
        baseline: path.join(qDir, 'report', 'baseline', 'shots'),
        ddo: path.join(qDir, 'report', 'ddo', 'shots'),
      },
    });
  }
  const roundCtx = {
    roundId: flags.round,
    modelLabel: round.model || round.resolvedModel || '本地缺省模型',
    taskCount: (round.tasks || []).length,
    dryRun: !!round.dryRun,
  };
  const result = await forms.renderForm({ form: flags.form, round: roundCtx, pageQs, publishDir });
  const missing = result.outputs.filter((o) => !fs.existsSync(path.join(publishDir, o)));
  if (missing.length) fail(`渲染器声称的产物不存在: ${missing.join(', ')}（不虚构 outputs）`);
  outJson({
    form: flags.form, round_id: flags.round, publish_dir: publishDir,
    outputs: result.outputs, skipped: result.skipped, notes: result.notes,
  });
  process.stderr.write(`[report] ${flags.form} 物料完成：${result.outputs.length} 个产物（${path.join(publishDir, `report-${flags.form}`)}）${result.skipped ? '；主产物 PNG 全部跳过（原因见 notes）' : ''}\n`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = parseArgs(rest);
  if (cmd === 'run') return runCmd(flags);
  if (cmd === 'report') return reportCmd(flags);
  if (cmd === 'clean') return cleanCmd(flags);
  usageError(`未知子命令: ${cmd || '(空)'}（run | report | clean）`);
}

main().catch((e) => fail(String((e && e.message) || e)));
