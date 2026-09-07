'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ROOT, makeSkillRoot, taskMd } = require('./_fixtures');
const { validateDag } = require('../lib/workflow');

describe('validate-dag', () => {
  it('四个真实 workflow 全部通过', () => {
    for (const name of ['lightweight', 'standard', 'guarded', 'issue-driven']) {
      const result = validateDag({ skillRoot: ROOT, workflowPath: `workflows/${name}.json` });
      assert.equal(result.valid, true, result.errors.join('\n'));
    }
  });
  it('拒绝缺失 required producer、done stage、坏 entry/edge 和环', () => {
    const cases = [
      { workflow: { pipeline: [{ stage: 'x', atomTasks: { entry: ['consumer'], nodes: { consumer: {} } } }] }, error: 'spec' },
      { workflow: { pipeline: [{ stage: 'done', atomTasks: { entry: ['producer'], nodes: { producer: {} } } }] }, error: '保留终态' },
      { workflow: { pipeline: [{ stage: 'x', atomTasks: { entry: ['missing'], nodes: { producer: { next: ['missing'] } } } }] }, error: '不存在' },
      { workflow: { pipeline: [{ stage: 'x', atomTasks: { entry: ['producer'], nodes: { producer: { next: ['consumer'] }, consumer: { next: ['producer'] } } } }] }, error: '环' },
    ];
    for (const item of cases) {
      const root = makeSkillRoot({
        tasks: {
          producer: { md: taskMd({ produces: [{ role: 'out' }] }) },
          consumer: { md: taskMd({ consumes: [{ role: 'spec', required: true }] }) },
        },
        roles: { out: { kind: 'markdown', file: 'out.md' }, spec: { kind: 'markdown', file: 'spec.md' } },
        workflow: item.workflow,
      });
      const result = validateDag({ skillRoot: root, workflowPath: 'workflows/test.json' });
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((error) => error.includes(item.error)), result.errors.join('\n'));
    }
  });
  it('required producer 必须启用且在 DAG 中拓扑先行', () => {
    for (const producerNode of [{}, { enabled: false }]) {
      const root = makeSkillRoot({
        tasks: {
          producer: { md: taskMd({ produces: [{ role: 'out' }] }) },
          consumer: { md: taskMd({ consumes: [{ role: 'out', required: true }] }) },
        },
        roles: { out: { kind: 'markdown', file: 'out.md' } },
        workflow: { pipeline: [{ stage: 'x', atomTasks: { entry: ['producer', 'consumer'], nodes: { producer: producerNode, consumer: {} } } }] },
      });
      const result = validateDag({ skillRoot: root, workflowPath: 'workflows/test.json' });
      assert.equal(result.valid, false);
      assert.ok(result.errors.some((error) => error.includes('无拓扑先行产出')), result.errors.join('\n'));
    }
  });
});
