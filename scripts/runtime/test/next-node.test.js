'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { makeSkillRoot, taskMd } = require('./_fixtures');
const { loadWorkflow } = require('../lib/workflow');
const { nextNode } = require('../lib/nodes');

function setup(consume) {
  const root = makeSkillRoot({
    tasks: { plan: { md: taskMd({ consumes: [consume], body: '读取 {{inputs.spec}} 后执行' }) } },
    roles: { spec: { kind: 'markdown', file: 'spec.md' } },
    workflow: { pipeline: [{ stage: 'planning', atomTasks: { entry: ['plan'], nodes: { plan: {} } } }] },
  });
  return { root, workflow: loadWorkflow(root, 'workflows/test.json') };
}

describe('next-node', () => {
  it('注入 required role，缺失时硬失败', () => {
    const { root, workflow } = setup({ role: 'spec', required: true });
    const state = { currentStage: 'planning', artifacts: { spec: { path: 'run://x/spec.md', producer: 'spec', stage: 'spec', at: '2026-01-01T00:00:00Z' } }, history: [] };
    assert.match(nextNode({ state, workflow, skillRoot: root, config: {} }).batch[0].instruction, /run:\/\/x\/spec\.md/);
    assert.throws(() => nextNode({ state: { ...state, artifacts: {} }, workflow, skillRoot: root, config: {} }), /required input/);
  });
  it('optional 缺失注入空字符串并返回审计事件', () => {
    const { root, workflow } = setup({ role: 'spec', required: false });
    const result = nextNode({ state: { currentStage: 'planning', artifacts: {}, history: [] }, workflow, skillRoot: root, config: {} });
    assert.equal(result.batch[0].instruction.includes('{{inputs.spec}}'), false);
    assert.deepEqual(result.optionalMissingRoles, [{ node: 'plan', role: 'spec' }]);
    assert.equal(result.historyEvents[0].event, 'optional-input-missing');
  });
  it('disabled node 不调度，nodeName 与 taskRef 分离', () => {
    const root = makeSkillRoot({
      tasks: { shared: { md: taskMd() } }, roles: {},
      workflow: { pipeline: [{ stage: 'x', atomTasks: { entry: ['a', 'b'], nodes: { a: { taskRef: 'shared' }, b: { taskRef: 'shared', enabled: false } } } }] },
    });
    const workflow = loadWorkflow(root, 'workflows/test.json');
    const result = nextNode({ state: { currentStage: 'x', artifacts: {}, history: [] }, workflow, skillRoot: root, config: {} });
    assert.deepEqual(result.batch.map((item) => item.node), ['a']);
    assert.equal(result.batch[0].task, 'shared');
  });
  it('只读 runtime 命名空间由 state 注入', () => {
    const root = makeSkillRoot({
      tasks: { report: { md: taskMd({ body: '{{runtime.runId}}|{{runtime.currentStage}}|{{runtime.history}}' }) } }, roles: {},
      workflow: { pipeline: [{ stage: 'reporting', atomTasks: { entry: ['report'], nodes: { report: {} } } }] },
    });
    const workflow = loadWorkflow(root, 'workflows/test.json');
    const state = { currentStage: 'reporting', runId: 'run-1', artifacts: {}, stages: {}, history: [{ event: 'created' }] };
    const instruction = nextNode({ state, workflow, skillRoot: root, config: {} }).batch[0].instruction;
    assert.equal(instruction, 'run-1|reporting|[{"event":"created"}]');
  });
});
