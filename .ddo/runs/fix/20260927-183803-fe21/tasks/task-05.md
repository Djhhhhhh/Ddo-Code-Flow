# task-05 测试：新契约全量 + 既有用例更新

## 目标

覆盖 test-plan G1～G4：present/interact/guide 契约、呈现校验、re-ask 闭环、resume 同源、既有测试补 present 前置。

## 涉及文件

- tools/tests/present.test.js（新增）
- tools/tests/gate.test.js、tools/tests/next.test.js、tools/tests/resume.test.js（更新）

## 执行步骤

1. present.test.js（照抄 gate.test.js 范式：mkdtemp 沙箱 + finally 删除 + DDO_HOME 隔离 + --tasks-dir 定制任务 + writeState 注入可控时间戳）：
   - payload 形态：静态选项 name/desc/action/dispatch 齐全；隐式门（无 gate 对象）present 后物化并盖戳；
   - 动态选项：定制 spec 任务 + spec.md 含「## 需要用户确认」两个 BQ → payload 含 回答BQ1/回答BQ2；无 section → 无动态项；
   - 呈现校验：未呈现 next --decision → exit 1、stderr 含「先跑 gate present」与选项清单、stdout blocked:'gate-unpresented'；补 present 后成功且 state 含 presentedAt/decision/closedAt；
   - re-ask 闭环：present → gate interact --option 提问 → next 被拦 → 重新 present → next 成功；interact 对命令型选项报错并列有效 in-phase 名单；
   - rollback 载体：未呈现 rollback --stage 被拦；补呈现后成功；非门 stage 回滚不受影响；
   - state 断言：非法 interactions/presentedAt → exit 1；
   - guide：三问 payload 形态、问模式含仓库真实预设；
   - resume 同源：开门 run 经 resume --run-id 的 gateOptions 与 present payload options 深比较一致（含动态）。
2. gate/next/resume 既有用例：决议前补 `gate present` 步骤；resume 断言更新为含动态选项的同源集合。

## 完成标准

- node --test tools/tests/present.test.js 全绿；node --test tools/tests/ 全量绿（G4）。
