#!/usr/bin/env node
'use strict';
// split 命令：按分隔符切分（缺省逗号），每行输出一段。用法：node bin/split.js [--sep <c>] <text>
const { splitParts } = require('../lib/textlib');

const args = process.argv.slice(2);
let sep = ',';
let rest = args;
if (args[0] === '--sep') { sep = args[1] || ','; rest = args.slice(2); }
const text = rest.join(' ');
if (!text) { console.error('用法: split [--sep <c>] <text>'); process.exit(2); }
for (const part of splitParts(text, sep)) console.log(part);
