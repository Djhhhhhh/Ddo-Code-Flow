'use strict';
// next-node Kahn 选批 + 角色注入 + options 合并（G7 / AC-7）。
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { makeSkillRoot, taskMd } = require('./_fixtures');
const { loadWorkflow } = require('../lib/workflow');
const { nextNode, mergeOptions } = require('../lib/nodes');

describe('next-node（G7 / AC-7）', () => {
  it('{{inputs.<role>}} 已替换为上游产物路径', () => {
    const skillRoot = makeSkillRoot({
      tasks: { plan: { md: taskMd({ consumes: [{ role: 'spec' }], body: '读取 {{inputs.spec}} 后执行' }) } },
      roles: { spec: { kind: 'markdown', file: 'spec.md' } },
      workflow: { pipeline: [{ stage: 'planning', atomTasks: { entry: ['plan'], nodes: { plan: {} } } }] },
    });
    const workflow = loadWorkflow(skillRoot, 'workflows/test.json');
    const state = {
      currentStage: 'planning',
      artifacts: { spec: { path: 'run://.ddo/runs/feat/x/spec.md', producer: 'spec', stage: 'spec', at: '2026-08-24T00:00:00.000Z' } },
      history: [],
    };
    const r = nextNode({ state, workflow, skillRoot, config: {} });
    assert.equal(r.batch.length, 1);
    const inst = r.batch[0].instruction;
    assert.ok(inst.includes('run://.ddo/runs/feat/x/spec.md'));
    assert.ok(!inst.includes('{{inputs.spec}}'));
  });

  it('options 按 workflow > config > node > atom-task 优先级合并', () => {
    const out = mergeOptions(
      { a: 'default', b: 'default-b', c: 'default-c', d: 'default-d' },
      { b: 'node', c: 'node' },
      { c: 'config', enabled: true, model: 'guarded' },
      { c: 'workflow', d: 'workflow' }
    );
    assert.deepEqual(out, { a: 'default', b: 'node', c: 'workflow', d: 'workflow' });
  });

  it('Kahn 拓扑选批（入度 0 节点为一批）', () => {
    const skillRoot = makeSkillRoot({
      tasks: {
        a: { md: taskMd({ produces: [{ role: 'spec' }] }) },
        b: { md: taskMd({ produces: [{ role: 'plan' }] }) },
      },
      roles: { spec: { kind: 'markdown', file: 'spec.md' }, plan: { kind: 'markdown', file: 'plan.md' } },
      workflow: { pipeline: [{ stage: 'spec', atomTasks: { entry: ['a'], nodes: { a: { next: ['b'] }, b: {} } } }] },
    });
    const workflow = loadWorkflow(skillRoot, 'workflows/test.json');
    const state = { currentStage: 'spec', artifacts: {}, history: [] };
    const r = nextNode({ state, workflow, skillRoot, config: {} });
    assert.deepEqual(r.batch.map((b) => b.node), ['a']);
  });
});
