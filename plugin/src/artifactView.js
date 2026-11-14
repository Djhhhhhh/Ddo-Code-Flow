'use strict';
/**
 * artifactView.js —— 产出收集（只读数据面）：E 区登记文件内容内联 + git 工作区变更快照。
 * 契约：coding:02 修订 9——右侧工作区下半部「产出浏览器」数据源。
 *  - 全部只读；任何读取/命令失败静默降级（note 或 null），不阻塞面板渲染；
 *  - 内联限额：单文件 ≤48KB、总量 ≤512KB、文本扩展名白名单，超限降级为说明行；
 *  - git 快照：status --porcelain=v1 -b + diff --stat HEAD（spawnSync，3s 超时）。
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const TEXT_EXT = new Set([
  '.md', '.markdown', '.txt', '.json', '.jsonl', '.log', '.js', '.mjs', '.cjs', '.ts', '.html', '.htm',
  '.css', '.scss', '.yml', '.yaml', '.sh', '.zsh', '.bash', '.py', '.rb', '.go', '.rs',
  '.java', '.c', '.h', '.cpp', '.hpp', '.svg', '.xml', '.toml', '.ini', '.cfg', '.conf',
  '.env', '.gitignore', '.diff', '.patch', '.sql', '.vue', '.jsx', '.tsx',
]);
const MAX_FILE_BYTES = 48 * 1024;
const MAX_TOTAL_BYTES = 512 * 1024;

/** 候选路径解析：绝对直取；相对依次试 runDir / projectRoot。 */
function resolveCandidate(bases, p) {
  if (!p) return null;
  if (path.isAbsolute(p)) return fs.existsSync(p) ? p : null;
  for (const b of bases) {
    const c = path.join(b, p);
    if (fs.existsSync(c)) return c;
  }
  return null;
}

/** E 区登记文件 → 内联模型（content=null 时 note 说明原因；rel=树展示路径）。
 *  opts.archiveOnly：归档 run（zip 预览）不读磁盘，登记行 note「归档于 zip，未内联」（plan DEC-3）。 */
function collectArtifacts(state, opts) {
  const archiveOnly = !!(opts && opts.archiveOnly);
  const sizes = archiveOnly && opts.archiveZip ? zipEntrySizes(opts.archiveZip) : new Map();
  const bases = archiveOnly ? [] : [state.dirs.runDir, state.dirs.projectRoot].filter(Boolean);
  const out = [];
  let total = 0;
  for (const [stage, entries] of Object.entries(state.artifacts || {})) {
    for (const en of entries || []) {
      for (const f of en.files || []) {
        const raw = String(f.path || '');
        // 树展示路径：相对路径原样；绝对路径取 basename（避免把系统路径拆成目录树）
        const rel = raw && !path.isAbsolute(raw) ? raw : path.basename(raw || '');
        const item = {
          stage, phase: en.phase, recordedAt: en.recordedAt,
          path: raw, rel, bytes: f.bytes, content: null, note: '',
        };
        if (archiveOnly) {
          if (opts && opts.archiveZip) archiveEntry(opts.archiveZip, sizes, rel, item);
          else item.note = '归档于 zip，未内联';
          out.push(item);
          continue;
        }
        try {
          const abs = resolveCandidate(bases, raw);
          if (!abs) {
            item.note = '未在 runDir / projectRoot 下找到';
          } else {
            const st = fs.statSync(abs);
            if (!st.isFile()) item.note = '非普通文件';
            else if (st.size > MAX_FILE_BYTES) item.note = `文件 ${(st.size / 1024).toFixed(1)}KB 超内联上限，仅登记`;
            else if (total + st.size > MAX_TOTAL_BYTES) item.note = '内联总量超限，仅登记';
            else if (!TEXT_EXT.has(path.extname(abs).toLowerCase())) item.note = '非文本类型，仅登记';
            else {
              item.content = fs.readFileSync(abs, 'utf8');
              total += st.size;
            }
          }
        } catch (e) {
          item.note = `读取失败：${e.code || e.message}`;
        }
        out.push(item);
      }
    }
  }
  return out;
}

/** 状态面文件（.state.json / .usage.jsonl 轨迹日志）→ 虚拟登记条目置顶（用户修订 2026-11-15：状态与轨迹文件进产出浏览器）。
 *  仅受单文件上限约束（不占产物总量预算）；缺失不登记；archiveOnly → 登记行「归档于 zip，未内联」。 */
function collectStateFiles(state, opts) {
  const archiveOnly = !!(opts && opts.archiveOnly);
  const runDir = state.dirs && state.dirs.runDir;
  if (!runDir) return [];
  const specs = [
    { rel: '.state.json', stage: 'state' },
    { rel: '.usage.jsonl', stage: '轨迹' },
  ];
  const out = [];
  for (const sp of specs) {
    const abs = path.join(runDir, sp.rel);
    const item = {
      stage: sp.stage, phase: '', recordedAt: '',
      path: abs, rel: sp.rel, bytes: 0, content: null, note: '',
    };
    if (archiveOnly) {
      // .state.json 内容即当前已加载的 state（zip 内同源）；轨迹日志从 zip 流式读取
      if (sp.rel === '.state.json') {
        item.content = JSON.stringify(state, null, 2);
        item.bytes = Buffer.byteLength(item.content, 'utf8');
      } else if (opts && opts.archiveZip) {
        archiveEntry(opts.archiveZip, zipEntrySizes(opts.archiveZip), sp.rel, item);
      } else {
        item.note = '归档于 zip，未内联';
      }
      out.push(item);
      continue;
    }
    try {
      if (!fs.existsSync(abs)) continue; // 旧 run 可能无日志 → 不登记
      const st = fs.statSync(abs);
      if (!st.isFile()) continue;
      item.bytes = st.size;
      if (st.size > MAX_FILE_BYTES) item.note = `文件 ${(st.size / 1024).toFixed(1)}KB 超内联上限，仅登记`;
      else item.content = fs.readFileSync(abs, 'utf8');
    } catch (e) {
      item.note = `读取失败：${e.code || e.message}`;
    }
    out.push(item);
  }
  return out;
}

/** zip 条目清单（name → 未压缩字节数）；解析失败 → 空 Map（用户修订 2026-11-15：归档产物流式预览）。 */
function zipEntrySizes(zipPath) {
  const sizes = new Map();
  let r;
  try {
    r = spawnSync('unzip', ['-l', zipPath], { timeout: 3000, encoding: 'utf8', maxBuffer: 256 * 1024 });
  } catch {
    return sizes;
  }
  if (!r || r.status !== 0 || !r.stdout) return sizes;
  // 行形态：`  <Length>  <Date> <Time>  <Name>`（日期为 MM-DD-YYYY / YYYY-MM-DD 通用形态）
  for (const line of r.stdout.split('\n')) {
    const m = line.match(/^\s*(\d+)\s+[\d-]+\s+[\d:]+\s+(.+?)\s*$/);
    if (m && !m[2].endsWith('/')) sizes.set(m[2], Number(m[1]));
  }
  return sizes;
}

/** zip 内单条目流式读取（unzip -p，零解压落盘；失败 → null）。 */
function readZipEntry(zipPath, entry) {
  try {
    const r = spawnSync('unzip', ['-p', zipPath, entry], {
      timeout: 3000, encoding: 'utf8', maxBuffer: MAX_TOTAL_BYTES,
    });
    if (r.status !== 0 || r.stdout == null) return null;
    return r.stdout;
  } catch {
    return null;
  }
}

/** 归档模式内联判定：按 zip 清单限额 + 文本白名单流式读取；不可得 → 登记行 note。 */
function archiveEntry(zipPath, sizes, rel, item) {
  const size = sizes.get(rel);
  if (size === undefined) { item.note = 'zip 内未找到该登记文件'; return; }
  item.bytes = size;
  if (size > MAX_FILE_BYTES) { item.note = `文件 ${(size / 1024).toFixed(1)}KB 超内联上限，仅登记`; return; }
  if (!TEXT_EXT.has(path.extname(rel).toLowerCase())) { item.note = '非文本类型，仅登记'; return; }
  const content = readZipEntry(zipPath, rel);
  if (content === null) { item.note = 'zip 读取失败'; return; }
  item.content = content;
}

/** 只读 git 子命令（失败返回空串）。 */
function git(args, cwd) {
  try {
    const r = spawnSync('git', ['-C', cwd, ...args], {
      timeout: 3000, encoding: 'utf8', maxBuffer: 1024 * 1024,
    });
    return r.status === 0 && r.stdout ? r.stdout.trim() : '';
  } catch {
    return '';
  }
}

/** 工作区变更快照（branch 概要 + 变更清单 + diffstat）；无 git / 失败 → null（隐藏区块）。 */
function collectGitChanges(state) {
  const root = state.dirs && state.dirs.projectRoot;
  if (!root) return null;
  const status = git(['status', '--porcelain=v1', '-b'], root);
  if (!status) return null;
  const lines = status.split('\n');
  const changes = lines.slice(1).filter((l) => l.trim());
  const stat = git(['diff', '--stat', 'HEAD'], root);
  return { branchLine: lines[0] || '', changes, stat };
}

/** 产出浏览器模型总装（状态面文件置顶；opts.archiveOnly+archiveZip：归档 run 从 zip 流式预览，跳过磁盘与 git 快照）。 */
function buildBrowser(state, opts) {
  const archiveOnly = !!(opts && opts.archiveOnly);
  return {
    files: [...collectStateFiles(state, opts), ...collectArtifacts(state, opts)],
    git: archiveOnly ? null : collectGitChanges(state),
  };
}

module.exports = {
  buildBrowser, collectStateFiles, collectArtifacts, collectGitChanges,
  zipEntrySizes, readZipEntry, TEXT_EXT, MAX_FILE_BYTES,
};
