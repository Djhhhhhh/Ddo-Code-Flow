'use strict';
// .usage.jsonl 使用日志（STATE-SPEC §3.7 / F 区）：仅追加、纯复盘、不驱动控制流（I-J1）。
// append 语义同 history.append 先例（STATE-SPEC §5.3 → A3）：读全文→补行尾 LF→拼接→atomicWrite；
// seq = 现存最大 seq + 1（允许空洞 = 崩溃窗口合法产物，消费方不得假设连续）。

const fs = require('fs');
const path = require('path');
const { atomicWrite } = require('./fsutil');

const JOURNAL_FILE = '.usage.jsonl';

/** 11 种事件枚举（STATE-SPEC §3.7）：出现未知事件名 = 编程错误，硬失败。 */
const EVENTS = new Set([
  'run-started', 'presented', 'interacted', 'decision', 'advanced', 'activated',
  'rollback', 'subflow-started', 'subflow-closed', 'artifacts-recorded', 'finished',
]);

function journalPath(runDir) {
  return path.join(runDir, JOURNAL_FILE);
}

/** 读全文并计算现存最大 seq（文件缺失返回 {prev:'',max:0}；破行跳过——空洞/半行容错）。 */
function scan(file) {
  let prev = '';
  try {
    prev = fs.readFileSync(file, 'utf8');
    if (prev.length && !prev.endsWith('\n')) prev += '\n';
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  let max = 0;
  for (const line of prev.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      const j = JSON.parse(t);
      if (Number.isInteger(j.seq) && j.seq > max) max = j.seq;
    } catch { /* 破行（半截崩溃产物）跳过，不阻断追加 */ }
  }
  return { prev, max };
}

/**
 * 追加一条使用事件，返回写入的完整记录（含 seq）。
 * event 须含 event（枚举）与 at（ISO 时刻，由调用方 nowIso 生成）；其余字段按适用性可选
 * （command/stage/phase/option/note/detail）。调用方负责顺序规则（STATE-SPEC §3.7）：
 * interacted 先写 state 标量成功再调用本函数；纯审计事件在 state 写成功后调用。
 */
function append(runDir, event) {
  if (!event || !EVENTS.has(event.event)) {
    throw new Error(`journal 事件名非法: ${JSON.stringify(event && event.event)}（枚举: ${[...EVENTS].join(', ')}）`);
  }
  if (typeof event.at !== 'string' || !event.at) throw new Error('journal 事件缺少 at（ISO 时刻）');
  const file = journalPath(runDir);
  const { prev, max } = scan(file);
  const { at, ...rest } = event;
  const record = { seq: max + 1, at, ...rest };
  atomicWrite(file, `${prev}${JSON.stringify(record)}\n`);
  return record;
}

/** 纯审计事件追加（STATE-SPEC §3.7「其余事件」分支）：失败 stderr 警告、不抛错不回滚
 *  已提交的状态变更（审计尽力而为，控制流一致性优先）。返回写入记录或 null。 */
function appendAudit(runDir, event) {
  try {
    return append(runDir, event);
  } catch (e) {
    process.stderr.write(`[journal] 审计事件追加失败（不回滚已提交状态变更）: ${e.message}\n`);
    return null;
  }
}

module.exports = { append, appendAudit, journalPath, EVENTS };
