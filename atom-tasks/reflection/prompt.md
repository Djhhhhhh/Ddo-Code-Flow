# reflection

> 检查本次 run 的未完结事项（TODO / 遗留风险 / 经验），生成 reflection-report；用户确认后进入结束流程。

<!-- @phase:01 -->
## 生成复盘报告

1. 在「Context: 工作目录」声明的生效目录中扫描本次 run 新增/修改的 TODO、FIXME、XXX 标记（引用文件路径与行号）；
2. 结合 Context 中的 Execution Report 与本次 run 的决策/验证历史，生成 `reflection-report.md`：未完结项、推荐后续动作（须为可执行任务而非自由文本）、经验教训；
3. 末尾追加标准「用户确认」section。
<!-- /phase:01 -->

<!-- @phase:02 -->
## 确认门

<!-- @interact:required tool=ask-user -->
必须调用宿主提问工具向用户请求确认，未获得明确回复前不得调用任何推进命令。
<!-- /interact -->

向用户展示复盘摘要。

**门选项从确认门数据呈现**：读 state 的 `stages.reflection.gate.options`（可经 `status` 获取），把每个选项的 name/desc 原样呈现给用户。用户选择后按 action 处理：
- 命令型（`next --decision <name>` / `rollback --stage …` / `run finish …`）→ agent 代跑该命令；
- 相位内交互（`in-phase`）→ 按下方行为定义处理，不触任何推进命令。
不得在门数据之外自造推进/回滚选项。

相位内交互行为定义：

- `修改：<反馈>`：回到相位 01 更新报告，重新送审；
- `提问：<问题>`：只答疑。
<!-- /phase:02 -->
