'use strict';
// tools/tests/zip.test.js — 纯 Node zip 写入器测试（#51 DEC-1 / VA-1）。
//
// 结构断言（签名/EOCD/中心目录/method）用纯 JS 直读 Buffer；产物可解性与内容
// 一致性借系统 unzip 交叉验证（仅测试环境依赖，运行时零依赖）。
// 隔离约定同前：mkdtemp 沙箱 + finally 递归删除。

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildZip, zipDir, crc32 } = require(path.join(__dirname, '..', 'lib', 'zip.js'));

function sandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddo-zip-test-'));
  return { dir };
}

function cleanup(sb) {
  fs.rmSync(sb.dir, { recursive: true, force: true });
}

function eocdOf(zip) {
  return zip.subarray(zip.length - 22);
}

test('crc32：已知向量（"123456789" → 0xCBF43926）', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
});

test('buildZip：EOCD/中心目录结构、UTF-8 条目名、空文件条目', () => {
  const zip = buildZip([
    { name: 'a.md', data: Buffer.from('# hello\n'.repeat(100), 'utf8') },
    { name: '规格.md', data: Buffer.from('中文内容'.repeat(50), 'utf8') },
    { name: 'sub/empty.txt', data: Buffer.alloc(0) },
  ]);
  const eocd = eocdOf(zip);
  assert.equal(eocd.readUInt32LE(0), 0x06054b50, 'EOCD 签名');
  assert.equal(eocd.readUInt16LE(8), 3, '本盘条目数');
  assert.equal(eocd.readUInt16LE(10), 3, '总条目数');
  const cdOffset = eocd.readUInt32LE(16);
  const cdSize = eocd.readUInt32LE(12);
  assert.equal(zip.readUInt32LE(cdOffset), 0x02014b50, '中心目录首签名');
  assert.equal(cdOffset + cdSize, zip.length - 22, '中心目录紧贴 EOCD');
  assert.ok(zip.subarray(cdOffset, cdOffset + cdSize).includes(Buffer.from('规格.md', 'utf8')), 'UTF-8 名入中心目录');
});

test('buildZip：确定性（乱序传入同字节）与不可压内容降级 store', () => {
  const entries = [
    { name: 'r.bin', data: crypto.randomBytes(4096) }, // 随机内容 deflate 无收益 → method 0
    { name: 't.txt', data: Buffer.from('aaaa'.repeat(1000), 'utf8') }, // 高重复 → method 8
  ];
  const z1 = buildZip(entries);
  const z2 = buildZip([...entries].reverse());
  assert.ok(z1.equals(z2), '同输入（乱序传入）应产出逐字节一致的 zip');

  const eocd = eocdOf(z1);
  const cdOffset = eocd.readUInt32LE(16);
  // 字典序：r.bin < t.txt，第一条中心目录记录属于 r.bin（method 偏移 +10）
  assert.equal(z1.readUInt16LE(cdOffset + 10), 0, '随机内容应降级 store');
  // 第二条 = 首条 46 字节头 + 名长 5 → t.txt 的 method
  const second = cdOffset + 46 + 'r.bin'.length;
  assert.equal(z1.readUInt16LE(second + 10), 8, '高重复文本应走 deflate');
});

test('zipDir：目录打包（含点开头与嵌套 _del/）→ unzip 交叉验证逐字节一致', () => {
  const sb = sandbox();
  try {
    const dir = path.join(sb.dir, 'run');
    fs.mkdirSync(path.join(dir, '_del', 'rollback-1'), { recursive: true });
    const stateBuf = Buffer.from(`${JSON.stringify({ runId: 'x', currentStage: ['spec:02'] }, null, 2)}\n`);
    fs.writeFileSync(path.join(dir, '.state.json'), stateBuf);
    fs.writeFileSync(path.join(dir, 'spec.md'), '# spec\n中文内容');
    fs.writeFileSync(path.join(dir, '_del', 'rollback-1', 'spec.md'), '旧 spec');
    const zipFile = path.join(sb.dir, 'out.zip');
    fs.writeFileSync(zipFile, zipDir(dir));

    const t = spawnSync('unzip', ['-t', zipFile], { encoding: 'utf8' });
    assert.equal(t.status, 0, `${t.stdout}\n${t.stderr}`); // 完整性校验（CRC 全通过）
    for (const [rel, expect] of [
      ['.state.json', stateBuf],
      ['spec.md', Buffer.from('# spec\n中文内容')],
      ['_del/rollback-1/spec.md', Buffer.from('旧 spec')],
    ]) {
      const p = spawnSync('unzip', ['-p', zipFile, rel], { maxBuffer: 10 * 1024 * 1024 });
      assert.equal(p.status, 0, `${rel}: ${p.stderr}`);
      assert.ok(Buffer.compare(p.stdout, expect) === 0, `${rel} 内容应逐字节一致`);
    }
  } finally {
    cleanup(sb);
  }
});

test('zipDir：压缩收益——高重复文本产物明显小于原目录', () => {
  const sb = sandbox();
  try {
    const dir = path.join(sb.dir, 'run');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'spec.md'), '# spec\n'.repeat(2000));
    fs.writeFileSync(path.join(dir, 'plan.md'), '# plan\n'.repeat(2000));
    const raw = 2 * '# spec\n'.repeat(2000).length;
    const zipped = zipDir(dir).length;
    assert.ok(zipped < raw / 2, `压缩率异常: ${zipped}/${raw}`);
  } finally {
    cleanup(sb);
  }
});
