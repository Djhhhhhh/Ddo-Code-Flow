'use strict';
// D5 git 推断链（06 plan §3.2）三档：非 git 短路 → 仓库推断（mainBranch）→ worktree 探测。
// 第三档（WTT 机制，注册内置、创建留任）：projectRoot 位于 worktree 时捕获
// branch / worktreePath —— 创建动作归 git-worktree 前置任务，注册归本推断（零参数）。
// 返回 { mainBranch }（主检出/非 git）或 { mainBranch, branch, worktreePath }（worktree）；
// 字段必存、值可空（02 v1.1 修正）：branch 探测失败置空串，不阻断启动。

const path = require('path');
const { spawnSync } = require('node:child_process');

function gitInfo(projectRoot) {
  const git = (args) => spawnSync('git', args, { cwd: projectRoot, encoding: 'utf8' });

  const inside = git(['rev-parse', '--is-inside-work-tree']);
  if (inside.status !== 0 || String(inside.stdout).trim() !== 'true') return { mainBranch: '' };

  // ① 远程默认分支（origin/HEAD，如 refs/remotes/origin/main → main）
  let mainBranch = 'main'; // ③ 常量兜底
  const originHead = git(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  if (originHead.status === 0) {
    const ref = String(originHead.stdout).trim();
    if (ref.startsWith('origin/')) mainBranch = ref.slice('origin/'.length);
  } else {
    // ② 本地 init.defaultBranch
    const def = git(['config', '--get', 'init.defaultBranch']);
    if (def.status === 0 && String(def.stdout).trim()) mainBranch = String(def.stdout).trim();
  }

  // 第三档：git-dir ≠ common-dir（绝对化后比较）⇒ 位于 worktree（submodule 同判定）；
  // 任何探测 git 失败 ⇒ 视为不在 worktree，不产出新字段，不阻断启动
  const commonDir = git(['rev-parse', '--path-format=absolute', '--git-common-dir']);
  const gitDir = git(['rev-parse', '--path-format=absolute', '--git-dir']);
  const norm = (r) => String(r.stdout).trim().replace(/\/+$/, '');
  if (commonDir.status === 0 && gitDir.status === 0 && norm(commonDir) !== norm(gitDir)) {
    const br = git(['branch', '--show-current']); // detached HEAD → status 0 但输出空
    return { mainBranch, branch: br.status === 0 ? String(br.stdout).trim() : '', worktreePath: path.resolve(projectRoot) };
  }
  return { mainBranch };
}

module.exports = { gitInfo };
