# eval-prepare

> 收集并校验 model-quick-eval 评测参数，产出 eval-config.json（eval-run 阶段的唯一参数来源）。

## 指令

1. **读取预填**：从 Context 的 `state.atomTasks['eval-prepare']` 读取启动预填
   （`run start --config eval-prepare.<key>=<JSON>` 可预填 model / baseline_sid / ddo_sid /
   tasks / reports / dry_run / arm_timeout）。预填值视为用户已确认，不重复问询。

2. **补齐缺失参数**——**单轮一次问齐**：把全部缺失参数放在同一次问询中呈现
   （按「问询呈现」规则：优先宿主提问工具，降级文本问答；用户可并列作答，逐项对应；
   六+一旋钮预填机制维持不变）：
   - `model`（可缺省）：被测模型名。缺省 = 两臂不带 `--model`，直接用本地 claude 已配置的
     当前模型（真实模型名由评测回执自动解析进报告与轮次指纹）；用户本地用 cc-switch 等
     配置模型时，推荐缺省直跑；
   - `baseline_sid` / `ddo_sid`：两个**不相同**的会话 ID——用户可用 `uuidgen` 各生成一个；
   - `tasks`：题单。列出可选题（仓库根 = `state.dirs.tasksDir` 的上一级；
     枚举 `eval/bench/bank/core/` 下的题目录，读各题 `qpack.json` 标注 form 与 track）；
     题组自由组成（1–n 题、顺序与形态不限），题组策略由使用者自行定义；
   - `reports`（**装配旋钮，只回显不问询**）：读取 `state.atomTasks['eval-prepare'].reports`
     预填值（含缺省 `[]`），向用户回显「本轮装配的平台报告任务 = <按值映射的 report-* 任务名
     或 无>」。装配在 run start 时已发生（合法值 sheet/wechat/xiaohongshu；card/summary 为
     核心集恒产不在此列），事后改值无效，如需变更须新开 run；
   - `dry_run`（可缺省）：是否链路自验模式；
   - `arm_timeout`（可缺省）：单臂超时分钟数。缺省不写入 = 编排器按 30 分钟执行；
     题单含页面题（form=page）时建议 60（ddo 臂流程文档纵深大，30 分钟实测不够走完全程，
     超时臂判「不可比」）。

   问询期两条防呆（本阶段仅有的自查规则）：`baseline_sid = ddo_sid` 时指出并要求重新提供；
   非 dry_run 时不得接受占位/示例 ID（如 sid-b-001）。其余参数规则（题包存在、
   题面平台版本锁等）由编排器启动时校验；若被拦截，将拦截原因
   原样转述用户，修正须回本阶段重新确认并改写 eval-config.json，
   不得只在命令行临时改参。

3. **校验**：执行 eval-prepare.output.schema.json 的 rules（即上述两条防呆 + 引用句）。
   任何一条不过，向用户说明并重新收集，不带错写入。

4. **写产物**：将确认后的参数写 `eval-config.json` 到 runDir（结构按 output schema 的
   jsonFields；`reports` 写装配回显值——预填值或缺省 `[]`），并在回复中回显参数清单
   （含平台报告任务装配回显行）请用户过目。

## 边界

- 只收集参数，不预跑、不检查环境（cc-switch 可读性等由 eval-run 的编排器 preflight 负责）。
- 用户未答复的参数保持空缺并继续问询，不得代填或用示例值占位
  （arm_timeout 未答复即不写入，缺省语义由编排器承载）。
