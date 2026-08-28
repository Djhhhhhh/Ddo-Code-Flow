# task-03: 提交模版到特性分支并核验变更范围

- 关联验收点：G3（TP-07、TP-08、TP-10）
- 依赖：task-01、task-02
- 状态：pending

## 目标

将唯一交付文件 `atom-tasks/plan/references/ddo.md` 提交到 `feat/2026-08-29-plan-archive-capability` 分支；确保提交范围恰为该文件（TDD 脚手架与其他运行文件一律不提交），并复跑 DAG 校验确认技能包结构仍自洽。

## 涉及文件

- `atom-tasks/plan/references/ddo.md`（git add + commit，唯一入库变更）

## 实现要点

- 仅 `git add atom-tasks/plan/references/ddo.md`；不得使用 `git add -A`/`git add .`，避免把 TDD 脚手架、.ddo 运行产物或其他未跟踪文件带入提交。
- 提交信息关联 issue：`feat(plan): 新增 ddo 归档模版（issue #36 技术方案设计模板）`。
- 提交后核验：`git diff main --name-status` 输出恰为一行 `A	atom-tasks/plan/references/ddo.md`；机制文件清单（plan.md、plan.output.schema.json、artifacts.json、state.schema.json、workflows/、.gitignore）对 main 零差异。
- 以工作树为 skillRoot 复跑 `validate-dag workflows/guarded.json`（TP-10）。

## 验收

- [ ] cmd: git diff main --name-status 输出恰为 A	atom-tasks/plan/references/ddo.md（TP-07）
- [ ] cmd: git diff main --name-only -- atom-tasks/plan/plan.md atom-tasks/plan/plan.output.schema.json atom-tasks/artifacts.json state.schema.json workflows/ .gitignore 输出为空（TP-08）
- [ ] cmd: node scripts/runtime/ddo.js validate-dag --skill-root . --workflow workflows/guarded.json（TP-10）
