# task-09 — verification atom-task + verification_template.md

## 目标
落地 Verification 阶段的 atom-task：能解析 test-plan.md 中的 `cmd:` 与 `human:` 条目并据此判定，失败回到 Coding。

## 范围
- `skills/ddo-swe/atom-tasks/verification/verification.json`
- `skills/ddo-swe/atom-tasks/verification/verification_template.md`

## 依赖
- task-01
- task-07（必须先确定 test-plan 的语法约定）

## 关联验收点
- G3.1 / G3.2
- G5.3：Verification 失败回退到 Coding 直至全过。

## 步骤
1. `verification.json`：
   - `name = "verification"`, `stage = "verification"`, `enabled = true`。
   - `description`：依据 test-plan.md 的 checklist 验收编码结果；失败回到 Coding。
   - `io.inputs`: `skill://atom-tasks/verification/verification_template.md`（required）+ `run://test-plan.md`（required）。
   - `io.outputs`: `run://verification.log`（kind: text，required）。
   - `prompt.guardrails` 至少含：
     - "解析 `- [ ] cmd: <shell>` 并执行；exit code = 0 视为通过，输出与错误写入 verification.log"
     - "解析 `- [ ] human: <desc>` 则展示给用户、等待勾选；不要自行判定"
     - "任一项失败 → 状态 failed，回到 Coding"
     - "全部通过 → verification.log 末尾写 ALL PASSED"
     - "禁止 sudo / 禁止动 targetDir 外部资源"
2. `verification_template.md`：
   - 解析与执行流程的伪步骤；
   - log 行格式：`[PASS] <id> <desc>` / `[FAIL] <id> <desc> :: <stderr-summary>`；
   - 末尾 `ALL PASSED` 标识符。

## 产物
- `verification.json`
- `verification_template.md`
