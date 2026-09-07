'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { makeSkillRoot, taskMd, tmp, write } = require('./_fixtures');
const { loadWorkflow } = require('../lib/workflow');
const { registerArtifact } = require('../lib/artifacts');

function setup() {
  const root = makeSkillRoot({
    tasks: { writer: { md: taskMd({ produces: [{ role: 'out', primary: true }] }) } },
    roles: { out: { kind: 'markdown', file: 'out.md', dynamic: false }, other: { kind: 'markdown', file: 'other.md', dynamic: false } },
    workflow: { pipeline: [{ stage: 'x', atomTasks: { entry: ['writer'], nodes: { writer: {} } } }] },
  });
  const worktreePath = tmp();
  return {
    root,
    workflow: loadWorkflow(root, 'workflows/test.json'),
    state: { currentStage: 'x', worktreePath, artifactDir: path.join(worktreePath, '.ddo', 'runs', 'feat', '2026-08-29-x'), artifacts: {}, pendingOutputs: {}, history: [] },
  };
}

describe('register-artifact', () => {
  it('原子落盘并只产生 artifact-registered', () => {
    const { root, workflow, state } = setup();
    const result = registerArtifact({ stdin: '正文', role: 'out', producer: 'writer', state, skillRoot: root, workflow });
    assert.equal(fs.readFileSync(result.absPath, 'utf8'), '正文');
    assert.equal(result.historyEvent.event, 'artifact-registered');
    assert.equal(result.historyEvent.role, 'out');
    assert.equal(result.artifactRecord.producer, 'writer');
    assert.equal(result.artifactRecord.task, 'writer');
    assert.equal((state.history || []).some((event) => event.event === 'node-done'), false);
  });
  it('拒绝未登记 role 与 producer 未声明 role', () => {
    const { root, workflow, state } = setup();
    assert.throws(() => registerArtifact({ stdin: 'x', role: 'missing', producer: 'writer', state, skillRoot: root, workflow }), /未在 artifacts/);
    assert.throws(() => registerArtifact({ stdin: 'x', role: 'other', producer: 'writer', state, skillRoot: root, workflow }), /不在 node/);
  });
  it('artifactDir 未就绪时返回结构化 pending output', () => {
    const { root, workflow, state } = setup();
    state.artifactDir = null;
    state.worktreePath = null;
    const result = registerArtifact({ stdin: '多行\n内容', role: 'out', producer: 'writer', state, skillRoot: root, workflow });
    assert.equal(result.status, 'pending');
    assert.equal(Buffer.from(result.pendingOutput.content, 'base64').toString('utf8'), '多行\n内容');
    assert.equal(result.historyEvent.event, 'artifact-pending');
  });
  it('output 校验失败不留下最终文件', () => {
    const { root, workflow, state } = setup();
    const taskPath = path.join(root, 'atom-tasks', 'writer', 'writer.md');
    const markdown = fs.readFileSync(taskPath, 'utf8').replace('\n---\n\n', '\noutputSchemaRef: "skill://atom-tasks/writer/out.output.schema.json"\n---\n\n');
    write(taskPath, markdown);
    write(path.join(root, 'atom-tasks', 'writer', 'out.output.schema.json'), JSON.stringify({
      description: 'out', outputFormat: 'markdown', document: { title: 'out', titleFormat: '固定文本', description: 'out' },
      sections: [{ heading: 'Required', level: 2, required: true, format: 'text' }],
    }));
    assert.throws(() => registerArtifact({ stdin: '# no', role: 'out', producer: 'writer', state, skillRoot: root, workflow }), /产物校验失败/);
    assert.equal(fs.existsSync(path.join(state.artifactDir, 'out.md')), false);
  });
  it('artifactDir 越出 worktree 时在写文件前失败', () => {
    const fixture = setup();
    const outside = tmp();
    fixture.state.artifactDir = outside;
    assert.throws(() => registerArtifact({ stdin: '# Doc\n\n正文', role: 'out', producer: 'writer', state: fixture.state, skillRoot: fixture.root, workflow: fixture.workflow }), /artifactDir 路径越界/);
    assert.equal(fs.existsSync(path.join(outside, 'out.md')), false);
  });
});
