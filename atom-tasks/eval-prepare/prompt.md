# eval-prepare

> 收集并校验 model-quick-eval 评测参数，产出 eval-config.json（eval-run 阶段的唯一参数来源）。

## 指令

1. **读取预填**：从 Context 的 `state.atomTasks['eval-prepare']` 读取启动预填
   （`run start --config eval-prepare.<key>=<JSON>` 可预填 model / baseline_sid / ddo_sid /
   tasks / reports / dry_run）。预填值视为用户已确认，不重复问询。

2. **补齐缺失参数**（按「问询呈现」规则：优先宿主提问工具，降级文本问答；一项一项问）：
   - `model`（可缺省）：被测模型名。缺省 = 两臂不带 `--model`，直接用本地 claude 已配置的
     当前模型（真实模型名由评测回执自动解析进报告与轮次指纹）；用户本地用 cc-switch 等
     配置模型时，推荐缺省直跑；
   - `baseline_sid` / `ddo_sid`：两个**不相同**的会话 ID——用户可用 `uuidgen` 各生成一个；
     相同则指出并要求重新提供（A/B 控变量硬约束）；
   - `tasks`：题单。列出可选题（仓库根 = `state.dirs.tasksDir` 的上一级；
     枚举 `eval/bench/bank/core/` 与 `eval/bench/bank/rotating/` 下的题目录，
     标注 core/rotating 与 kind）；提醒题组规则：2–3 题、题 1 页面题、核心集 ≥1；
   - `reports`（可缺省）：报告形式子集，注册表 card / sheet / summary / wechat / xiaohongshu；
     缺省 = card+sheet+summary；
   - `dry_run`（可缺省）：是否链路自验模式。

3. **校验**：执行 eval-prepare.output.schema.json 的 rules（sid 不等、题组规则、
   reports ⊆ 注册表、非 dry_run 时不得含测试占位 ID）。任何一条不过，向用户说明并重新收集，
   不带错写入。

4. **写产物**：将确认后的参数写 `eval-config.json` 到 runDir（结构按 output schema 的
   jsonFields），并在回复中回显参数清单请用户过目。

## 边界

- 只收集参数，不预跑、不检查环境（cc-switch 可读性等由 eval-run 的编排器 preflight 负责）。
- 用户未答复的参数保持空缺并继续问询，不得代填或用示例值占位。
