# remote-gate

> 远程门：打信号 label 后轮询审批结果，产出 gate-result.md。用于需要远程（issue 侧）审批后才能推进的阶段。

## 指令

1. 目标 issue 从 Context 的 Issue Context 或 run 配置（state.atomTasks.remote-gate.issueNumber）获取；
2. 为当前阶段的产物（Context 中的阶段产物）在 issue 上打待审批 label（配置 stageName 参与命名），并附摘要评论；
3. **轮询**：周期检查 label 是否被替换为通过信号（通过/驳回 label 或指定评论）；run 配置 localMode=true 时跳过轮询直接放行；
4. 超时（默认 72h，配置 timeoutHours）：按配置动作执行（默认转为 failed 并评论说明）；
5. 结果写入 `gate-result.md`：阶段、产物链接、信号、结论（passed / rejected / timeout）、时间。
