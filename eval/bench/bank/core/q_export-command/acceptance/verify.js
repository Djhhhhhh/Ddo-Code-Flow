'use strict';
// q_export-command 隐藏验收执行器（不进入两臂沙箱——收集阶段由编排器调用）。
// 用法：node verify.js <臂沙箱绝对路径> <题包根绝对路径>
// 验收（需求 §4.2）：复用既有 CLI 解析与序列化约定；--format 非法值有明确错误；
// --output 缺省行为符合惯例；导出字段与 .ddo/runs/ 记录结构一致；产物引用被调研文件。
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const sandboxDir = path.resolve(process.argv[2]);
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', cwd: sandboxDir });
  return { ok: r.status === 0, stdout: String(r.stdout || ''), stderr: String(r.stderr || '') };
};
const findExportEntry = () => {
  // 项目约定：CLI 入口在 bin/（新增导出命令或 runs 子命令均可）
  const binDir = path.join(sandboxDir, 'bin');
  if (!fs.existsSync(binDir)) return null;
  for (const f of fs.readdirSync(binDir)) {
    const src = fs.readFileSync(path.join(binDir, f), 'utf8');
    if (/export|--format/i.test(src)) return path.join('bin', f);
  }
  return null;
};

const cases = [];
const push = (name, pass, detail) => cases.push({ name, pass, detail: String(detail).slice(0, 200) });

// 1) 导出入口存在且可跑 --help 或无参（约定遵循的最低信号）
const entry = findExportEntry();
push('导出命令入口存在（bin/ 内含 export/--format）', Boolean(entry), entry || '未找到');

// 2) JSON 导出可用且字段与 .ddo/runs/ 记录结构一致
const jsonOut = run(process.execPath, entry ? [entry, 'export', '--format', 'json'] : ['bin/runs.js', 'export', '--format', 'json']);
let jsonOk = false; let fieldOk = false;
if (jsonOut.ok) {
  try {
    const data = JSON.parse(jsonOut.stdout);
    const rows = Array.isArray(data) ? data : [data];
    jsonOk = rows.length >= 2;
    const sample = fs.readFileSync(path.join(sandboxDir, '.ddo', 'runs', 'feat', '20261101-100000-ex01', 'record.json'), 'utf8');
    const sampleKeys = Object.keys(JSON.parse(sample));
    fieldOk = sampleKeys.every((k) => k in rows[0]);
  } catch { /* 解析失败即不通过 */ }
}
push('JSON 导出：≥2 条且可解析', jsonOk, jsonOut.ok ? jsonOut.stdout.slice(0, 80) : jsonOut.stderr);
push('导出字段与 .ddo/runs/ 记录结构一致', fieldOk, '样例键集全量出现于导出首行');

// 3) CSV 导出可用（表头 + 行数）
const csvOut = run(process.execPath, entry ? [entry, 'export', '--format', 'csv'] : ['bin/runs.js', 'export', '--format', 'csv']);
let csvOk = false;
if (csvOut.ok) {
  const lines = csvOut.stdout.trim().split('\n');
  csvOk = lines.length >= 3 && /runId/i.test(lines[0]);
}
push('CSV 导出：表头 + 数据行', csvOk, csvOut.ok ? csvOut.stdout.split('\n')[0] : csvOut.stderr);

// 4) --format 非法值有明确错误（exit 非 0 + stderr 有信息；沿用项目 exit 约定 1/2）
const bad = run(process.execPath, entry ? [entry, 'export', '--format', 'xml'] : ['bin/runs.js', 'export', '--format', 'xml']);
push('--format 非法值明确报错', !bad.ok && Boolean((bad.stderr || '').trim()), bad.stderr || '(无 stderr)');

// 5) --output 缺省行为：指定路径时写文件，内容与 stdout 同构
const tmpOut = path.join(sandboxDir, '.ddo', 'export-check.json');
fs.rmSync(tmpOut, { force: true });
const fileOut = run(process.execPath, (entry ? [entry, 'export', '--format', 'json', '--output', tmpOut] : ['bin/runs.js', 'export', '--format', 'json', '--output', tmpOut]));
push('--output 指定路径写入文件', fileOut.ok && fs.existsSync(tmpOut) && fs.statSync(tmpOut).size > 0, fileOut.ok ? tmpOut : fileOut.stderr);

// 6) 调研证据：spec/计划类产物引用被调研文件（fixture 真实文件名出现在产物中）
let researchOk = false; const citedFiles = ['bin/runs.js', 'lib/records.js'];
const docDirs = [path.join(sandboxDir, '.ddo'), path.join(sandboxDir, 'docs')];
const docs = [];
const walk = (d) => {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith('.') && d === sandboxDir) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory() && e.name !== 'node_modules') walk(p);
    else if (/\.(md|txt)$/.test(e.name) && /(spec|plan|计划|说明)/i.test(e.name)) docs.push(p);
  }
};
docDirs.forEach(walk);
const docText = docs.map((p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }).join('\n');
researchOk = citedFiles.every((f) => docText.includes(f));
push('产物引用被调研文件（bin/runs.js 与 lib/records.js）', researchOk, `候选产物 ${docs.length} 份`);

// 7) 既有回归不受影响
const reg = run(process.execPath, ['--test', 'tests/**/*.test.js']);
const regPass = (reg.stdout.match(/^✔/gm) || []).length;
const regFail = (reg.stdout.match(/^✖/gm) || []).length;

process.stdout.write(JSON.stringify({
  line: 'design',
  acceptance: { pass: cases.filter((c) => c.pass).length, total: cases.length, cases },
  regression: { pass: regPass, total: regPass + regFail, broken: regFail },
  researchEvidence: { docs: docs.map((d) => path.relative(sandboxDir, d)), cited: researchOk },
}, null, 2));
