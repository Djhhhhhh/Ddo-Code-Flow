# verification

> 按 test-plan 的两段式 checklist 验收：`cmd:` 自动执行比对 exit code，`human:` 展示给用户确认。结果写入 verification.log；全部通过以 `ALL PASSED` 收尾。

<!-- @interact:required tool=ask-user -->
本次验证包含人工检查项（`human:` 条目）：必须使用宿主提问工具逐项向用户展示并获取通过/失败确认，不得代答、不得跳过；未完成前不得宣告通过。
<!-- /interact -->

## 指令

**test-plan 存在时**：逐行解析。对每条 `^- \[ \] cmd: (.+)$`：在「Context: 工作目录」声明的生效目录中执行（去除反引号与尾部标点），捕获 stdout/stderr 与 exit code，结果行追加到 `verification.log`（单条超时 >120s 记 [FAIL]）。对每条 `human:`：不执行，收集到「人工检查清单」，逐项向用户展示并记录其通过/失败回答。按 `## G<N>.` 分组，每组末尾输出 `GROUP G<N> PASSED` 或 `GROUP G<N> FAILED: <n> failing`。

**test-plan 缺失时**（轻量流程）：读取 Context 中的 Alignment Spec 与可选 Plan，从生效工作目录已有配置发现最小、确定性的现有测试或静态检查命令并执行；逐项核对 spec 验收条件是否实现；结果作为 `LIGHTWEIGHT` 分组写入日志。不得仅因 test-plan 缺失而跳过验证或宣告成功。

## 终止条件

- 全部自动检查通过且人工检查均已确认为通过 → 追加最终行 `ALL PASSED`；
- 存在失败 → 记录失败分组与命令，**不写 ALL PASSED**；按执行循环策略处理：优先 `rollback --stage coding --reason <失败摘要>` 重修，重试超限（默认 2 轮，run 配置 maxRetries 可调）则 `run finish --status failed`；
- 仅存在未确认的人工检查 → 等待用户确认（对应 stage 状态 waiting-human），不得进入后续阶段。
