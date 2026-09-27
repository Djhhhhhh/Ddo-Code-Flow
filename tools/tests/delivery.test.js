'use strict';
// tools/tests/delivery.test.js — 交付收尾链结构级测试（pr-delivery / pr-delivery-issue）。
//
// 覆盖：list workflows 新预设与阶段链（AC-1）、list tasks 新任务（相位/人审位/旋钮）、
// run start 物化与旋钮不预填（无 default）、deliver-pr 合并确认门的开门/拦截/决议放行
// 与 DAG 点亮（AC-3 前半）、link-issue 的 pr-info 必需上下文（正例/缺失拦截）、
// exec 的产出契约注入。预设与任务直读仓库 workflows/、atom-tasks/（只读）。
// 隔离约定同前：mkdtemp 沙箱 + DDO_HOME 指内 + finally 递归删除。

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI = path.join(__dirname, '..', 'cli.js');

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddo-delivery-test-'));
  const sb = { dir, ddoHome: path.join(dir, 'ddo-home'), project: path.join(dir, 'proj') };
  fs.mkdirSync(sb.project, { recursive: true });
  return sb;
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

function startRun(sb, workflow) {
  const r = cli(['run', 'start', '--title', '交付收尾测试', '--project', sb.project, '--workflow', workflow], sb);
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

const PR_INFO = '# PR 信息\n\n## PR 信息\n\n- PR 编号：#57\n- URL：https://github.com/owner/repo/pull/57\n- 源分支：feat/demo\n- base 分支：main\n- 状态：ready（非 draft）\n- 创建时间：2026-09-27 19:30\n';

// ---------------------------------------------------------------- 注册表与清单（AC-1）

test('list workflows：两条交付预设入清单且阶段链正确，basic/standard 不受影响', () => {
  const sb = sandbox();
  try {
    const out = JSON.parse(cli(['list', 'workflows'], sb).stdout);
    const pd = out.workflows.find((w) => w.name === 'pr-delivery');
    assert.equal(pd.version, '1.0.0');
    assert.match(pd.description, /交付收尾链/);
    assert.deepEqual(pd.stages, ['deliver-pr', 'cleanup-worktree']);

    const pdi = out.workflows.find((w) => w.name === 'pr-delivery-issue');
    assert.deepEqual(pdi.stages, ['deliver-pr', 'link-issue', 'cleanup-worktree']);

    assert.ok(out.workflows.some((w) => w.name === 'basic')); // 存量预设不受影响
    assert.ok(out.workflows.some((w) => w.name === 'standard'));
  } finally {
    cleanup(sb);
  }
});

test('list tasks：deliver-pr 两相位（action+human 门）、link-issue 单相位，旋钮无 default 不预填提示', () => {
  const sb = sandbox();
  try {
    const out = JSON.parse(cli(['list', 'tasks'], sb).stdout);
    const dp = out.tasks.find((t) => t.name === 'deliver-pr');
    assert.match(dp.desc, /正式 PR/);
    assert.deepEqual(dp.phases.map((p) => `${p.id}:${p.type}`), ['01:action', '02:human']);
    assert.deepEqual(dp.configurable.map((c) => c.key), ['baseBranch']);
    assert.equal(dp.configurable[0].default, undefined);

    const li = out.tasks.find((t) => t.name === 'link-issue');
    assert.deepEqual(li.phases.map((p) => `${p.id}:${p.type}`), ['01:action']);
    assert.deepEqual(li.configurable.map((c) => c.key), ['issueNumber']);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- run start 物化

test('run start --workflow pr-delivery：物化两阶段 DAG，起点 deliver-pr:01，无 default 旋钮不预填', () => {
  const sb = sandbox();
  try {
    const out = startRun(sb, 'pr-delivery');
    assert.deepEqual(out.currentStage, ['deliver-pr:01']);
    assert.deepEqual(out.openedGates, []);
    const state = JSON.parse(fs.readFileSync(out.statePath, 'utf8'));
    assert.deepEqual(Object.keys(state.stages), ['deliver-pr', 'cleanup-worktree']);
    assert.equal(state.stages['cleanup-worktree'].status, 'pending');
    assert.deepEqual(state.atomTasks, {}); // baseBranch 无 default → 不预填
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- 合并确认门（AC-3 前半）

test('deliver-pr 门：01 契约注入 → 产物校验 → 开门（已合并/未合并）→ 无决议拦截 → 已合并放行点亮 link-issue', () => {
  const sb = sandbox();
  try {
    const out = startRun(sb, 'pr-delivery-issue');
    const sp = out.statePath;
    const runDir = path.dirname(sp);

    // 相位 01：exec 注入 pr-info 产出契约
    const ex1 = cli(['exec', '--state', sp, '--task', 'deliver-pr'], sb);
    assert.equal(ex1.status, 0, ex1.stderr);
    assert.match(ex1.stdout, /Output Contract（产出契约：pr-info\.md）/);
    assert.match(ex1.stdout, /不得携带 draft 标志/); // ready 决议固化为任务规则

    // 产出 pr-info.md 并校验
    fs.writeFileSync(path.join(runDir, 'pr-info.md'), PR_INFO);
    assert.equal(JSON.parse(cli(['validate', '--state', sp, '--task', 'deliver-pr'], sb).stdout).validated, true);

    // 推进至相位 02：开门
    const n1 = cli(['next', '--state', sp], sb);
    assert.equal(n1.status, 0, n1.stderr);
    const j1 = JSON.parse(n1.stdout);
    assert.deepEqual(j1.currentStage, ['deliver-pr:02']);
    assert.equal(j1.openedGates.length, 1);
    assert.deepEqual(j1.openedGates[0].options.map((o) => o.name), ['已合并', '未合并']);
    assert.equal(j1.openedGates[0].options[1].action, 'in-phase'); // 未合并 = 相位内交互，不推进

    // 相位 02：exec 必需注入 pr-info（呈现数据）
    const ex2 = cli(['exec', '--state', sp, '--task', 'deliver-pr', '--phase', '02'], sb);
    assert.equal(ex2.status, 0, ex2.stderr);
    assert.match(ex2.stdout, /Context: PR 信息/);
    assert.match(ex2.stdout, /@interact|宿主提问工具/); // 门呈现硬约束

    // 门未决推进 → 拦截（结构性「未确认不清理」）
    const n2 = cli(['next', '--state', sp], sb);
    assert.equal(n2.status, 1);
    assert.match(`${n2.stderr}\n${n2.stdout}`, /已合并/);

    // #53 交互协议：决议前必须正式呈现，否则被结构拦截
    const nDec = cli(['next', '--state', sp, '--decision', '已合并'], sb);
    assert.equal(nDec.status, 1);
    assert.match(`${nDec.stderr}\n${nDec.stdout}`, /呈现未更新|gate present/);
    const gp = cli(['gate', 'present', '--state', sp], sb);
    assert.equal(gp.status, 0, gp.stderr);

    // 决议放行：deliver-pr 完成，DAG 点亮 link-issue
    const n3 = cli(['next', '--state', sp, '--decision', '已合并'], sb);
    assert.equal(n3.status, 0, n3.stderr);
    const j3 = JSON.parse(n3.stdout);
    assert.deepEqual(j3.finished, ['deliver-pr']);
    assert.deepEqual(j3.activated, ['link-issue']);
    assert.deepEqual(j3.currentStage, ['link-issue:01']);
    assert.deepEqual(j3.closedGates.map((g) => g.decision), ['已合并']);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- link-issue 上下文契约

test('link-issue：pr-info 在场注入 Context；缺失时 exec 硬失败（必需上下文）', () => {
  const sb = sandbox();
  try {
    // 缺失路径：纯状态推进到 link-issue（next 不校验产物），pr-info 未产出 → exec 拦截
    const bare = startRun(sb, 'pr-delivery-issue');
    cli(['next', '--state', bare.statePath], sb); // → deliver-pr:02 开门
    cli(['gate', 'present', '--state', bare.statePath], sb); // #53：决议前正式呈现
    cli(['next', '--state', bare.statePath, '--decision', '已合并'], sb); // → link-issue:01
    const miss = cli(['exec', '--state', bare.statePath, '--task', 'link-issue'], sb);
    assert.equal(miss.status, 1);
    assert.match(`${miss.stderr}\n${miss.stdout}`, /必需上下文缺失/);

    // 正常路径：pr-info 在场 → 注入；产出 issue-link.md 校验后点亮 cleanup-worktree
    const ok = startRun(sb, 'pr-delivery-issue');
    const runDir = path.dirname(ok.statePath);
    fs.writeFileSync(path.join(runDir, 'pr-info.md'), PR_INFO);
    cli(['next', '--state', ok.statePath], sb);
    cli(['gate', 'present', '--state', ok.statePath], sb); // #53：决议前正式呈现
    cli(['next', '--state', ok.statePath, '--decision', '已合并'], sb);
    const ex = cli(['exec', '--state', ok.statePath, '--task', 'link-issue'], sb);
    assert.equal(ex.status, 0, ex.stderr);
    assert.match(ex.stdout, /Context: PR 信息/);
    assert.match(ex.stdout, /禁止从分支名解析/);

    fs.writeFileSync(path.join(runDir, 'issue-link.md'),
      '# Issue 关联\n\n## 关联信息\n\n- issue：#12\n- PR：#57（https://github.com/owner/repo/pull/57）\n- 评论：https://github.com/owner/repo/issues/12#issuecomment-1\n');
    assert.equal(JSON.parse(cli(['validate', '--state', ok.statePath, '--task', 'link-issue'], sb).stdout).validated, true);

    const n = cli(['next', '--state', ok.statePath], sb);
    const jn = JSON.parse(n.stdout);
    assert.deepEqual(jn.currentStage, ['cleanup-worktree:01']); // 变体链终点阶段点亮
  } finally {
    cleanup(sb);
  }
});
