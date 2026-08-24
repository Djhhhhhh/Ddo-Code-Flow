'use strict';
// validate-dag 角色可达性：拓扑遍历 + produced 集（G5 / AC-5）。
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ROOT, makeSkillRoot, taskMd } = require('./_fixtures');
const { validateDag } = require('../lib/workflow');

describe('validate-dag 角色可达性（G5 / AC-5）', () => {
  it('guarded.json 返回 valid', () => {
    const r = validateDag({ skillRoot: ROOT, workflowPath: 'workflows/guarded.json' });
    assert.equal(r.valid, true, r.errors.join('\n'));
  });

  it('缺失 required consume 的 workflow 返回 valid:false', () => {
    const skillRoot = makeSkillRoot({
      tasks: {
        producer: { md: taskMd({ produces: [{ role: 'spec' }] }) },
        consumer: { md: taskMd({ consumes: [{ role: 'spec2', required: true }] }) },
      },
      roles: {
        spec: { kind: 'markdown', file: 'spec.md' },
        spec2: { kind: 'markdown', file: 'spec2.md' },
      },
      workflow: {
        pipeline: [{
          stage: 'spec',
          atomTasks: { entry: ['producer'], nodes: { producer: { next: ['consumer'] }, consumer: {} } },
        }],
      },
    });
    const r = validateDag({ skillRoot, workflowPath: 'workflows/test.json' });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes('spec2')));
  });

  it('环（cycle）返回 valid:false', () => {
    const skillRoot = makeSkillRoot({
      tasks: {
        a: { md: taskMd({ produces: [{ role: 'spec' }] }) },
        b: { md: taskMd({ produces: [{ role: 'plan' }] }) },
      },
      roles: {
        spec: { kind: 'markdown', file: 'spec.md' },
        plan: { kind: 'markdown', file: 'plan.md' },
      },
      workflow: {
        pipeline: [{
          stage: 'x',
          atomTasks: { entry: ['a'], nodes: { a: { next: ['b'] }, b: { next: ['a'] } } },
        }],
      },
    });
    const r = validateDag({ skillRoot, workflowPath: 'workflows/test.json' });
    assert.equal(r.valid, false);
    assert.ok(r.errors.some((e) => e.includes('环')));
  });
});
