'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { makeSkillRoot, taskMd } = require('./_fixtures');
const { loadWorkflow } = require('../lib/workflow');
const { resolveEffectiveNode } = require('../lib/effective-node');

describe('effective node', () => {
  it('按 workflow > config > node > task 合并 enabled/options，并保留 model', () => {
    const root = makeSkillRoot({
      tasks: { coding: { md: taskMd({ options: [{ key: 'model', default: 'task', type: 'string' }, { key: 'rounds', default: 1, type: 'integer' }] }) } },
      roles: {},
      workflow: {
        atomTaskOverrides: { coding: { enabled: true, model: 'workflow' } },
        pipeline: [{ stage: 'coding', atomTasks: { entry: ['node-a'], nodes: { 'node-a': { taskRef: 'coding', enabled: false, options: { rounds: 2 } } } } }],
      },
    });
    const workflow = loadWorkflow(root, 'workflows/test.json');
    const result = resolveEffectiveNode({ skillRoot: root, workflow, effectiveConfig: { atomTaskOverrides: { coding: { enabled: false, model: 'project' } } }, stageName: 'coding', nodeName: 'node-a' });
    assert.equal(result.enabled, true);
    assert.deepEqual(result.options, { model: 'workflow', rounds: 2 });
    assert.equal(Object.prototype.hasOwnProperty.call(result.options, 'enabled'), false);
  });
});
