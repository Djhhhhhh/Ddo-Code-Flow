# test-scope

> 测试工作流首阶段：设定测试范围并固化范围确认文档——所列范围与设定内容严格一致，不多也不少。

<!-- @phase:01 -->
## 设定测试范围

<!-- @interact:required tool=ask-user -->
范围来源必须经宿主提问工具由用户选定/提供，未获得用户明确回复前不得产出范围确认文档，也不得调用任何推进命令。
<!-- /interact -->

1. **扫描候选**：在项目根（state.dirs.projectRoot）的 `.ddo/runs/` 下递归查找 `.state.json`（排除本次 run 自身的 runDir）。逐份读取 runId/title/type 与当前位置，形成候选清单。
2. **问询来源**（固定两类选项）：
   - **用户输入**：由用户描述测试范围（功能/模块/文件/场景）；
   - **选定某个既有 run 的 .state.json** 作为范围来源（多份候选时列出清单供用户选定；无候选时仅提供用户输入并说明原因）。
3. **提取范围内容**：
   - `.state.json` 来源：读取该次运行的**目标**（title）、**阶段清单**（stages 各键及状态摘要）、**关联代码变更**——按该 run 的 git.branch 与 git.mainBranch，在其 projectRoot（git.worktreePath 优先）执行 `git diff --name-only <mainBranch>...<branch>`；分支或基线不可得时如实标注「变更不可得」，不得编造。
   - 用户输入来源：将用户描述整理为范围条目，保留原语义，不改写、不扩写。
4. 写入 run 目录 `test-scope.md`：`## 范围来源`（类型 + 定位：用户输入原文 或 runId/statePath）、`## 范围条目`（目标 / 阶段 / 变更 或用户条目，逐项列出）、`## 确认记录`（本轮问询与用户回答摘要）。
<!-- /phase:01 -->

<!-- @phase:02 -->
## 确认门

<!-- @interact:required tool=ask-user -->
必须调用宿主提问工具向用户请求确认，未获得用户明确回复前不得调用任何推进命令。
<!-- /interact -->

向用户展示范围确认文档摘要（来源 + 范围条目数 + 三类条目概览）。

**门选项从统一呈现入口获取**：跑 `node tools/cli.js gate present --state <statePath>` 取交互 payload（本门全部选项的 name/desc/dispatch），把各选项原样呈现给用户（宿主提问工具），不得在 payload 之外自造选项。用户选择后按 dispatch 处理：
- 命令型（`next --decision <name>` / `rollback --stage …`）→ agent 代跑 dispatch 命令；
- 相位内交互（`in-phase`）→ 先 `gate interact --state <statePath> --option <name> [--note <摘要>]` 记录交互，再按下方行为定义处理；处理完成后**重新 `gate present` 送审**——未重新呈现前的决议会被结构拦截。

相位内交互行为定义：

- `修改：<反馈>`：按反馈更新范围条目（仍遵守不多也不少），展示变化摘要后重新送审；
- `提问：<问题>`：只答疑，不修改产物、不改变确认状态。
<!-- /phase:02 -->
