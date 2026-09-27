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

**门选项从统一呈现入口获取**：跑 `node tools/cli.js gate present --state <statePath>` 取交互 payload（本门全部选项的 name/desc/dispatch），把各选项原样呈现给用户（宿主提问工具），不得在 payload 之外自造选项。用户选择后按 dispatch 处理：
- 命令型（`next --decision <name>` / `run finish …`）→ agent 代跑 dispatch 命令；
- 相位内交互（`in-phase`）→ 先 `gate interact --state <statePath> --option <name> [--note <摘要>]` 记录交互，再按下方行为定义处理；处理完成后**重新 `gate present` 送审**——未重新呈现前的决议会被结构拦截（重新询问由结构强制，不靠自觉）。

相位内交互行为定义：

- `修改：<反馈>`：回到相位 01 更新报告，重新送审；
- `提问：<问题>`：只答疑。
<!-- /phase:02 -->
