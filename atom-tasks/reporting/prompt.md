# reporting

> 汇总各阶段产物与验证结果，生成本次 run 的 execution-report。

## 指令

按 output schema 的 sections 组织 execution-report.md，填充：

1. run 元数据：state 中的 runId、title、startedAt、currentStage、stages 概览；
2. 产物清单：run 目录下实际存在的各阶段产物（spec/plan/test-plan/tasks/verification.log 等）与路径；
3. 验证摘要：从 Context 的验证日志推导通过/失败计数（日志缺失则写「验证未执行」）；
4. 上下文缺失：Context Summary 的「上下文缺失」列表（如存在）；
5. 决策日志：原样引用 state 的历史与关键事件；
6. 显式链接各核心产物文件。
