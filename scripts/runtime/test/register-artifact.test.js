'use strict';
// register-artifact 从 stdin 落盘 + 登记 + 追加 history（G3 / AC-3）。
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const { ROOT, tmp } = require('./_fixtures');
const { registerArtifact } = require('../lib/artifacts');

function makeState() {
  const worktree = tmp();
  const artifactDir = path.join(worktree, '.ddo', 'runs', 'feat', '2026-08-24-x');
  return { worktreePath: worktree, artifactDir, type: 'feat', dateDescription: '2026-08-24-x', currentStage: 'planning' };
}

describe('register-artifact（G3 / AC-3）', () => {
  it('stdin 文本落盘到 artifactDir 并返回 {path}', () => {
    const state = makeState();
    const r = registerArtifact({ stdin: '# 计划', role: 'plan', state, skillRoot: ROOT, producer: 'plan', stage: 'planning' });
    assert.ok(fs.existsSync(r.absPath));
    assert.equal(fs.readFileSync(r.absPath, 'utf8'), '# 计划');
    assert.equal(r.path, 'run://.ddo/runs/feat/2026-08-24-x/plan.md');
  });

  it('artifactRecord 登记 role（path/producer/stage/at）', () => {
    const state = makeState();
    const r = registerArtifact({ stdin: 'x', role: 'spec', state, skillRoot: ROOT, producer: 'spec', stage: 'spec' });
    assert.equal(r.artifactRecord.path, 'run://.ddo/runs/feat/2026-08-24-x/spec.md');
    assert.equal(r.artifactRecord.producer, 'spec');
    assert.equal(r.artifactRecord.stage, 'spec');
    assert.ok(r.artifactRecord.at);
  });

  it('historyEvent 为 node-done', () => {
    const state = makeState();
    const r = registerArtifact({ stdin: 'x', role: 'spec', state, skillRoot: ROOT, producer: 'spec', stage: 'spec' });
    assert.equal(r.historyEvent.event, 'node-done');
    assert.equal(r.historyEvent.node, 'spec');
  });
});
