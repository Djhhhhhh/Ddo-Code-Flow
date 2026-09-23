'use strict';
// ~/.ddo/history/runs.jsonl（02 基线 §6）：一行一个已结束 run，仅追加。
// 本文件只含本轮登记命令（run finish）用到的追加操作；query 随 list history 登记时再引入。

const fs = require('fs');
const path = require('path');
const { ddoHome } = require('./index-registry');
const { atomicWrite } = require('./fsutil');

function historyPath(home = ddoHome()) {
  return path.join(home, 'history', 'runs.jsonl');
}

/** 追加一行（原子追加：读全文 + 追行 + 原子写回，避免半行）。 */
function append(record, home = ddoHome()) {
  const file = historyPath(home);
  let prev = '';
  try {
    prev = fs.readFileSync(file, 'utf8');
    if (prev.length && !prev.endsWith('\n')) prev += '\n';
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  atomicWrite(file, `${prev}${JSON.stringify(record)}\n`);
}

/** 归档 state 副本（11 D1）：copy 到 ~/.ddo/history/<runId>/.state.json（幂等覆盖，原文件不动）。 */
function archiveState(runId, statePath, home = ddoHome()) {
  const dir = path.join(home, 'history', runId);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, '.state.json');
  fs.copyFileSync(statePath, dest);
  return dest;
}

module.exports = { append, archiveState };
