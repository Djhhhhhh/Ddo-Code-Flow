'use strict';
// 纯 Node zip 写入器（#51 DEC-1）：Node 内置 zlib.deflateRawSync 提供 raw deflate，
// 自实现 CRC32 查表与容器组装（local header / central directory / EOCD）。
// 零外部依赖；条目按名字典序归一，同输入产出逐字节一致的 zip（确定性）。

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32（IEEE 802.3，多项式 0xEDB88320）：预生成 256 项表
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Date → DOS 时间（2 秒粒度；1980-01-01 为 zip 下限，早于则钳位）。 */
function dosDateTime(date) {
  const d = date.getFullYear() < 1980 ? new Date(1980, 0, 1, 0, 0, 2) : date;
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const day = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, day };
}

/**
 * 条目集合 → 完整 zip Buffer。
 * entries: [{ name（POSIX 相对名）, data（Buffer）, mtime（Date，缺省当前） }]
 * 逐条目择优：deflate 后不小于原长即降级 store（method 0），否则 method 8。
 */
function buildZip(entries) {
  const sorted = [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const parts = [];
  const central = [];
  let offset = 0;
  const put = (buf) => {
    parts.push(buf);
    offset += buf.length;
  };
  for (const e of sorted) {
    const name = Buffer.from(e.name, 'utf8');
    const crc = crc32(e.data);
    let method = 8;
    let payload = zlib.deflateRawSync(e.data);
    if (payload.length >= e.data.length) {
      method = 0;
      payload = e.data;
    }
    const { time, day } = dosDateTime(e.mtime instanceof Date ? e.mtime : new Date());

    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0); // local file header 签名
    lfh.writeUInt16LE(20, 4); // version needed（2.0）
    lfh.writeUInt16LE(0x0800, 6); // 通用标志 bit 11：文件名为 UTF-8
    lfh.writeUInt16LE(method, 8);
    lfh.writeUInt16LE(time, 10);
    lfh.writeUInt16LE(day, 12);
    lfh.writeUInt32LE(crc, 14);
    lfh.writeUInt32LE(payload.length, 18);
    lfh.writeUInt32LE(e.data.length, 22);
    lfh.writeUInt16LE(name.length, 26);
    lfh.writeUInt16LE(0, 28); // extra 长度
    const localOffset = offset;
    put(lfh);
    put(name);
    put(payload);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); // central directory 签名
    cd.writeUInt16LE(20, 4); // version made by
    cd.writeUInt16LE(20, 6); // version needed
    cd.writeUInt16LE(0x0800, 8); // UTF-8 名
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(time, 12);
    cd.writeUInt16LE(day, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(payload.length, 20);
    cd.writeUInt32LE(e.data.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt16LE(0, 30); // extra
    cd.writeUInt16LE(0, 32); // comment
    cd.writeUInt16LE(0, 34); // disk start
    cd.writeUInt16LE(0, 36); // internal attrs
    cd.writeUInt32LE(0, 38); // external attrs
    cd.writeUInt32LE(localOffset, 42);
    central.push(Buffer.concat([cd, name]));
  }
  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD 签名
  eocd.writeUInt16LE(0, 4); // 盘号
  eocd.writeUInt16LE(0, 6); // 中心目录所在盘
  eocd.writeUInt16LE(sorted.length, 8); // 本盘条目数
  eocd.writeUInt16LE(sorted.length, 10); // 总条目数
  eocd.writeUInt32LE(cdBuf.length, 12); // 中心目录字节长
  eocd.writeUInt32LE(offset, 16); // 中心目录偏移
  eocd.writeUInt16LE(0, 20); // comment 长度
  return Buffer.concat([...parts, cdBuf, eocd]);
}

/** 递归收集目录下全部常规文件（含点开头；符号链接跳过——runDir 为 CLI 管理目录，无链接场景）。 */
function collectEntries(dir, prefix = '') {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...collectEntries(abs, rel));
    } else if (ent.isFile()) {
      out.push({ name: rel, data: fs.readFileSync(abs), mtime: fs.statSync(abs).mtime });
    }
  }
  return out;
}

/** 目录 → zip Buffer（readdir 顺序不定，经 buildZip 内字典序排序归一）。 */
function zipDir(dir) {
  return buildZip(collectEntries(dir));
}

module.exports = { buildZip, zipDir, crc32 };
