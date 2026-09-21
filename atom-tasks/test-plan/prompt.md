# test-plan

> 基于已确认的 spec 生成 checklist 形式验收计划。每条验收项必须以 `- [ ] cmd:` 或 `- [ ] human:` 标记，供验证阶段两段式判定。

<!-- @phase:01 -->
## 生成 test-plan

读取 Context 中的 Alignment Spec（已确认），为其中每个 AC-N / FR-N 推导一个或多个 checklist 条目，使用两种前缀：

- `- [ ] cmd: <shell>` —— **自动化测试**（单元/接口/shell 验证），机器执行，exit code == 0 为通过；
- `- [ ] human: <描述>` —— **功能测试**（页面/客户端实际操作），由用户手动执行并确认。

条目组织为 `## G<N>. <分组>` 分组，每组末尾一行「通过标准」摘要。将产物写入 run 目录 `test-plan.md` 并向用户展示。
<!-- /phase:01 -->

<!-- @phase:02 -->
## 确认门

<!-- @interact:required tool=ask-user -->
必须调用宿主提问工具向用户请求确认，未获得明确回复前不得调用任何推进命令。
<!-- /interact -->

展示 test-plan 摘要与分组统计，提供：`同意`（批准，进入下一相位）、`修改：<反馈>`（回到生成并按反馈更新）、`提问：<问题>`（只答疑）。用户驳回时执行 `rollback --stage test-plan --reason <意见>`。
<!-- /phase:02 -->

<!-- @phase:03 -->
## TDD 测试骨架（仅 run 配置开启 tdd 时执行）

用户已确认 test-plan 后，若 run 配置（state.atomTasks.test-plan.tdd）为 true：

1. 检测项目测试框架（JUnit/Mocha/pytest 等）与测试目录约定；
2. 为每个 `- [ ] cmd:` 条目生成测试方法/函数桩：描述性名称匹配条目 ID、含 Arrange/Act/Assert 注释、标记 pending/skip/throw（Red 状态）；
3. 测试文件写入检测到的测试目录；在 test-plan.md 末尾追加「TDD 测试文件」section 列出文件与状态。

tdd 未开启则跳过本相位，任务完成。
<!-- /phase:03 -->
