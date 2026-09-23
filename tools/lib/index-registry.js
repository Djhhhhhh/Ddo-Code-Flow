'use strict';
// ~/.ddo/index.json 纯指针注册表（02 基线 §4）：
// { "<runId>": { "statePath": "...", "startedAt": "..." } }
// register / genRunId / freshRunId 随 06 轮 run start 引入。

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
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

/** 注册（02 §4：幂等覆盖），持锁 + 原子写。 */
function register(runId, entry, home = ddoHome()) {
  return withLock(lockPath(home), () => {
    const map = readAll(home);
    map[runId] = { statePath: entry.statePath, startedAt: entry.startedAt };
    atomicWrite(indexPath(home), `${JSON.stringify(map, null, 2)}\n`);
    return map;
  });
}

/** 移除（不存在时静默幂等），持锁 + 原子写。 */
function unregister(runId, home = ddoHome()) {
  return withLock(lockPath(home), () => {
    const map = readAll(home);
    delete map[runId];
    atomicWrite(indexPath(home), `${JSON.stringify(map, null, 2)}\n`);
    return map;
  });
}

/** runId（02 §5.2.1）：YYYYMMDD-HHMMSS-<4hex>，本地时间、定长 18 字符、字典序=时间序。 */
function genRunId(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  return `${stamp}-${crypto.randomBytes(2).toString('hex')}`;
}

/** 取未占用的 runId：index 中已存在则重掷（同秒碰撞防护，02 §5.2.1），上限 5 次。 */
function freshRunId(home = ddoHome()) {
  for (let i = 0; i < 5; i++) {
    const id = genRunId();
    if (!readAll(home)[id]) return id;
  }
  throw new Error('runId 生成重试超限（index 同秒碰撞未消解）');
}

module.exports = { ddoHome, readAll, register, unregister, genRunId, freshRunId };
