'use strict';
// compose-config 深合并 + 不落盘（G6 / AC-6）。
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { tmp, write } = require('./_fixtures');
const { composeConfig } = require('../lib/config');

describe('compose-config（G6 / AC-6）', () => {
  it('深合并 default + project + args（对象递归、数组整体替换、标量替换）', () => {
    const skillRoot = tmp();
    const projectRoot = tmp();
    write(path.join(skillRoot, 'config.default.json'), JSON.stringify({ a: { x: 1, arr: [1, 2] }, b: 'd' }));
    write(path.join(projectRoot, '.ddo', 'config.json'), JSON.stringify({ a: { y: 2, arr: [3] }, c: 'p' }));
    const out = composeConfig({ skillRoot, projectRoot, argsJson: JSON.stringify({ a: { z: 3 } }) });
    assert.deepEqual(out, { a: { x: 1, arr: [3], y: 2, z: 3 }, b: 'd', c: 'p' });
  });

  it('不写任何 per-run effective config 文件', () => {
    const skillRoot = tmp();
    const projectRoot = tmp();
    write(path.join(skillRoot, 'config.default.json'), JSON.stringify({ a: 1 }));
    write(path.join(projectRoot, '.ddo', 'config.json'), JSON.stringify({ b: 2 }));
    composeConfig({ skillRoot, projectRoot, argsJson: '{}' });
    assert.deepEqual(fs.readdirSync(path.join(projectRoot, '.ddo')), ['config.json']);
  });
});
