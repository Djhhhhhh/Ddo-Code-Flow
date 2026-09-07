'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, tmp, write } = require('./_fixtures');
const { composeConfig } = require('../lib/config');

describe('compose-config', () => {
  it('规范化 project 扁平字段，保留 task override，过滤 selection args', () => {
    const projectRoot = tmp();
    write(path.join(projectRoot, '.ddo', 'config.json'), JSON.stringify({ defaultRunType: 'fix', contextPaths: ['docs'], atomTaskOverrides: { coding: { model: 'sonnet' } } }));
    const result = composeConfig({ skillRoot: ROOT, projectRoot, argsJson: JSON.stringify({ ctx: 'README.md', model: 'guarded', atomTaskOverrides: { coding: { model: 'opus' } } }) });
    assert.equal(result.base.defaultRunType, 'fix');
    assert.deepEqual(result.base.contextPaths, ['docs']);
    assert.equal(result.atomTaskOverrides.coding.model, 'opus');
    assert.equal(Object.prototype.hasOwnProperty.call(result, 'ctx'), false);
  });
  it('拒绝非法 project config 与未知 run override', () => {
    const projectRoot = tmp();
    write(path.join(projectRoot, '.ddo', 'config.json'), JSON.stringify({ unknown: true }));
    assert.throws(() => composeConfig({ skillRoot: ROOT, projectRoot }), /校验失败/);
    write(path.join(projectRoot, '.ddo', 'config.json'), '{}');
    assert.throws(() => composeConfig({ skillRoot: ROOT, projectRoot, argsJson: '{"unknown":true}' }), /未知 run 参数/);
  });
  it('不物化 effective config 文件', () => {
    const projectRoot = tmp();
    write(path.join(projectRoot, '.ddo', 'config.json'), '{}');
    composeConfig({ skillRoot: ROOT, projectRoot, argsJson: '{}' });
    assert.deepEqual(fs.readdirSync(path.join(projectRoot, '.ddo')), ['config.json']);
  });
  it('拒绝非法 defaults 和非法最终 effective config', () => {
    const skillRoot = tmp();
    for (const file of ['config.schema.json', 'config.default.json']) fs.copyFileSync(path.join(ROOT, file), path.join(skillRoot, file));
    const projectRoot = tmp();
    write(path.join(projectRoot, '.ddo', 'config.json'), '{}');
    write(path.join(skillRoot, 'config.default.json'), '{}');
    assert.throws(() => composeConfig({ skillRoot, projectRoot }), /config\.default\.json 校验失败/);
    fs.copyFileSync(path.join(ROOT, 'config.default.json'), path.join(skillRoot, 'config.default.json'));
    assert.throws(() => composeConfig({ skillRoot, projectRoot, argsJson: JSON.stringify({ configOverrides: { base: { defaultRunType: 'bad' } } }) }), /effective config 校验失败/);
  });
});
