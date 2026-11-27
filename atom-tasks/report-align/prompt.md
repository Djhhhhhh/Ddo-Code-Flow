# report-align

> 报告对齐（#100 跟进）：平台物料渲染**之前**，与用户对齐「主体/客体/读者/核心问题」。
> `cli.js brief --round <id>` 为唯一入口（确定性内核）：无对齐稿生成默认稿（主体=被测模型能力，
> Ddo-Code-Flow=评测方法），已有则原样呈现；用户修改只落在 `report-brief.json`。

## 指令（剧本四步）

1. **定位轮次**：读 runDir 的 `eval-result.json`，取 `round_id`；
   仓库根 = `state.dirs.tasksDir` 的上一级（同 eval-run 口径）。字段缺失即停止并报告，不猜测轮次。

2. **执行子命令**：

   ```
   node <仓库根>/eval/bench/cli.js brief --round <round_id>
   ```

   秒级任务，直接前台执行；exit 非 0 时原样转述 stderr，不自行改参重试。

3. **写留痕**：按 stdout 与确认结果写 runDir 的 `report-align.json`（字段见 output schema）；
   `brief_path` 指向 `runs/<round_id>/report-brief.json`。

4. **对齐确认门**：进相位 02，逐行呈现 stdout 的对齐五要素（主体/视角/读者/核心问题/基调）；
   「修改」= 用户编辑 report-brief.json 后重跑相位 01 再呈现；「同意」才放行后续 report-draft / report-*。

## 边界

- 对齐字段口径（subject 枚举、默认稿推导规则）以 `eval/bench/src/report/brief.js` 为唯一事实源，本任务不复述。
- 不在本任务内渲染任何平台物料；不改 metrics 与既有产物。
