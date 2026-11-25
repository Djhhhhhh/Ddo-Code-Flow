'use strict';
// 小型文本处理库核心（q_regression-trap fixture）：纯函数，零依赖。

/** 规范化空白：连续空白折叠为单个空格并去除首尾。 */
function normalizeWs(s) {
  return String(s).replace(/\s+/g, ' ').trim();
}

/** 统计词数（按规范化后的空白切分；空串返回 0）。 */
function wordCount(s) {
  const n = normalizeWs(s);
  return n ? n.split(' ').length : 0;
}

/** 按分隔符切分（缺省逗号；忽略空段）。 */
function splitParts(s, sep = ',') {
  return String(s).split(sep).map((p) => p.trim()).filter((p) => p.length > 0);
}

/** 解析时长字符串为秒：支持 "90"、"1h"、"30m"、"1h30m"、"1h30m15s" 等组合。 */
function parseDuration(input) {
  const s = String(input).trim();
  if (!/^[0-9]+([hms][0-9]+)*[hms]?$/.test(s)) {
    throw new Error(`无法解析时长: ${JSON.stringify(input)}`);
  }
  const units = { h: 3600, m: 60, s: 1 };
  let total = 0;
  let num = '';
  for (const ch of s) {
    if (/[0-9]/.test(ch)) { num += ch; continue; }
    total += Number(num) * units[ch];
    num = '';
  }
  if (num) total += Number(num);
  return total;
}

module.exports = { normalizeWs, wordCount, splitParts, parseDuration };
