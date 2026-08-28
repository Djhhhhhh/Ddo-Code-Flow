# task-02: TDD 骨架 Red→Green（run 内脚手架，不提交）

- 关联验收点：G1/G2/G3 全部 cmd 项（TP-01~10 的测试承载）
- 依赖：task-01
- 状态：pending

## 目标

将 `scripts/runtime/test/plan-archive-template.test.js` 的 10 个 `it.skip` 骨架实现为 Green 断言，作为本次 run 内的验收脚手架；按用户决定该文件不随分支提交。

## 涉及文件

- `scripts/runtime/test/plan-archive-template.test.js`（修改：去 skip、补全断言；不进入提交）

## 实现要点

- TP-01~06、TP-08、TP-10：去掉 `it.skip` 的 skip，断言保持骨架注释中的契约。
- TP-07：依赖 task-03 的提交；断言 `git diff main --name-status` 恰为 `A\tatom-tasks/plan/references/ddo.md`。
- TP-09：套件内自运行会递归——按骨架注释保留为 skip，由 verification 阶段在套件外部执行 `node --test scripts/runtime/test/` 覆盖，不得在套件内 spawn 自身。
- 全部实现后 `node --test scripts/runtime/test/` 必须 exit 0（TP-09 skip 不计失败）。

## 验收

- [ ] cmd: node --test scripts/runtime/test/plan-archive-template.test.js（exit 0，fail 0；仅 TP-09 保留 skip）
- [ ] cmd: node --test scripts/runtime/test/（全套件 exit 0）
