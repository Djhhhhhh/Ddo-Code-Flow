# git-worktree

> 启动前置动作：冷启动阶段（`run start` 之前）按问得的需求一句话创建 Git 分支与隔离工作树，随后以 `run start --project <工作树路径>` 落位启动——state 与全部产物落在 worktree 分支内。
>
> **标准时机为启动前置**（state 尚不存在时执行）。被自定义链引用为链内阶段属误用：链内执行时 state 已物化，创建时机已过；此时应跳过创建、仅按本任务 Output Contract 补登记。

## 前提与输入

- 时机：冷启动问答已完成「目标一句话（title）」与「worktree 场景（mode）」确认，`run start` 尚未执行。
- 输入：title（分支名的唯一语义来源）；mode 旋钮（none / single / release-dev）；base_branch / worktree_dir 旋钮（冷启动对话定制，或 `--tasks-dir` 持久定制——消费时点在本问答，state.atomTasks 预填仅为事后登记）。
- mode=none → 本任务不执行，按缺省路径在主检出/当前目录启动 run。

## 执行步骤

1. **生成分支名**：从 title 提取描述性关键词（跳过激活词如「use ddo-code-flow」），转 kebab-case（小写、去特殊字符、空格转连字符），截断到 50 字符。提取失败时向用户索取一句描述后再提取。按 run 类型决定前缀：feature → `feat/`、bugfix → `fix/`，其余沿用有效配置的默认类型。
2. **确定基线**：single → 仓库主分支（与 CLI git-info 同规则推断：origin/HEAD → init.defaultBranch → main）；release-dev → base_branch 旋钮值。
3. **计算目录**：项目名 = 主检出项目根 basename；工作树目录名 = `<项目名>-<分支名（/ 替换为 -）>`；工作树路径 = worktree_dir（缺省为主检出项目根的父目录）拼接该目录名。
4. **创建**：从基线 `git branch <分支名>`（已存在则追加 `-2`、`-3` 直至唯一）→ `git worktree add <工作树路径> <分支名>` → 验证 exit code 为 0 且目录存在；任何 git 失败（非 git 仓库、基线不存在、目录冲突）立即暂停并报告，不得继续——`run start` 尚未发生，天然 fail-fast，不留半截 state。
5. **落位启动**：`run start --project <工作树绝对路径>`（其余参数不变）。state 物化时 git-info 自动捕获 `branch` / `worktreePath`（注册内置，本任务不写 state）。宿主提供 worktree 切换工具时优先使用（不得以 `cd` 代替）；不可用时以绝对路径操作 + `--project` 为等效路径。
6. **后置登记**：`run start` 成功后，将 worktree-info.json 写入 runDir（按 Output Contract）——审计登记产物，state 不读取。

## 约束

- git 建库动作只在主检出执行；不得修改主工作树中的任何文件，代码改动只发生在新工作树。
- 分支与工作树的注册（state.git 写入）由流水线推断完成，本任务只做 Git 层动作与登记产物。
- 工作树路径必须是绝对路径。
