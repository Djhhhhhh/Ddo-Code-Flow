'use strict';
// 协议解析 skill:// project:// run://（G9 / DEC-4）。
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { resolveProtocol } = require('../lib/protocol');

const ctx = { skillRoot: '/skill', projectRoot: '/proj', worktreePath: '/wt' };

describe('协议解析（G9 / DEC-4）', () => {
  it('skill:// → skillRoot', () => {
    assert.equal(
      resolveProtocol('skill://atom-tasks/spec/spec.output.schema.json', ctx),
      path.join('/skill', 'atom-tasks/spec/spec.output.schema.json')
    );
  });

  it('project:// → projectRoot', () => {
    assert.equal(resolveProtocol('project://.ddo/hooks/x.js', ctx), path.join('/proj', '.ddo/hooks/x.js'));
  });

  it('run:// → worktreePath（无重复 .ddo/runs）', () => {
    assert.equal(resolveProtocol('run://.ddo/runs/feat/x/spec.md', ctx), path.join('/wt', '.ddo/runs/feat/x/spec.md'));
  });

  it('未知前缀 exit 2', () => {
    assert.throws(() => resolveProtocol('foo://x', ctx), (e) => e.exitCode === 2);
  });
});
