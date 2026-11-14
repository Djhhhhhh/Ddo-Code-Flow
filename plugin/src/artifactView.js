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
  '.md', '.markdown', '.txt', '.json', '.js', '.mjs', '.cjs', '.ts', '.html', '.htm',
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

/** E 区登记文件 → 内联模型（content=null 时 note 说明原因；rel=树展示路径）。 */
function collectArtifacts(state) {
  const bases = [state.dirs.runDir, state.dirs.projectRoot].filter(Boolean);
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

/** 产出浏览器模型总装。 */
function buildBrowser(state) {
  return { files: collectArtifacts(state), git: collectGitChanges(state) };
}

module.exports = { buildBrowser, collectArtifacts, collectGitChanges, TEXT_EXT, MAX_FILE_BYTES };
