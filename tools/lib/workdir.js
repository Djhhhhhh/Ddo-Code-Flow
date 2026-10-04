'use strict';
// 生效工作目录判定（09 spec FR-WT-1/2/5，全任务统一，单一实现点），三分支按序：
// multi（git.multiRepo=true 且 repos 非空）→ worktree（git.worktreePath 非空）→ projectRoot。
// mainBranch 不参与判定——basic 链无 worktree 时它也非空（09 plan §2）。
// 各任务 ctx 钩子共用本判定并注入「## Context: 工作目录」；prompt 只引用不判定（D12）。

const path = require('path');

/** projectRoot（历史回落）：<projectRoot>/.ddo/runs/<type>/<dirName>/.state.json 上溯四级（02 基线布局）。
 *  临时模式 runDir 在 ~/.ddo/tmp 下，上溯结果错误——projectRoot 一律优先 state.dirs 显式声明（11）。 */
function projectRootOf(statePath) {
  let dir = path.dirname(path.resolve(statePath));
  for (let i = 0; i < 4; i++) dir = path.dirname(dir);
  return dir;
}

function resolveWorkdir(state, statePath) {
  // multi 分支（多仓库隔离模式）：锚 = 主仓库工作树（repos[0] = git.worktreePath），
  // ctx 列出全部仓库 ↔ 工作目录映射——各仓库改动落其对应工作树，run 材料（.ddo）在容器根。
  const g = state && state.git;
  if (g && g.multiRepo === true && Array.isArray(g.repos) && g.repos.length) {
    const primary = g.repos[0];
    const list = g.repos
      .map((r) => `- ${r.name}（${r.role === 'primary' ? '主仓库' : '成员仓库'}）：${r.worktreePath}`)
      .join('\n');
    return {
      branch: 'multi-repo',
      dir: primary.worktreePath,
      ctx: `## Context: 工作目录\n\n- 生效工作目录（主仓库锚点）：${primary.worktreePath}\n- 本次为多仓库隔离 run，容器根：${g.container}；run 材料（.ddo）位于容器根，不属于任何仓库。\n- 涉及的全部工作目录：\n${list}\n- 各仓库的文件改动与命令执行限定在其对应工作目录内；分支与归属见 state.git.repos。`,
    };
  }
  const wt = state && state.git && state.git.worktreePath;
  if (typeof wt === 'string' && wt) {
    return {
      branch: 'worktree',
      dir: wt,
      ctx: `## Context: 工作目录\n\n- 生效工作目录：${wt}\n- 本次仅在上述工作树内创建/修改文件与执行命令，不得触碰主工作树或其他路径。`,
    };
  }
  const projectRoot = (state && state.dirs && state.dirs.projectRoot) || projectRootOf(statePath);
  return {
    branch: 'project-root',
    dir: projectRoot,
    ctx: `## Context: 工作目录\n\n- 生效工作目录：${projectRoot}（当前项目目录）\n- 本次不涉及 worktree：不得创建或依赖 git.worktreePath，所有改动与命令执行限定在上述目录内。`,
  };
}

module.exports = { resolveWorkdir, projectRootOf };
