'use strict';
// ~/.ddo/index.json 纯指针注册表（基线 §4）：
// { "<runId>": { "statePath": "...", "startedAt": "..." } }
// 读改写一律持锁 + 原子写（基线 §8）。

const fs = require('fs');
const path = require('path');
const os = require('os');
const { atomicWrite, withLock } = require('./fsutil');

function ddoHome() {
  return process.env.DDO_HOME || path.join(os.homedir(), '.ddo');
}

function indexPath(home = ddoHome()) {
  return path.join(home, 'index.json');
}

function lockPath(home = ddoHome()) {
  return path.join(home, '.index.lock');
}

function readAll(home = ddoHome()) {
  try {
    return JSON.parse(fs.readFileSync(indexPath(home), 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw e;
  }
}

function writeAll(map, home = ddoHome()) {
  atomicWrite(indexPath(home), `${JSON.stringify(map, null, 2)}\n`);
}

/** 注册（幂等覆盖）。entry = { statePath, startedAt }。 */
function register(runId, entry, home = ddoHome()) {
  return withLock(lockPath(home), () => {
    const map = readAll(home);
    map[runId] = { statePath: entry.statePath, startedAt: entry.startedAt };
    writeAll(map, home);
    return map;
  });
}

/** 移除（不存在时静默幂等）。 */
function unregister(runId, home = ddoHome()) {
  return withLock(lockPath(home), () => {
    const map = readAll(home);
    delete map[runId];
    writeAll(map, home);
    return map;
  });
}

module.exports = { ddoHome, indexPath, lockPath, readAll, register, unregister };
