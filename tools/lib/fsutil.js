'use strict';
// 原子写与锁：所有落盘操作的公共底座（基线 §8）。

const fs = require('fs');
const path = require('path');

/** 同目录临时文件 + rename，杜绝半截文件被读到。 */
function atomicWrite(file, data) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`);
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

const LOCK_RETRY_MS = 50;
const LOCK_TIMEOUT_MS = 2000;
const LOCK_STALE_MS = 10000;

/**
 * 锁文件互斥（O_EXCL）。获取失败按 50ms 重试至 2s 超时；
 * 锁龄超过 10s 视为陈旧锁（持锁方已崩溃），直接打破。
 * 返回 fn() 的结果；fn 抛错则透传，锁总被释放。
 */
function withLock(lockFile, fn) {
  const dir = path.dirname(lockFile);
  fs.mkdirSync(dir, { recursive: true });
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  for (;;) {
    try {
      fs.openSync(lockFile, 'wx');
      break; // 拿到锁
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try {
        const age = Date.now() - fs.statSync(lockFile).mtimeMs;
        if (age > LOCK_STALE_MS) {
          fs.unlinkSync(lockFile); // 打破陈旧锁，下轮自取
          continue;
        }
      } catch (_) { /* 锁刚好消失，重试 */ }
      if (Date.now() > deadline) {
        throw new Error(`lock timeout: ${lockFile}`);
      }
      const wait = Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, LOCK_RETRY_MS);
      void wait;
    }
  }
  try {
    return fn();
  } finally {
    try { fs.unlinkSync(lockFile); } catch (_) { /* 已被打破则忽略 */ }
  }
}

module.exports = { atomicWrite, withLock };
