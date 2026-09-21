'use strict';
// ~/.ddo/history/runs.jsonl（基线 §6）：一行一个已结束 run，仅追加。

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

/** 查询：返回解析后的记录数组；lastN 取尾部 N 条。 */
function query(lastN, home = ddoHome()) {
  let raw = '';
  try {
    raw = fs.readFileSync(historyPath(home), 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);
  const records = lines.map((l) => JSON.parse(l));
  return typeof lastN === 'number' ? records.slice(-lastN) : records;
}

module.exports = { historyPath, append, query };
