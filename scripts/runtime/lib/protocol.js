'use strict';
const path = require('path');

class ProtocolError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProtocolError';
    this.exitCode = 2;
  }
}

// 三种协议解析：每个协议映射到其「根」，路径是从该根出发的相对路径。
// - skill://X   -> skillRoot + X
// - project://X -> projectRoot + X（X 通常含 .ddo/…）
// - run://X     -> worktreePath + X（X 已含 .ddo/runs/…；修正原 doc §4 的 artifactDir）
function resolveProtocol(ref, ctx) {
  if (typeof ref !== 'string') return ref;
  if (ref.startsWith('skill://')) return path.join(ctx.skillRoot || '.', ref.slice('skill://'.length));
  if (ref.startsWith('project://')) return path.join(ctx.projectRoot || '.', ref.slice('project://'.length));
  if (ref.startsWith('run://')) return path.join(ctx.worktreePath || '.', ref.slice('run://'.length));
  if (ref.includes('://')) throw new ProtocolError(`未知协议: ${ref}`);
  return ref; // 普通路径原样返回
}

module.exports = { resolveProtocol, ProtocolError };
