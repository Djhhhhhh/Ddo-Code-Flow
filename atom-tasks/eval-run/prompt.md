# eval-run

> 按 eval-config.json 执行 model-quick-eval A/B 双臂评测，写 eval-result.json，经用户确认门送审。

## 指令

1. **定位仓库根**：`仓库根 = state.dirs.tasksDir 的上一级`（本工作流预设随 ddo-code-flow 仓库分发；
   注意 **≠ `state.dirs.projectRoot`**——评测可在任意项目上启动，编排器与题库始终取自本仓库）。
   编排器入口 = `<仓库根>/eval/bench/cli.js`；不存在则如实报错（本工作流需在装有
   eval/bench 的仓库环境下运行）。

2. **组装命令**（参数只能取自 runDir 的 `eval-config.json`，缺一项即回 eval-prepare 补齐，
   不代填）：

   ```
   node <仓库根>/eval/bench/cli.js run \
     [--model <model>] \
     --tasks <tasks 逗号连接> \
     --baseline-sid <baseline_sid> --ddo-sid <ddo_sid> \
     [--arm-timeout <arm_timeout>] \
     [--dry-run]
   ```

   `model` 缺省时不传 `--model`（两臂用本地 claude 已配置模型，真实模型名由回执解析）。
   `--arm-timeout` **取自 eval-config.json 的 `arm_timeout`**：有值时显式传
   `--arm-timeout <值>`，无值时不传（编排器缺省 30 分钟）。是否需要更大超时在
   eval-prepare 问询时确认（含页面题建议 60），本阶段不做临时裁量。

   `reports` 缺省集（card/sheet/summary）之外有追加时：先在 runDir 写 `eval-profile.json`
   （`{"reports": [...]}`），命令追加 `--profile <runDir>/eval-profile.json`。

3. **执行**：长任务（真实轮单臂可达数十分钟）。**后台启动**评测命令，从启动公告
   （stderr `[轮次开始]`，含 roundId / roundDir / 题单 / 臂超时）定位轮次目录；此后
   **每 2–3 分钟轮询** `<roundDir>/progress.jsonl` 增量，把新事件人话转述给用户
   （无增量则如实说明静默，不虚构进度）；编排器距超时不足 5 分钟会输出 `[预警]`，
   转述时保留该预警。转述话术样例：「评测进行中：题 1/2（q_threejs-orbit-scene）
   双臂已运行 12 分钟——baseline turn 2 完成（21:58），ddo turn 1 完成（21:57）；
   距 60 分钟超时还有 48 分钟。」preflight 拦截（exit 1/2）时把原因原样呈报用户，
   按用户意见修正参数后重试——修正须回 eval-prepare 重新确认并改写 eval-config.json，
   不得只在命令行上临时改参。

4. **写产物**：从 stdout JSON（轮次结果）提取字段，写 `eval-result.json` 到 runDir
   （结构按 output schema 的 jsonFields；questions 的 delta 逐字保留，含无差异/负增益；
   dry_run 时 notes 注明 token 为模拟值）。

5. **送审**：完成相位 01 校验后进相位 02 确认门，向用户呈现：
   - 汇总页路径（`<publish_dir>/summary.md`）与每题卡片路径；
   - 每题增益表（无差异/负增益原样）；
   - dry-run 标注（如适用）。

## 边界

- 不改评测题目、验收工具与判定口径；发现编排器缺陷如实记录进 notes，不就地绕过。
- 运行产物统一隔离在 `<仓库根>/.ddo/eval/` 下：发布产物（summary/卡片/sheet）在
  `.ddo/eval/reports/<轮次>/`，沙箱、事件流与进度事件（progress.jsonl）在
  `.ddo/eval/runs/<轮次>/`；两者是评测运行产物，不并入本 run 的交付清单，也不进源码树。
