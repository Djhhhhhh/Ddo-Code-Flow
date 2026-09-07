'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, makeSkillRoot, taskMd } = require('./_fixtures');
const { loadAtomTask } = require('../lib/atom-task');

describe('统一 atom-task loader', () => {
  it('真实关键任务全部通过 schema', () => {
    const taskNames = fs.readdirSync(path.join(ROOT, 'atom-tasks'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(ROOT, 'atom-tasks', entry.name, `${entry.name}.md`)))
      .map((entry) => entry.name);
    for (const taskName of taskNames) {
      assert.equal(loadAtomTask({ skillRoot: ROOT, taskName }).name, taskName);
    }
  });
  it('produces 空数组合法', () => {
    const root = makeSkillRoot({ tasks: { empty: { md: taskMd() } }, roles: {}, workflow: { pipeline: [] } });
    assert.deepEqual(loadAtomTask({ skillRoot: root, taskName: 'empty' }).frontmatter.produces, []);
  });
  it('名称不一致与 schema 缺字段均失败并带路径', () => {
    const root = makeSkillRoot({ tasks: { good: { md: taskMd() } }, roles: {}, workflow: { pipeline: [] } });
    const file = path.join(root, 'atom-tasks', 'good', 'good.md');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('name: good', 'name: other'));
    assert.throws(() => loadAtomTask({ skillRoot: root, taskName: 'good' }), (error) => error.exitCode === 1 && error.message.includes(file));
  });
  it('拒绝 option 默认值、enum 和 items 类型错误', () => {
    const cases = [
      ['type', [{ key: 'mode', type: 'integer', default: '1', label: 'mode', description: 'mode' }]],
      ['enum', [{ key: 'mode', type: 'string', default: 'c', label: 'mode', description: 'mode', enum: ['a', 'b'] }]],
      ['items', [{ key: 'models', type: 'array', default: [1], label: 'models', description: 'models', items: { type: 'string' } }]],
    ];
    for (const [name, options] of cases) {
      const root = makeSkillRoot({ tasks: { bad: { md: taskMd({ options }) } }, roles: {}, workflow: { pipeline: [] } });
      assert.throws(() => loadAtomTask({ skillRoot: root, taskName: 'bad' }), new RegExp(name === 'enum' ? 'enum' : name === 'items' ? '数组项' : 'default'));
    }
  });
});
