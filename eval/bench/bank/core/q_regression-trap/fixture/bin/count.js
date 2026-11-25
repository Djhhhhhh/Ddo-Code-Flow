#!/usr/bin/env node
'use strict';
// count 命令：词数统计。用法：node bin/count.js <text>
const { wordCount } = require('../lib/textlib');

const text = process.argv.slice(2).join(' ');
if (!text) { console.error('用法: count <text>'); process.exit(2); }
console.log(wordCount(text));
