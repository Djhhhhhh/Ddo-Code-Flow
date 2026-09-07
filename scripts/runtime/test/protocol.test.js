'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { tmp } = require('./_fixtures');
const { resolveProtocol } = require('../lib/protocol');

describe('协议解析与路径安全', () => {
  it('三种协议解析到各自绝对根目录', () => {
    const ctx = { skillRoot: tmp(), projectRoot: tmp(), worktreePath: tmp() };
    assert.equal(resolveProtocol('skill://x/a.json', ctx), path.resolve(ctx.skillRoot, 'x/a.json'));
    assert.equal(resolveProtocol('project://.ddo/x', ctx), path.resolve(ctx.projectRoot, '.ddo/x'));
    assert.equal(resolveProtocol('run://.ddo/runs/feat/x/a.md', ctx), path.resolve(ctx.worktreePath, '.ddo/runs/feat/x/a.md'));
  });
  it('拒绝越界、缺 root 与未知协议', () => {
    const ctx = { skillRoot: tmp(), projectRoot: tmp(), worktreePath: tmp() };
    for (const ref of ['skill://../x', 'project://../x', 'run://../x']) assert.throws(() => resolveProtocol(ref, ctx), /越界/);
    assert.throws(() => resolveProtocol('run://x', {}), /worktreePath/);
    assert.throws(() => resolveProtocol('foo://x', ctx), (error) => error.exitCode === 2);
  });
});
