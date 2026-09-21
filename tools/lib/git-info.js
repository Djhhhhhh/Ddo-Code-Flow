'use strict';
// D5 git 推断链（06 plan §3.2）：worktree 注册值（git-worktree 任务，后续轮）
// → 当前仓库推断 → 置空。run start 只做后两档。
// 返回 { mainBranch }——字段必存、值可空（02 v1.1 修正）。

const { spawnSync } = require('node:child_process');

function gitInfo(projectRoot) {
  const git = (args) => spawnSync('git', args, { cwd: projectRoot, encoding: 'utf8' });

  const inside = git(['rev-parse', '--is-inside-work-tree']);
  if (inside.status !== 0 || String(inside.stdout).trim() !== 'true') return { mainBranch: '' };

  // ① 远程默认分支（origin/HEAD，如 refs/remotes/origin/main → main）
  const originHead = git(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  if (originHead.status === 0) {
    const ref = String(originHead.stdout).trim();
    if (ref.startsWith('origin/')) return { mainBranch: ref.slice('origin/'.length) };
  }
  // ② 本地 init.defaultBranch
  const def = git(['config', '--get', 'init.defaultBranch']);
  if (def.status === 0 && String(def.stdout).trim()) return { mainBranch: String(def.stdout).trim() };
  // ③ 常量兜底
  return { mainBranch: 'main' };
}

module.exports = { gitInfo };
