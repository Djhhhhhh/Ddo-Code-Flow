'use strict';
// ~/.ddo/index.json 纯指针注册表（02 基线 §4）：
// { "<runId>": { "statePath": "...", "startedAt": "..." } }
// 本文件只含本轮登记命令（run finish）用到的操作；register 随 run start 登记时再引入。

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

/** 移除（不存在时静默幂等），持锁 + 原子写。 */
function unregister(runId, home = ddoHome()) {
  return withLock(lockPath(home), () => {
    const map = readAll(home);
    delete map[runId];
    atomicWrite(indexPath(home), `${JSON.stringify(map, null, 2)}\n`);
    return map;
  });
}

module.exports = { ddoHome, readAll, unregister };
