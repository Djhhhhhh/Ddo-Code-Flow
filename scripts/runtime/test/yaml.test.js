'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const yaml = require('../lib/yaml');

describe('受限 YAML parser', () => {
  it('支持空容器与 block list', () => {
    assert.deepEqual(yaml.parse('produces: []\noptions: {}\nitems:\n  - one\n  - two\n'), { produces: [], options: {}, items: ['one', 'two'] });
  });
  it('拒绝非空 flow array/object，并报告来源行号', () => {
    assert.throws(() => yaml.parse('x: [one]\n', { source: 'task.md' }), /task\.md:1.*flow-style array/);
    assert.throws(() => yaml.parse('x: { one: two }\n', { source: 'task.md' }), /task\.md:1.*flow-style object/);
  });
});
