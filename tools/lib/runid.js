'use strict';
// runId 计算（基线 §5.2.1）：YYYYMMDD-HHMMSS-<4位hex随机>，定长 18 字符。
// 时间用机器本地时间；防碰撞由调用方传入 exists 检查回调。

const crypto = require('crypto');

function pad(n, w) {
  return String(n).padStart(w, '0');
}

/** 生成一个 runId。now 可注入用于测试。 */
function genRunId(now = new Date()) {
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1, 2)}${pad(now.getDate(), 2)}`;
  const time = `${pad(now.getHours(), 2)}${pad(now.getMinutes(), 2)}${pad(now.getSeconds(), 2)}`;
  const rand = crypto.randomBytes(2).toString('hex');
  return `${date}-${time}-${rand}`;
}

/**
 * 生成并确保唯一：exists(runId) 返回 true 则重掷随机后缀，至多 5 次。
 * 仍冲突则抛错（理论上不可能）。
 */
function genUniqueRunId(exists, now = new Date()) {
  for (let i = 0; i < 5; i++) {
    const id = genRunId(now);
    if (!exists(id)) return id;
  }
  throw new Error('runid collision after 5 retries');
}

module.exports = { genRunId, genUniqueRunId };
