'use strict';
// 沙箱准备/清理/环境指纹（plan Part 02 §2，DEC-3）：
// 每题每臂独立沙箱（沙箱即 projectRoot），fixture 静态模板复制，git 题型初始提交；
// 沙箱级 .claude/settings.json 预放行工具（两臂同配置——控变量）。

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const BENCH_ROOT = path.join(__dirname, '..');
const BANK_ROOT = path.join(BENCH_ROOT, 'bank');

const SANDBOX_SETTINGS = {
  // 沙箱内放开常用工具（隔离环境；两臂完全一致，唯一变量是 prompt 指令）。
  // 注意：headless（-p）模式下未信任工作区的 .claude/settings.json 会被忽略
  // （trust 对话框被跳过），因此本配置由 driver 以 --settings <json> 显式注入，
  // 不再落盘沙箱 settings.json（避免「Ignoring N permissions.allow」告警与失效配置）。
  permissions: { allow: ['Bash', 'Read', 'Write', 'Edit', 'MultiEdit', 'Glob', 'Grep', 'WebFetch', 'WebSearch'] },
};

/** 题包定位：core/ → rotating/；不存在抛错。 */
function resolvePack(qName) {
  for (const sub of ['core', 'rotating']) {
    const dir = path.join(BANK_ROOT, sub, qName);
    if (fs.existsSync(path.join(dir, 'meta.json'))) return dir;
  }
  throw new Error(`题包不存在: ${qName}（查找 bank/core 与 bank/rotating）`);
}

/** 复制目录（浅层递归；跳过 acceptance/——隐藏验收不进沙箱）。 */
function copyDirFiltered(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name === 'acceptance') continue; // 隐藏验收对两臂不可见
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) copyDirFiltered(s, d);
    else fs.copyFileSync(s, d);
  }
}

/**
 * 准备单臂沙箱。返回 { dir, ddoHome }。
 * - 页面题：空白工作区 + README（交付单个 index.html 的提示不注入——题面已含）。
 * - 代码题：复制 fixture/（含 .ddo 样例与测试），git 初始化提交（改动范围提取基线）。
 */
function prepareArmSandbox({ roundDir, qName, arm, meta }) {
  const packDir = resolvePack(qName);
  const dir = path.join(roundDir, qName, arm);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const kind = meta.kind || 'code';
  if (kind === 'code' && meta.fixture && meta.fixture.dir) {
    copyDirFiltered(path.join(packDir, meta.fixture.dir), dir);
  } else {
    fs.writeFileSync(path.join(dir, 'README.workspace.md'), `# 评测工作区（${qName} / ${arm}）\n\n被测任务的工作目录。按题面要求在此交付。\n`);
  }
  // 沙箱级 settings 不再落盘（headless 未信任工作区会忽略该文件）；
  // 权限预放行由 driver.js 以 --settings <json> 注入，两臂同配置。
  // git 基线（改动范围提取）
  if (kind === 'code' && meta.fixture && meta.fixture.git) {
    const git = (args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'eval-bench', GIT_AUTHOR_EMAIL: 'eval@bench.local', GIT_COMMITTER_NAME: 'eval-bench', GIT_COMMITTER_EMAIL: 'eval@bench.local' } });
    git(['init', '-q']);
    git(['add', '-A']);
    git(['commit', '-qm', 'fixture baseline (eval sandbox)']);
  }
  return { dir, packDir };
}

/** 环境指纹（控变量核验材料，AC-2）：两臂配置 + 引擎版本锚点。 */
function environmentFingerprint({ model, extra = {} }) {
  return {
    model,
    node: process.version,
    platform: `${process.platform}/${process.arch}`,
    engineCommit: extra.engineCommit || null,
    threeLock: extra.threeLock || null,
    sandboxSettings: SANDBOX_SETTINGS,
    createdAt: new Date().toISOString(),
  };
}

/** 显式清理一轮沙箱与发布产物（clean 子命令；不自动触发）。 */
function cleanRound(runsRoot, roundId, publishRoot) {
  const cleaned = [];
  const dir = path.join(runsRoot, roundId);
  if (fs.existsSync(dir)) { fs.rmSync(dir, { recursive: true, force: true }); cleaned.push(dir); }
  if (publishRoot) {
    const pub = path.join(publishRoot, roundId);
    if (fs.existsSync(pub)) { fs.rmSync(pub, { recursive: true, force: true }); cleaned.push(pub); }
  }
  if (!cleaned.length) throw new Error(`轮次目录不存在: ${dir}（publish 同不存在）`);
  return { cleaned };
}

module.exports = { resolvePack, prepareArmSandbox, environmentFingerprint, cleanRound, SANDBOX_SETTINGS, BANK_ROOT, BENCH_ROOT };
