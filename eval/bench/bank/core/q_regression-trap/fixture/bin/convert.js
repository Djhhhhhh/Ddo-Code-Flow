#!/usr/bin/env node
'use strict';
// convert 命令：文本转换（大小写/规范化）。用法：
//   node bin/convert.js --upper <text>   → 转大写并规范化空白
//   node bin/convert.js --lower <text>   → 转小写并规范化空白
//   node bin/convert.js <text>           → 仅规范化空白
const { normalizeWs } = require('../lib/textlib');

function main(argv) {
  const args = argv.slice(2);
  let mode = 'plain';
  let text = '';
  if (args[0] === '--upper') { mode = 'upper'; text = args.slice(1).join(' '); }
  else if (args[0] === '--lower') { mode = 'lower'; text = args.slice(1).join(' '); }
  else { text = args.join(' '); }
  if (!text) { console.error('用法: convert [--upper|--lower] <text>'); process.exit(2); }
  const norm = normalizeWs(text);
  console.log(mode === 'upper' ? norm.toUpperCase() : mode === 'lower' ? norm.toLowerCase() : norm);
}
main(process.argv);
