# Ddo-Code-Flow 测试计划

> 基于已确认的 spec（revision 2）与 plan（revision 1）生成的验收测试 checklist。cmd = 自动化（exit code 0 为通过），human = 手动。所有 cmd 均可在 worktreePath 内无 sudo、无网络执行。

## G1. 模版文件存在与命名命中（AC-1）

- [ ] cmd: `test -f atom-tasks/plan/references/ddo.md` （TP-01：模版文件存在）
- [ ] cmd: `ls atom-tasks/plan/references/ | grep -qx 'ddo.md'` （TP-02：`归档` 枚举范围 `*.md` 包含 ddo）
- [ ] cmd: `test "$(basename atom-tasks/plan/references/ddo.md .md)" = "ddo"` （TP-03：basename 为 `ddo`，按 plan.md §6 精确匹配规则 `归档：ddo` 命中该文件）

通过标准：模版文件存在、可被 `归档` 枚举、basename 与 `归档：ddo` 参数精确匹配（AC-1）。

## G2. 模版内容忠实性（AC-5）

- [ ] cmd: `awk '/^## Issue 正文/{f=1;next} f' .ddo/runs/feat/2026-08-29-plan-archive-capability/issue-context.md | diff - atom-tasks/plan/references/ddo.md` （TP-04：模版与本 run 登记的 issue #36 正文逐字一致，diff 无输出）
- [ ] cmd: `for h in '一、需求描述' '二、技术方案详情' '2.1 整体架构' '2.2 技术选型与方案对比' '2.3 业务详细流程' '2.4 接口设计' '2.5 算法设计' '2.6 数据结构设计' '2.7 错误码设计'; do grep -q "$h" atom-tasks/plan/references/ddo.md || exit 1; done` （TP-05：章节骨架齐全）
- [ ] cmd: `grep -q '统一使用 Mermaid' atom-tasks/plan/references/ddo.md && grep -q '禁止 PlantUML' atom-tasks/plan/references/ddo.md && grep -q 'N/A' atom-tasks/plan/references/ddo.md && grep -q 'drivesDownstream=false' atom-tasks/plan/references/ddo.md && grep -q 'staleWhenPlanRevisionChanges=true' atom-tasks/plan/references/ddo.md && grep -q '归档不代表 Plan 批准' atom-tasks/plan/references/ddo.md` （TP-06：Mermaid-only / N/A 规则 / 归档属性声明在模版中）

通过标准：模版内容与 issue #36 正文逐字一致，章节骨架、Mermaid-only、N/A 规则与归档属性声明完整（AC-5）。

## G3. 归档机制不回归（AC-2、AC-3、AC-4）

- [ ] cmd: `git diff main --name-status` 输出恰为 `A	atom-tasks/plan/references/ddo.md`（TP-07：全部变更仅新增模版文件，机制文件零改动 → `drivesDownstream=false`、revision 变化即 stale、归档非批准语义由既有机制原样保证；前置：coding 已将变更提交到特性分支）
- [ ] cmd: `git diff main --name-only -- atom-tasks/plan/plan.md atom-tasks/plan/plan.output.schema.json atom-tasks/artifacts.json state.schema.json workflows/ .gitignore` 输出为空（TP-08：机制与边界文件显式零差异）
- [ ] cmd: `node --test scripts/runtime/test/` （TP-09：运行时测试基线全绿，exit 0）
- [ ] cmd: `node scripts/runtime/ddo.js validate-dag --skill-root . --workflow workflows/guarded.json` （TP-10：以本工作树为 skillRoot，角色可达性校验仍通过）

通过标准：diff 仅含新增模版、机制文件零差异、测试基线与 DAG 校验全绿（AC-2、AC-3、AC-4 的不回归证据）。

## G4. 端到端归档体验（部署后）

- [ ] human: 变更同步到部署副本（~/.claude/skills/Ddo-Code-Flow）后，在任一含 planning 阶段的真实 run 中输入 `归档` → 模版列表显示 `ddo`；输入 `归档：ddo` → run 产物目录生成/刷新 tech-design.md，内容按 issue #36 模板章节组织，且记录模板名 `ddo` 与来源 Plan revision；确认 planning 确认门状态未因归档改变（AC-1、AC-4）
- [ ] human: 对 Plan 做一次 `修改：<任意反馈>` 使 revision 变化后，再次输入 `归档：ddo` → 归档被刷新且记录新 revision（验证 stale 后重新归档语义）；随后进入后续阶段，确认归档文档未出现在任何下游节点输入中（AC-2、AC-3）

通过标准：端到端枚举、归档、stale 后刷新、不驱动下游与不影响确认门的行为全部符合 issue #36 归档属性（AC-1/2/3/4）。

## TDD 测试文件

| 测试文件 | 关联检查项 | 状态 |
|---|---|---|
| scripts/runtime/test/plan-archive-template.test.js | TP-01, TP-02, TP-03, TP-04, TP-05, TP-06, TP-07, TP-08, TP-09, TP-10（G1/G2/G3 全部 cmd 项） | Red（it.skip 骨架，可运行、0 fail） |
