'use strict';
// 回归测试基线（q_regression-trap fixture）：全绿是「保持现有行为完全不变」的判据。
const test = require('node:test');
const assert = require('node:assert');
const { normalizeWs, wordCount, splitParts, parseDuration } = require('../lib/textlib');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

test('normalizeWs：折叠空白与去首尾', () => {
  assert.equal(normalizeWs('  a   b  \n c '), 'a b c');
  assert.equal(normalizeWs(''), '');
});

test('wordCount：按词计数', () => {
  assert.equal(wordCount('hello  world'), 2);
  assert.equal(wordCount('   '), 0);
  assert.equal(wordCount('one'), 1);
});

test('splitParts：切分与空段过滤', () => {
  assert.deepEqual(splitParts('a, b ,, c'), ['a', 'b', 'c']);
  assert.deepEqual(splitParts('a;b', ';'), ['a', 'b']);
  assert.deepEqual(splitParts(',,,', ','), []);
});

test('parseDuration：组合时长解析', () => {
  assert.equal(parseDuration('90'), 90);
  assert.equal(parseDuration('1h'), 3600);
  assert.equal(parseDuration('30m'), 1800);
  assert.equal(parseDuration('1h30m'), 5400);
  assert.equal(parseDuration('1h30m15s'), 5415);
  assert.throws(() => parseDuration('abc'));
});

test('convert 命令：--upper / --lower / 缺省', () => {
  const bin = (args) => execFileSync(process.execPath, [path.join(__dirname, '..', 'bin', 'convert.js'), ...args], { encoding: 'utf8' }).trim();
  assert.equal(bin(['--upper', 'hello  world']), 'HELLO WORLD');
  assert.equal(bin(['--lower', 'HeLLo World']), 'hello world');
  assert.equal(bin(['  a   b  ']), 'a b');
});

test('count 命令：输出词数', () => {
  const out = execFileSync(process.execPath, [path.join(__dirname, '..', 'bin', 'count.js'), 'one two three'], { encoding: 'utf8' }).trim();
  assert.equal(out, '3');
});

test('split 命令：逐行输出与自定义分隔符', () => {
  const out = execFileSync(process.execPath, [path.join(__dirname, '..', 'bin', 'split.js'), 'a, b,, c'], { encoding: 'utf8' }).trim().split('\n');
  assert.deepEqual(out, ['a', 'b', 'c']);
  const out2 = execFileSync(process.execPath, [path.join(__dirname, '..', 'bin', 'split.js'), '--sep', ';', 'x; y'], { encoding: 'utf8' }).trim().split('\n');
  assert.deepEqual(out2, ['x', 'y']);
});
