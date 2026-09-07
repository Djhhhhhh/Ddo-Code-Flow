'use strict';
const path = require('path');

class ProtocolError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProtocolError';
    this.exitCode = 2;
  }
}

function resolveProtocol(ref, ctx = {}) {
  if (typeof ref !== 'string') return ref;
  for (const [prefix, rootKey] of [['skill://', 'skillRoot'], ['project://', 'projectRoot'], ['run://', 'worktreePath']]) {
    if (!ref.startsWith(prefix)) continue;
    const root = ctx[rootKey];
    if (!root) throw new ProtocolError(`${prefix} 解析缺少 ${rootKey}`);
    return resolveWithinRoot(path.resolve(root), ref.slice(prefix.length), ref);
  }
  if (ref.includes('://')) throw new ProtocolError(`未知协议: ${ref}`);
  return ref;
}

function resolveWithinRoot(root, relativePath, originalRef) {
  if (path.isAbsolute(relativePath)) throw new ProtocolError(`协议路径必须为相对路径: ${originalRef}`);
  const resolved = path.resolve(root, relativePath);
  const relative = path.relative(root, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new ProtocolError(`协议路径越界: ${originalRef}`);
  }
  return resolved;
}

module.exports = { resolveProtocol, ProtocolError };
