'use strict';
// ddo.js CLI 入口的退出码与分派契约（G1 / AC-1）。
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const path = require('path');
const { ROOT, tmp, write } = require('./_fixtures');

const DDO = path.join(__dirname, '..', 'ddo.js');

function run(args) {
  return spawnSync(process.execPath, [DDO, ...args], { encoding: 'utf8' });
}

describe('ddo.js CLI 契约（G1 / AC-1）', () => {
  it('无子命令返回 exit 2 用法错误', () => {
    const r = run([]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /Subcommands|用法|usage/i);
  });

  it('compose-config 缺必需参数返回 exit 2', () => {
    const r = run(['compose-config']);
    assert.equal(r.status, 2);
  });

  it('--help 返回 exit 0', () => {
    const r = run(['compose-config', '--help']);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /compose-config/);
  });

  it('裸 --help 返回 exit 0（无子命令）', () => {
    const r = run(['--help']);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Subcommands/);
  });

  it('裸 -h 返回 exit 0', () => {
    const r = run(['-h']);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Subcommands/);
  });

  it('gate --action pending 返回 exit 77', () => {
    const dir = tmp();
    const statePath = path.join(dir, '.state.json');
    write(statePath, JSON.stringify({ currentStage: 'spec', stages: {}, history: [] }));
    const r = run(['gate', '--skill-root', ROOT, '--state', statePath, '--stage', 'spec', '--action', 'pending']);
    assert.equal(r.status, 77, r.stderr);
    assert.match(r.stdout, /pending/);
  });

  it('未知子命令返回 exit 2', () => {
    const r = run(['nope']);
    assert.equal(r.status, 2);
  });

  it('validate-dag 对真实 guarded.json 返回 exit 0', () => {
    const r = run(['validate-dag', '--skill-root', ROOT, '--workflow', 'workflows/guarded.json']);
    assert.equal(r.status, 0, r.stderr);
  });
});
