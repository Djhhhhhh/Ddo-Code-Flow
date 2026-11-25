# eval-run

> 按 eval-config.json 执行 model-quick-eval A/B 双臂评测，写 eval-result.json，经用户确认门送审。

## 指令

1. **定位仓库根**：`仓库根 = state.dirs.tasksDir 的上一级`（本工作流预设随 ddo-code-flow 仓库分发）。
   编排器入口 = `<仓库根>/eval/bench/cli.js`；不存在则如实报错（本工作流需在装有
   eval/bench 的仓库环境下运行）。

2. **组装命令**（参数只能取自 runDir 的 `eval-config.json`，缺一项即回 eval-prepare 补齐，
   不代填）：

   ```
   node <仓库根>/eval/bench/cli.js run \
     [--model <model>] \
     --tasks <tasks 逗号连接> \
     --baseline-sid <baseline_sid> --ddo-sid <ddo_sid> \
     [--dry-run]
   ```

   `model` 缺省时不传 `--model`（两臂用本地 claude 已配置模型，真实模型名由回执解析）。

   `reports` 缺省集（card/sheet/summary）之外有追加时：先在 runDir 写 `eval-profile.json`
   （`{"reports": [...]}`），命令追加 `--profile <runDir>/eval-profile.json`。

3. **执行**：长任务（真实轮单臂可达数十分钟）。同步执行并如实转述 stderr 进度；
   preflight 拦截（exit 1/2）时把原因原样呈报用户，按用户意见修正参数后重试——
   修正须回 eval-prepare 重新确认并改写 eval-config.json，不得只在命令行上临时改参。

4. **写产物**：从 stdout JSON（轮次结果）提取字段，写 `eval-result.json` 到 runDir
   （结构按 output schema 的 jsonFields；questions 的 delta 逐字保留，含无差异/负增益；
   dry_run 时 notes 注明 token 为模拟值）。

5. **送审**：完成相位 01 校验后进相位 02 确认门，向用户呈现：
   - 汇总页路径（`<publish_dir>/summary.md`）与每题卡片路径；
   - 每题增益表（无差异/负增益原样）；
   - dry-run 标注（如适用）。

## 边界

- 不改评测题目、验收工具与判定口径；发现编排器缺陷如实记录进 notes，不就地绕过。
- 发布目录（`eval/bench/reports/<轮次>/`）与沙箱（`runs/`）是评测运行产物，
  不并入本 run 的交付清单。
