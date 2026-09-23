'use strict';
// 生效工作目录判定（09 spec FR-WT-1/2/5，全任务统一，单一实现点）：
// state.git.worktreePath 非空字符串 → worktree 分支；缺失或空串 → projectRoot 分支。
// mainBranch 不参与判定——basic 链无 worktree 时它也非空（09 plan §2）。
// 各任务 ctx 钩子共用本判定并注入「## Context: 工作目录」；prompt 只引用不判定（D12）。

const path = require('path');

/** projectRoot：<projectRoot>/.ddo/runs/<type>/<dirName>/.state.json 上溯四级（02 基线布局）。 */
function projectRootOf(statePath) {
  let dir = path.dirname(path.resolve(statePath));
  for (let i = 0; i < 4; i++) dir = path.dirname(dir);
  return dir;
}

function resolveWorkdir(state, statePath) {
  const wt = state && state.git && state.git.worktreePath;
  if (typeof wt === 'string' && wt) {
    return {
      branch: 'worktree',
      dir: wt,
      ctx: `## Context: 工作目录\n\n- 生效工作目录：${wt}\n- 本次仅在上述工作树内创建/修改文件与执行命令，不得触碰主工作树或其他路径。`,
    };
  }
  const projectRoot = projectRootOf(statePath);
  return {
    branch: 'project-root',
    dir: projectRoot,
    ctx: `## Context: 工作目录\n\n- 生效工作目录：${projectRoot}（当前项目目录）\n- 本次不涉及 worktree：不得创建或依赖 git.worktreePath，所有改动与命令执行限定在上述目录内。`,
  };
}

module.exports = { resolveWorkdir, projectRootOf };
