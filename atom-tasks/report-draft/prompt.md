# report-draft

> 审阅底稿（#100 跟进）：平台物料渲染前先生成**可实际审阅的真实报告** md——完整数据对比
> （逐项探针/分类小计/过程信号/Token 全量）、样式对照、打分标准，附录A 平台文案（与渲染器同源逐字）、
> 附录B 各平台呈现说明。`cli.js report --form draft` 为唯一入口。

## 指令（剧本五步）

1. **定位轮次**：读 runDir 的 `eval-result.json`，取 `round_id` 与 `publish_dir`；
   仓库根 = `state.dirs.tasksDir` 的上一级（同 eval-run 口径）。

2. **前置对齐**：确认 `runs/<round_id>/report-brief.json` 已存在且经 report-align 确认；
   缺失即停止并提示先走 report-align，不跳过对齐直接渲染。

3. **执行子命令**：

   ```
   node <仓库根>/eval/bench/cli.js report --form draft --round <round_id>
   ```

   秒级任务，直接前台执行；exit 非 0 时原样转述 stderr。

4. **写留痕**：按 stdout JSON 写 runDir 的 `report-result-draft.json`（字段见 output schema）；
   `command` 逐字记录；`outputs` 原样取 stdout。

5. **审阅门**：进相位 02，呈现 `publish_dir/report-draft/draft-<round_id>.md` 的章节骨架
   （对齐摘要 → 概览 → 每题逐项/分类/过程/Token → 样式对照 → 打分标准 → 附录A/B）；
   「修改」= 用户改对齐稿或指出口径问题后重跑；「同意」放行 report-*。

## 边界

- 底稿结构与字段口径以 `eval/bench/src/report/draft.js` 为唯一事实源，本任务不复述表格列；
- 附录A 文案 = forms.js 文案单源（wechatCopyFor/noteBodyFor）的逐字投影，审阅发现的文案问题改单源，不改底稿；
- 本任务不渲染 PNG/GIF（纯 md）；平台形式在 report-* 中渲染。
