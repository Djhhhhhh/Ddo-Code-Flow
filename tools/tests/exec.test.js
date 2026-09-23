'use strict';
// tools/tests/exec.test.js — exec 组装器行为测试（05 plan v1.0 契约）。
//
// 隔离约定（同 cli.test.js）：每用例 mkdtemp 独立沙箱，DDO_HOME 指向沙箱内，
// state 与 ctx 产物只写沙箱；finally 递归删除，不触碰真实 ~/.ddo。
// 原子任务本体直接读仓库 atom-tasks/（只读，三个 v2 样例）。

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI = path.join(__dirname, '..', 'cli.js');

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddo-exec-test-'));
  return {
    dir,
    ddoHome: path.join(dir, 'ddo-home'),
    statePath: path.join(dir, 'run', '.state.json'),
    runDir: path.join(dir, 'run'),
  };
}

function cleanup(sb) {
  fs.rmSync(sb.dir, { recursive: true, force: true });
}

function cli(args, sb) {
  return spawnSync(process.execPath, [CLI, ...args], {
    env: { ...process.env, DDO_HOME: sb.ddoHome },
    encoding: 'utf8',
  });
}

function writeState(sb, extra = {}) {
  fs.mkdirSync(sb.runDir, { recursive: true });
  const state = {
    runId: '20260922-120000-t001',
    title: 'exec 测试',
    startedAt: '2026-09-22T12:00:00+08:00',
    git: { mainBranch: 'main', worktreePath: sb.dir },
    currentStage: ['spec:01'],
    stages: {
      spec: { status: 'running', dependOn: [], at: '2026-09-22T12:00:01+08:00' },
    },
    atomTasks: {},
    ...extra,
  };
  fs.writeFileSync(sb.statePath, `${JSON.stringify(state, null, 2)}\n`);
  return state;
}

const put = (sb, file, content) => {
  fs.writeFileSync(path.join(sb.runDir, file), content);
};

// ---------------------------------------------------------------- 基础与错误路径

test('exec：任务不存在 / 相位未声明 → exit 1；--task 非法 → exit 2', () => {
  const sb = sandbox();
  try {
    writeState(sb);
    assert.equal(cli(['exec', '--state', sb.statePath, '--task', 'no-such-task'], sb).status, 1);
    put(sb, 'requirement.md', '# 需求\n做一个功能');
    assert.equal(cli(['exec', '--state', sb.statePath, '--task', 'spec', '--phase', '03'], sb).status, 1);
    assert.equal(cli(['exec', '--state', sb.statePath, '--task', '../evil'], sb).status, 2);
    assert.equal(cli(['exec', '--state', sb.statePath], sb).status, 2);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- 相位切片（D8）

test('exec spec :01：只含相位 01 指令，不含 :02 确认门；ctx 注入 requirement 全文', () => {
  const sb = sandbox();
  try {
    writeState(sb);
    put(sb, 'requirement.md', '# 需求原文\n支持暗黑模式');
    const r = cli(['exec', '--state', sb.statePath, '--task', 'spec'], sb);
    assert.equal(r.status, 0);
    const out = r.stdout;
    assert.match(out, /生成 Alignment Spec/);          // :01 指令
    assert.doesNotMatch(out, /确认门/);                 // :02 不进（渐进切片）
    assert.match(out, /## Context: Requirement/);      // ctx 动态注入
    assert.match(out, /支持暗黑模式/);                  // requirement 全文
    assert.match(out, /不得改写或概括用户需求原文/);      // defaults.rules
    assert.match(out, /## Output Contract（产出契约：spec\.md）/); // schema 契约注入（生成侧）
    assert.match(out, /完整示例/);                       // schema.example 渲染
    assert.match(out, /BQ-\{N\}/);                       // idPattern 进入契约
    assert.ok(!out.startsWith('{'), '输出必须是裸文本而非 JSON');
  } finally {
    cleanup(sb);
  }
});

test('exec spec :02：含 L2 交互硬约束 + 待确认 spec 注入；:01 指令不重喂', () => {
  const sb = sandbox();
  try {
    writeState(sb, { currentStage: ['spec:02'] });
    put(sb, 'requirement.md', '# 需求原文\n支持暗黑模式');
    put(sb, 'spec.md', '# Spec（草稿）\nFR-1 暗黑模式');
    const r = cli(['exec', '--state', sb.statePath, '--task', 'spec', '--phase', '02'], sb);
    assert.equal(r.status, 0);
    const out = r.stdout;
    assert.match(out, /交互硬约束/);                     // L2 置顶强化
    assert.match(out, /AskUserQuestion/);               // 指定宿主工具
    assert.match(out, /## Context: Alignment Spec（待确认）/);
    assert.match(out, /FR-1 暗黑模式/);                  // :01 产物流入 :02
    assert.doesNotMatch(out, /生成 Alignment Spec/);    // :01 指令不重喂（指令渐进）
  } finally {
    cleanup(sb);
  }
});

test('exec spec :02 缺 spec.md（必需 ctx 缺失）→ exit 1', () => {
  const sb = sandbox();
  try {
    writeState(sb, { currentStage: ['spec:02'] });
    put(sb, 'requirement.md', '# 需求\nx');
    assert.equal(cli(['exec', '--state', sb.statePath, '--task', 'spec', '--phase', '02'], sb).status, 1);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- 配置三层合并（P3）

test('配置三层合并：标量覆盖、rules 拼接（任务默认 → 用户级 → run 级）', () => {
  const sb = sandbox();
  try {
    writeState(sb, {
      atomTasks: { spec: { extra_ctx: 'run 级扩展', rules: ['run 级规则'] } },
    });
    put(sb, 'requirement.md', '# 需求\nx');
    fs.mkdirSync(sb.ddoHome, { recursive: true });
    fs.writeFileSync(path.join(sb.ddoHome, 'atom-tasks.json'), JSON.stringify({
      spec: { extra_ctx: '用户级扩展', rules: ['用户级规则'] },
    }));
    const r = cli(['exec', '--state', sb.statePath, '--task', 'spec'], sb);
    assert.equal(r.status, 0);
    const out = r.stdout;
    assert.match(out, /run 级扩展/);                    // 标量：run 级覆盖用户级
    assert.doesNotMatch(out, /用户级扩展/);
    const lines = out.split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2));
    const i1 = lines.indexOf('不得改写或概括用户需求原文'); // 任务默认
    const i2 = lines.indexOf('用户级规则');                 // 用户级
    const i3 = lines.indexOf('run 级规则');                // run 级
    assert.ok(i1 !== -1 && i2 !== -1 && i3 !== -1, '三层 rules 均在');
    assert.ok(i1 < i2 && i2 < i3, 'rules 按层序拼接');
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- coding / git-worktree 样例

test('exec coding：单相位全文件指令 + 存在性容错 ctx（缺 test-plan 不失败）', () => {
  const sb = sandbox();
  try {
    writeState(sb, { currentStage: ['coding:01'], stages: { coding: { status: 'running', dependOn: [], at: '...' } } });
    put(sb, 'spec.md', '# Spec\nFR-1');
    put(sb, 'plan.md', '# Plan\n步骤一');
    const r = cli(['exec', '--state', sb.statePath, '--task', 'coding'], sb);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /执行模式/);
    assert.match(r.stdout, /## Context: Alignment Spec/);
    assert.match(r.stdout, /## Context: Plan/);
    assert.doesNotMatch(r.stdout, /## Context: Test Plan/); // 可选缺失不注入不报错
  } finally {
    cleanup(sb);
  }
});

test('exec coding：tasks 目录存在时注入 task 文件', () => {
  const sb = sandbox();
  try {
    writeState(sb, { currentStage: ['coding:01'], stages: { coding: { status: 'running', dependOn: [], at: '...' } } });
    put(sb, 'spec.md', '# Spec');
    put(sb, 'plan.md', '# Plan');
    fs.mkdirSync(path.join(sb.runDir, 'tasks'));
    fs.writeFileSync(path.join(sb.runDir, 'tasks', 'task-01.md'), '# 任务一\n实现 A');
    fs.writeFileSync(path.join(sb.runDir, 'tasks', 'task-02.md'), '# 任务二\n实现 B');
    const r = cli(['exec', '--state', sb.statePath, '--task', 'coding'], sb);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /## Context: Tasks/);
    assert.match(r.stdout, /### task-01\.md/);
    assert.match(r.stdout, /实现 B/);
  } finally {
    cleanup(sb);
  }
});

// ---------------------------------------------------------------- 工作目录弱依赖（09：state 现算，全任务统一）

const WORKDIR_CODING = { currentStage: ['coding:01'], stages: { coding: { status: 'running', dependOn: [], at: '...' } } };

test('exec coding 工作目录：worktreePath 非空 → worktree 分支（声明路径 + 主工作树禁触）', () => {
  const sb = sandbox();
  try {
    writeState(sb, WORKDIR_CODING); // 夹具默认 git.worktreePath = sb.dir
    put(sb, 'spec.md', '# Spec');
    put(sb, 'plan.md', '# Plan');
    const r = cli(['exec', '--state', sb.statePath, '--task', 'coding'], sb);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /## Context: 工作目录/);
    assert.match(r.stdout, new RegExp(`生效工作目录：${sb.dir.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}`));
    assert.match(r.stdout, /不得触碰主工作树/);
    assert.doesNotMatch(r.stdout, /不涉及 worktree/);
  } finally {
    cleanup(sb);
  }
});

test('exec coding 工作目录：worktreePath 缺失 / 空串 / git 对象缺失 → projectRoot 分支；不含 worktree 硬约束', () => {
  const sb = sandbox();
  try {
    for (const [label, extra] of [
      ['worktreePath 缺失', { git: { mainBranch: 'main' } }],
      ['worktreePath 空串', { git: { mainBranch: 'main', worktreePath: '' } }],
      ['git 对象缺失', { git: undefined }],
    ]) {
      writeState(sb, { ...WORKDIR_CODING, ...extra });
      put(sb, 'spec.md', '# Spec');
      put(sb, 'plan.md', '# Plan');
      const r = cli(['exec', '--state', sb.statePath, '--task', 'coding'], sb);
      assert.equal(r.status, 0, label);
      assert.match(r.stdout, /## Context: 工作目录/, label);
      assert.match(r.stdout, /（当前项目目录）/, label);
      assert.match(r.stdout, /不涉及 worktree/, label);
      assert.doesNotMatch(r.stdout, /不得触碰主工作树/, label);
      assert.doesNotMatch(r.stdout, /git\.worktreePath` 指向的工作树/, label); // 旧硬约束不得残留
      assert.match(r.stdout, /仅在「Context: 工作目录」声明的生效目录内/, label); // 新约束引用注入结果
    }
  } finally {
    cleanup(sb);
  }
});

test('exec verification：工作目录 ctx 与 coding 同源（共享判定，AC-5）', () => {
  const sb = sandbox();
  try {
    writeState(sb, {
      currentStage: ['verification:01'],
      stages: { verification: { status: 'running', dependOn: [], at: '...' } },
      git: { mainBranch: 'main' }, // projectRoot 分支
    });
    put(sb, 'spec.md', '# Spec');
    const r = cli(['exec', '--state', sb.statePath, '--task', 'verification'], sb);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /## Context: 工作目录/);
    assert.match(r.stdout, /（当前项目目录）/);
    assert.match(r.stdout, /在「Context: 工作目录」声明的生效目录中执行/);
  } finally {
    cleanup(sb);
  }
});

test('exec git-worktree：requirement 必需，缺失 exit 1；存在时注入并输出裸文本', () => {
  const sb = sandbox();
  try {
    writeState(sb, { currentStage: ['git-worktree:01'], stages: { 'git-worktree': { status: 'running', dependOn: [], at: '...' } } });
    assert.equal(cli(['exec', '--state', sb.statePath, '--task', 'git-worktree'], sb).status, 1);
    put(sb, 'requirement.md', '# 需求\n添加导出功能');
    const r = cli(['exec', '--state', sb.statePath, '--task', 'git-worktree'], sb);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /添加导出功能/);
    assert.match(r.stdout, /任何 git 命令失败立即暂停报告/); // defaults.rules 注入
  } finally {
    cleanup(sb);
  }
});
