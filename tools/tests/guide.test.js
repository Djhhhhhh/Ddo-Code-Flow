'use strict';
// tools/tests/guide.test.js — 启动检查 payload 测试（启动状态机定版，#64）。
//
// 覆盖：五问顺序定版（goal → worktree → mode → type → home，顺序即问询协议）、
// startupCheck 形态（无 running 空清单 / 有 running 行含 runId 与 resumeCommand）、
// payload 确定性（同环境两次调用输出等值）、worktree 问选项与缺省源自 git-worktree
// configurable 现算（--tasks-dir 定制传导）。
// 隔离约定同前：mkdtemp 沙箱 + DDO_HOME 覆写 + finally 递归删除，不触碰真实 ~/.ddo。

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI = path.join(__dirname, '..', 'cli.js');

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddo-guide-test-'));
  return { dir, ddoHome: path.join(dir, 'ddo-home'), project: path.join(dir, 'project'), tasks: path.join(dir, 'tasks') };
}

function cleanup(sb) {
  fs.rmSync(sb.dir, { recursive: true, force: true });
}

function cli(args, sb) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: sb.dir,
    env: { ...process.env, DDO_HOME: sb.ddoHome },
    encoding: 'utf8',
  });
}

// 沙箱定制任务目录：只放 guide 关心的 git-worktree config（其余任务不在本测试面）
function writeWorktreeConfig(sb, modeDefault) {
  const dir = path.join(sb.tasks, 'git-worktree');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({
    name: 'git-worktree',
    version: '2.2.0',
    configurable: [
      { key: 'mode', desc: 'worktree 场景（沙箱定制文案）', ...(modeDefault ? { default: modeDefault } : {}) },
    ],
  }));
}

// ---------------------------------------------------------------- 五问定版与形态

test('五问定版：questions 顺序 goal → worktree → mode → type → home（顺序即问询协议）', () => {
  const sb = sandbox();
  try {
    const r = cli(['guide'], sb);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.deepStrictEqual(out.questions.map((q) => q.id), ['goal', 'worktree', 'mode', 'type', 'home']);
    // goal 保持 freeText（worktree 分支名的语义来源）
    assert.equal(out.questions[0].freeText, true);
    // worktree 问：四场景（none/single/release-dev/multi）+ 条件追问（release-dev→基线；multi→仓库清单）
    const wt = out.questions[1];
    assert.deepStrictEqual(wt.options.map((o) => o.name), ['none', 'single', 'release-dev', 'multi']);
    assert.equal(wt.followUp.whenOption, 'release-dev');
    assert.equal(wt.followUp.freeText, true);
    assert.deepStrictEqual(wt.followUps.map((f) => f.whenOption), ['release-dev', 'multi']);
    assert.equal(wt.followUps[1].freeText, true);
  } finally {
    cleanup(sb);
  }
});

test('worktree 问：缺省标注与 note 源自 git-worktree configurable（--tasks-dir 定制传导）', () => {
  const sb = sandbox();
  try {
    writeWorktreeConfig(sb, 'single'); // 定制缺省 single + 定制文案
    const r = cli(['guide', '--tasks-dir', sb.tasks], sb);
    assert.equal(r.status, 0, r.stderr);
    const wt = JSON.parse(r.stdout).questions[1];
    assert.equal(wt.note, 'worktree 场景（沙箱定制文案）'); // 机制说明引用 config desc
    const single = wt.options.find((o) => o.name === 'single');
    const none = wt.options.find((o) => o.name === 'none');
    assert.ok(single.desc.includes('（缺省）')); // default=single 传导为缺省标注
    assert.ok(!none.desc.includes('（缺省）'));
  } finally {
    cleanup(sb);
  }
});

test('worktree config 不可读 → 固定文案兜底，不阻断引导', () => {
  const sb = sandbox();
  try {
    // --tasks-dir 指向无 git-worktree config 的目录
    fs.mkdirSync(sb.tasks, { recursive: true });
    const r = cli(['guide', '--tasks-dir', sb.tasks], sb);
    assert.equal(r.status, 0, r.stderr);
    const wt = JSON.parse(r.stdout).questions[1];
    assert.deepStrictEqual(wt.options.map((o) => o.name), ['none', 'single', 'release-dev', 'multi']);
    assert.ok(wt.options[0].desc.includes('（缺省）')); // 兜底缺省 none
    assert.ok(!wt.note); // 无 config 说明则省略 note
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- startupCheck

test('startupCheck（无 running）：空清单 + 引导 hint', () => {
  const sb = sandbox();
  try {
    const r = cli(['guide'], sb);
    assert.equal(r.status, 0, r.stderr);
    const sc = JSON.parse(r.stdout).startupCheck;
    assert.deepStrictEqual(sc.running, []);
    assert.equal(sc.staleCount, 0);
    assert.match(sc.hint, /无运行中的 run/);
  } finally {
    cleanup(sb);
  }
});

test('startupCheck（有 running）：行含 runId/title/位置概要 + resumeCommand（沙箱 run start 造 run）', () => {
  const sb = sandbox();
  try {
    const s = cli(['run', 'start', '--title', 'resume 优先呈现', '--project', sb.project], sb);
    assert.equal(s.status, 0, s.stderr);
    const runId = JSON.parse(s.stdout).runId;

    const r = cli(['guide'], sb);
    assert.equal(r.status, 0, r.stderr);
    const sc = JSON.parse(r.stdout).startupCheck;
    assert.equal(sc.running.length, 1);
    const row = sc.running[0];
    assert.equal(row.runId, runId);
    assert.equal(row.title, 'resume 优先呈现');
    assert.equal(row.resumeCommand, `resume --run-id ${runId}`);
    assert.ok(row.currentStage.length); // 位置概要（requirement:01）
    assert.match(sc.hint, /存在运行中的 run/);
    assert.match(sc.hint, /继续/);
    assert.match(sc.hint, /新开/);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- 确定性

test('确定性：同环境两次 guide 输出逐字节等值（AC 一致性的可测形式）', () => {
  const sb = sandbox();
  try {
    const s = cli(['run', 'start', '--title', '确定性', '--project', sb.project], sb);
    assert.equal(s.status, 0, s.stderr);
    const r1 = cli(['guide'], sb);
    const r2 = cli(['guide'], sb);
    assert.equal(r1.status, 0, r1.stderr);
    assert.equal(r2.status, 0, r2.stderr);
    assert.strictEqual(r1.stdout, r2.stdout); // 同输入必同输出（无时间戳/随机源）
  } finally {
    cleanup(sb);
  }
});
