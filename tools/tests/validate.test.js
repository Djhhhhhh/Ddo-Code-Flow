'use strict';
// tools/tests/validate.test.js — validate 产出规范化校验测试（05 plan v1.2：.output.schema.json 驱动）。
// 隔离约定同前：mkdtemp 沙箱 + finally 递归删除。

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI = path.join(__dirname, '..', 'cli.js');
const REPO = path.join(__dirname, '..', '..');

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddo-validate-test-'));
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
  fs.writeFileSync(sb.statePath, `${JSON.stringify({
    runId: '20260922-130000-v001',
    title: 'validate 测试',
    startedAt: '2026-09-22T13:00:00+08:00',
    git: { mainBranch: 'main' },
    currentStage: ['spec:01'],
    stages: { spec: { status: 'running', dependOn: [], at: 'x' } },
    atomTasks: {},
    ...extra,
  }, null, 2)}\n`);
}

// 满足 spec.output.schema.json 的合法产物（可选 section 全部省略——可选省略本身合法）
const SPEC_OK = [
  '# 暗黑模式 Spec',
  '## 对齐摘要',
  '- 用户要求支持暗黑模式',
  '- 交付主题切换能力',
  '## 用户目标',
  '- 界面可在明暗间切换',
  '## 范围与非目标',
  '### In Scope',
  '- 主题切换入口',
  '### Non-goals',
  '- 主题编辑器',
  '## 需求对齐',
  '| ID | Agent 对需求的理解 | 来源 | 成功结果 |',
  '|---|---|---|---|',
  '| FR-1 | 支持暗黑模式 | 用户原始要求 | AC-1 |',
  '## 成功结果',
  '| ID | 用户可观察的结果 | Validates | 来源 |',
  '|---|---|---|---|',
  '| AC-1 | 切换后界面变暗 | FR-1 | 用户要求 |',
  '## 用户确认',
  '等待用户批准。',
].join('\n');

test('validate spec :01：产物符合 schema（可选 section 省略）→ exit 0 true', () => {
  const sb = sandbox();
  try {
    writeState(sb);
    fs.writeFileSync(path.join(sb.runDir, 'spec.md'), SPEC_OK);
    const r = cli(['validate', '--state', sb.statePath, '--task', 'spec'], sb);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(JSON.parse(r.stdout), { validated: true });
  } finally {
    cleanup(sb);
  }
});

test('validate：缺必需 section → exit 1；缺必需子节（Non-goals）→ exit 1', () => {
  const sb = sandbox();
  try {
    writeState(sb);
    const noFr = SPEC_OK.split('\n').filter((l) => !l.startsWith('| FR-1') && !l.startsWith('| ID | Agent')).join('\n').replace('## 需求对齐\n', '');
    fs.writeFileSync(path.join(sb.runDir, 'spec.md'), noFr);
    const r1 = cli(['validate', '--state', sb.statePath, '--task', 'spec'], sb);
    assert.equal(r1.status, 1);
    assert.ok(JSON.parse(r1.stdout).errors.some((e) => e.includes('需求对齐')));

    const noNg = SPEC_OK.split('\n').filter((l) => l !== '### Non-goals' && l !== '- 主题编辑器').join('\n');
    fs.writeFileSync(path.join(sb.runDir, 'spec.md'), noNg);
    const r2 = cli(['validate', '--state', sb.statePath, '--task', 'spec'], sb);
    assert.equal(r2.status, 1);
    assert.ok(JSON.parse(r2.stdout).errors.some((e) => e.includes('Non-goals')));
  } finally {
    cleanup(sb);
  }
});

test('validate：占位填充（待定）→ exit 1；表格缺列 → exit 1', () => {
  const sb = sandbox();
  try {
    writeState(sb);
    const lazy = SPEC_OK.replace('- 界面可在明暗间切换', '待定');
    fs.writeFileSync(path.join(sb.runDir, 'spec.md'), lazy);
    const r1 = cli(['validate', '--state', sb.statePath, '--task', 'spec'], sb);
    assert.equal(r1.status, 1);
    assert.ok(JSON.parse(r1.stdout).errors.some((e) => e.includes('用户目标') && e.includes('占位')));

    const noCol = SPEC_OK.replace('| ID | Agent 对需求的理解 | 来源 | 成功结果 |', '| ID | 理解 | 来源 |');
    fs.writeFileSync(path.join(sb.runDir, 'spec.md'), noCol);
    const r2 = cli(['validate', '--state', sb.statePath, '--task', 'spec'], sb);
    assert.equal(r2.status, 1);
    assert.ok(JSON.parse(r2.stdout).errors.some((e) => e.includes('列')));
  } finally {
    cleanup(sb);
  }
});

test('validate：structured-list ID 格式（BQ-1 合法 / Q-1 不合法）', () => {
  const sb = sandbox();
  try {
    writeState(sb);
    const withBq = `${SPEC_OK}\n## 需要用户确认\n- BQ-1 切换是否全局生效（不同答案改变成功结果）\n`;
    fs.writeFileSync(path.join(sb.runDir, 'spec.md'), withBq);
    assert.equal(cli(['validate', '--state', sb.statePath, '--task', 'spec'], sb).status, 0);

    const badBq = `${SPEC_OK}\n## 需要用户确认\n- Q-1 切换是否全局生效\n`;
    fs.writeFileSync(path.join(sb.runDir, 'spec.md'), badBq);
    const r = cli(['validate', '--state', sb.statePath, '--task', 'spec'], sb);
    assert.equal(r.status, 1);
    assert.ok(JSON.parse(r.stdout).errors.some((e) => e.includes('BQ-{N}')));
  } finally {
    cleanup(sb);
  }
});

test('validate：jsonFields 模式（合成 schema 直测 lib）', () => {
  const { validateArtifact } = require(path.join(REPO, 'tools', 'lib', 'output-schema'));
  const schema = { outputFormat: 'json+markdown', jsonFields: [
    { name: 'runId', type: 'string', required: true },
    { name: 'count', type: 'number', required: false },
  ] };
  assert.deepEqual(validateArtifact(schema, '{"runId":"r1"}'), []);
  assert.ok(validateArtifact(schema, '{"count":1}').some((e) => e.includes('runId')));
  assert.ok(validateArtifact(schema, '{"runId":"r1","count":"x"}').some((e) => e.includes('count')));
  assert.ok(validateArtifact(schema, 'not json').length === 1);
});

test('validate：schema 不符合 meta-schema → exit 1（--tasks-dir 沙箱任务）', () => {
  const sb = sandbox();
  try {
    writeState(sb, {
      currentStage: ['demo:01'],
      stages: { demo: { status: 'running', dependOn: [], at: 'x' } },
    });
    const tasksDir = path.join(sb.dir, 'tasks');
    fs.mkdirSync(path.join(tasksDir, 'demo'), { recursive: true });
    fs.writeFileSync(path.join(tasksDir, 'demo', 'prompt.md'), '# demo\n');
    fs.writeFileSync(path.join(tasksDir, 'demo', 'config.json'), JSON.stringify({ name: 'demo', version: '2.0.0', output: 'demo.md' }));
    fs.writeFileSync(path.join(tasksDir, 'demo', 'demo.output.schema.json'), JSON.stringify({ bogus: true }));
    const r = cli(['validate', '--state', sb.statePath, '--task', 'demo', '--tasks-dir', tasksDir], sb);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /meta-schema/);
  } finally {
    cleanup(sb);
  }
});

test('validate spec :02（updates）：存在即过，缺失 exit 1；coding 无声明 skipped；用法错误 exit 2', () => {
  const sb = sandbox();
  try {
    // 07 §4.1：位置对齐——:02 校验要求 currentStage 停在 spec:02
    writeState(sb, {
      currentStage: ['spec:02'],
      stages: { spec: { status: 'waiting-human', dependOn: [], at: 'x' } },
    });
    fs.writeFileSync(path.join(sb.runDir, 'spec.md'), SPEC_OK);
    const ok = cli(['validate', '--state', sb.statePath, '--task', 'spec', '--phase', '02'], sb);
    assert.equal(ok.status, 0);
    assert.equal(JSON.parse(ok.stdout).validated, true);
    // 相位缺省 = 当前相位（P4）：不传 --phase 也校验 :02 的 updates
    const okDefault = cli(['validate', '--state', sb.statePath, '--task', 'spec'], sb);
    assert.equal(okDefault.status, 0);
    assert.equal(JSON.parse(okDefault.stdout).validated, true);

    const sb2 = sandbox();
    try {
      writeState(sb2, {
        currentStage: ['spec:02'],
        stages: { spec: { status: 'waiting-human', dependOn: [], at: 'x' } },
      });
      const bad = cli(['validate', '--state', sb2.statePath, '--task', 'spec', '--phase', '02'], sb2);
      assert.equal(bad.status, 1);
    } finally {
      cleanup(sb2);
    }

    const skipped = cli(['validate', '--state', sb.statePath, '--task', 'coding'], sb);
    assert.equal(skipped.status, 1); // 07 §4.1：coding 不在 currentStage → 位置拦截
    assert.match(skipped.stderr, /执行位置不符/);

    assert.equal(cli(['validate', '--state', sb.statePath], sb).status, 2);
  } finally {
    cleanup(sb);
  }
});

// 占位符 heading 通配（eval dogfooding 修复的回归）：review/test-plan/verification 的
// 契约声明 `{{ 占位符 }}` heading，真实组名必须能命中；字面 heading 仍精确匹配。
test('validate test-plan：占位符 heading（G1\\. {{ 分组名称 }}）匹配真实组名 → exit 0', () => {
  const sb = sandbox();
  try {
    writeState(sb, { currentStage: ['test-plan:01'], stages: { 'test-plan': { status: 'running', dependOn: [], at: 'x' } } });
    fs.writeFileSync(path.join(sb.runDir, 'test-plan.md'), [
      '# X 测试计划',
      '## G1. 发现与渲染',
      '### Checklist',
      '- [ ] cmd: node visualize.js --out out.html',
      '### 通过标准',
      '产物含 SVG。',
      '## G2. 容错',
      '### Checklist',
      '- [ ] human: 浏览器目检',
      '### 通过标准',
      '不崩溃。',
    ].join('\n'));
    const r = cli(['validate', '--state', sb.statePath, '--task', 'test-plan'], sb);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(r.stdout).validated, true);
  } finally {
    cleanup(sb);
  }
});

test('占位符通配不误伤：缺 G 分组仍 exit 1；字面 heading（spec 契约）仍精确匹配', () => {
  const sb = sandbox();
  try {
    writeState(sb, { currentStage: ['test-plan:01'], stages: { 'test-plan': { status: 'running', dependOn: [], at: 'x' } } });
    fs.writeFileSync(path.join(sb.runDir, 'test-plan.md'), '# X 测试计划\n');
    const bad = cli(['validate', '--state', sb.statePath, '--task', 'test-plan'], sb);
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /缺少必需 section/);

    // 字面 heading 精确性：把 spec 产物标题改错一字 → 仍必须拦下（通配只作用于 {{ }} 段）
    writeState(sb, { currentStage: ['spec:01'], stages: { spec: { status: 'running', dependOn: [], at: 'x' } } });
    fs.writeFileSync(path.join(sb.runDir, 'spec.md'), SPEC_OK.replace('## 对齐摘要', '## 对齐摘要X'));
    const badSpec = cli(['validate', '--state', sb.statePath, '--task', 'spec'], sb);
    assert.equal(badSpec.status, 1);
  } finally {
    cleanup(sb);
  }
});
