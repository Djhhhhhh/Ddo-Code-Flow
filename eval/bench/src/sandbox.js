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

/** 题包定位：core/ → rotating/；不存在抛错（rotating 目录已废除，查找分支保留——不存在即跳过）。 */
function resolvePack(qName) {
  for (const sub of ['core', 'rotating']) {
    const dir = path.join(BANK_ROOT, sub, qName);
    if (fs.existsSync(path.join(dir, 'qpack.json'))) return dir;
  }
  throw new Error(`题包不存在: ${qName}（查找 bank/core 与 bank/rotating）`);
}

/** qpack 唯一机器契约校验（issue #92 DEC-1；cli preflight 与 tests 共用单源）。 */
function readQpack(packDir) {
  const qpack = JSON.parse(fs.readFileSync(path.join(packDir, 'qpack.json'), 'utf8'));
  const where = `qpack.json（${packDir}）`;
  if (!qpack || typeof qpack !== 'object' || Array.isArray(qpack)) throw new Error(`${where} 须为 JSON 对象`);
  if (typeof qpack.title !== 'string' || !qpack.title.trim()) throw new Error(`${where} 缺必填字段 title（非空字符串）`);
  if (qpack.form !== 'code' && qpack.form !== 'page') throw new Error(`${where} form 非法: ${qpack.form}（合法: code | page）`);
  if (!['ui', 'design', 'execute', 'both', 'none'].includes(qpack.track)) {
    throw new Error(`${where} track 非法: ${qpack.track}（合法: ui | design | execute | both | none）`);
  }
  if (qpack.form === 'code') {
    if (!Array.isArray(qpack.changeWhitelist) || !qpack.changeWhitelist.length || !qpack.changeWhitelist.every((w) => typeof w === 'string')) {
      throw new Error(`${where} code 题必填 changeWhitelist（非空字符串数组）`);
    }
  } else if (qpack.changeWhitelist !== undefined) {
    throw new Error(`${where} page 题不得含 changeWhitelist（单页交付无越界判定）`);
  }
  if (qpack.meta !== undefined && (typeof qpack.meta !== 'object' || Array.isArray(qpack.meta))) {
    throw new Error(`${where} meta 须为对象（人读档案，编排器不读）`);
  }
  return qpack;
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
 * - 页面题（form=page）：空白工作区 + README（交付单个 index.html 的提示不注入——题面已含）。
 * - 代码题（form=code）：固定约定复制 fixture/（含 .ddo 样例与测试）并 git 初始化提交（改动范围提取基线）。
 */
function prepareArmSandbox({ roundDir, qName, arm, qpack }) {
  const packDir = resolvePack(qName);
  const dir = path.join(roundDir, qName, arm);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const form = qpack.form;
  if (form === 'code') {
    copyDirFiltered(path.join(packDir, 'fixture'), dir); // 固定目录约定（原 meta.fixture.dir）
  } else {
    fs.writeFileSync(path.join(dir, 'README.workspace.md'), `# 评测工作区（${qName} / ${arm}）\n\n被测任务的工作目录。按题面要求在此交付。\n`);
  }
  // 沙箱级 settings 不再落盘（headless 未信任工作区会忽略该文件）；
  // 权限预放行由 driver.js 以 --settings <json> 注入，两臂同配置。
  // git 基线（改动范围提取；code 题固定约定，原 meta.fixture.git）
  if (form === 'code') {
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

module.exports = { resolvePack, readQpack, prepareArmSandbox, environmentFingerprint, cleanRound, SANDBOX_SETTINGS, BANK_ROOT, BENCH_ROOT };
