---
name: test-plan
version: "4.0.0"
enabled: true
timeoutSec: 0
concurrency:
  parallelizable: false
confirmation:
  rejectAction: regenerate-with-feedback
consumes:
  - role: spec
    required: true
produces:
  - role: test-plan
    kind: markdown
    primary: true
outputSchemaRef: "skill://atom-tasks/test-plan/test-plan.output.schema.json"
options:
  - key: tdd
    type: boolean
    default: false
    label: "TDD 模式"
    description: "开启后，用户确认 test-plan 产物后自动为每个 cmd 检查项生成对应的单元测试代码骨架（Red 状态）"
---

# test-plan

> 基于已确认的 `{{inputs.spec}}` 生成 checklist 形式的 test-plan 产物。
> 每条验收项必须用 `- [ ] cmd:` 或 `- [ ] human:` 之一明确标记，供后续验证阶段两段式判定。
> 用户确认后方可进入 Tasking。当 TDD 模式开启时，确认后自动为每个 cmd 检查项生成对应的单元测试代码骨架（Red 状态）。

## 指令

### 阶段 1 — 生成 test-plan 产物

参考 test-plan.output.schema.json 中的 sections 定义和 example 示例来组织输出格式。读取 `{{inputs.spec}}` 中的每个 AC-N 和 FR-N，为每个验收点推导一个或多个 checklist 项。使用以下两种前缀：
- `- [ ] cmd: <shell>` — **自动化测试**：单元测试、接口测试、shell 命令验证等。机器自动执行，exit code == 0 视为通过。
- `- [ ] human: <描述>` — **功能测试**：在页面/客户端上实际操作（点击按钮、输入表单、切换主题、刷新页面等），由用户手动执行并确认。

将条目组织为 G1、G2、... 分组，每个分组末尾有一行「通过标准」摘要。checklist 只能包含针对项目行为的独立验收命令，不得读取 verification.log 或以 Verification 自己将要生成的结果作为前置条件。

将 test-plan 产物写入磁盘并向用户展示以确认。

### 阶段 2 — 生成测试代码（TDD 模式，确认后执行）

仅在用户明确确认 test-plan 产物后才进入此阶段。如果用户拒绝并给出反馈：回到阶段 1，根据反馈更新 test-plan 产物，重新展示确认。

当 options.tdd == true 且用户已确认：
1. 检测项目的测试框架（JUnit/Mocha/pytest 等）和测试目录约定。
2. 为确认的 test-plan 产物中每个 `- [ ] cmd:` 检查项生成对应的测试方法/函数桩。
3. 每个测试桩必须：(a) 有匹配检查项 ID 的描述性名称，(b) 包含 Arrange/Act/Assert 注释概述测试逻辑，(c) 标记为 pending/skip/throw 以表示 Red 状态。
4. 将测试文件写入检测到的测试目录。
5. 在 test-plan 产物末尾追加「TDD 测试文件」section，列出每个生成的测试文件及其状态。

当 options.tdd == false：完全跳过阶段 2，阶段 1 确认后任务即完成。

## 约束

- 每个 checklist 行必须以 `- [ ] cmd:` 或 `- [ ] human:` 开头——其他前缀无效。
- `cmd:` 条目是自动化测试，必须可在 `.state.json.worktreePath` 工作目录中运行，无需 sudo 和网络。
- `cmd:` 条目不得读取 verification.log，也不得依赖当前 Verification 运行尚未生成的文件或成功标记。
- `human:` 条目是功能测试，描述用户应执行的确切步骤和预期观察结果。
- 每个分组必须以「通过标准」行结尾。
- spec 产物中的每个 AC-N 必须至少有一个 checklist 条目覆盖。
- 阶段 2 不得在用户明确确认 test-plan 产物之前开始。
- TDD 模式下，测试桩必须可运行（编译通过），即使处于 Red 状态。
- TDD 模式下，仅为 `cmd:` 条目生成测试，不为 `human:` 条目生成。
