# Part 01：合并解析实现注记

> 所属 plan.md revision: 1 · 状态: current · 性质：编码施工注记（契约以 plan.md 为准）

## 调用点清单（BASE-5 展开，行号为当前 worktree 实测）

**config.json 读取点（全部改经 `readTaskConfig`/`findTaskDir`）：**

| # | 位置 | 当前代码形态 | 改法 |
|---|---|---|---|
| 1 | cli.js:92（outputDecls） | `path.join(tasksDir, stageId, 'config.json')` | readTaskConfig |
| 2 | cli.js:605（runStart 旋钮预填） | `path.join(tasksDir, s.task, 'config.json')` | readTaskConfig |
| 3 | cli.js:1027（guideWorktreeQuestion） | git-worktree 读取 | readTaskConfig（内置任务，行为不变） |
| 4 | workflow.js:218-221（expandStages 存在性+校验） | existsSync(prompt.md+config.json) | findTaskDir 后同构检查 |
| 5 | workflow.js:229（phaseType） | join+read | readTaskConfig |
| 6 | workflow.js:237（nextPhase） | join+read | readTaskConfig |
| 7 | workflow.js:301（standardOptions） | join+read | readTaskConfig |
| 8 | workflow.js:325（buildGate） | join+read | readTaskConfig |
| 9 | assemble.js:163（applyConfigOverrides） | join+read | readTaskConfig |
| 10 | subflow.js:61（prefillAtomTasks） | join+read | readTaskConfig |

**taskDir 直接消费点：**

| # | 位置 | 说明 |
|---|---|---|
| 11 | cli.js:393（phaseContext） | `path.join(tasksDirFor(...), taskName)` → findTaskDir；exec/validate 共用咽喉 |
| 12 | workflow.js:214（expandStages） | 任务存在性校验 |

**预设加载点：**

| # | 位置 | 改法 |
|---|---|---|
| 13 | cli.js:596（runStart） | loadWorkflow → loadWorkflowMerged(f['workflows-dir'], name) |
| 14 | subflow.js:103（subflowStart） | 同上（DEC-6） |
| 15 | cli.js:1246（listWorkflows） | 缺省分支：双源扫描合并 + 同名冲突 + source 字段 |

## 错误文案草案

- 预设冲突：`workflow 预设同名冲突: <name>（builtin: <path1>；user: <path2>）——重命名或删除其一；内置预设不被遮蔽`
- 任务冲突：`原子任务同名冲突: <task>（builtin: <path1>；user: <path2>）——重命名或删除其一`
- 预设不存在（零命中）：沿用既有消息形态，「现有」清单改为两源并集。

## 测试组织（sources.test.js）

- 沙箱：沿用 start.test.js 的 mkdtemp + DDO_HOME 指内约定。
- 夹具构造器：`registerUserFlow(sb, name, {tasks, stages})` —— 写 `<ddoHome>/workflows/<name>.json` 与 `<ddoHome>/atom-tasks/<task>/{config.json,prompt.md}`（最小合法 config：name/version/desc）。
- 用例组：① 合并列出与 source 标注；② 本地预设按名启动（混引内置任务，走 exec/validate/next 一轮）；③ 预设同名冲突（list 与 run start 双拦截）；④ 任务同名冲突（启动期+运行期）；⑤ 空注册等价性（对拍现状输出）；⑥ 显式 flag 密闭性（--workflows-dir/--tasks-dir 指定时 user 源不生效）。
- 既有测试增补：list.test.js（①）、start.test.js（②的 CLI 层）、guide.test.js（mode 选项含本地预设）。

## 实现顺序建议

1. sources.js + sources.test.js（纯新增，先行可测）；
2. cli.js/workflow.js/assemble.js/subflow.js 接线（按上方清单逐项）+ 既有测试增补 + 全量回归；
3. SKILL.md「自定义」段文档句。
