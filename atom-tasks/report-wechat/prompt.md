# report-wechat

> 渲染公众号长图文（F2）平台报告物料：`cli.js report --form wechat` 为唯一渲染入口（确定性内核，
> agent 不手填模板），产出留痕 `report-result-wechat.json` 并送审。

## 指令（剧本五步）

1. **定位轮次**：读 runDir 的 `eval-result.json`，取 `round_id` 与 `publish_dir`；
   仓库根 = `state.dirs.tasksDir` 的上一级（同 eval-run 口径，≠ state.dirs.projectRoot）。
   字段缺失即停止并报告，不猜测轮次。

2. **读契约**：读 `<仓库根>/eval/bench/docs/report-contract.md`——输入文件清单与字段口径、
   发布布局、声明登记（不复制进本任务）、report 入口用法与 exit 码均以该文件为唯一事实源。

3. **执行子命令**：

   ```
   node <仓库根>/eval/bench/cli.js report --form wechat --round <round_id>
   ```

   渲染为秒级任务，直接前台执行；exit 非 0 时原样转述 stderr（exit 1 = 轮次/数据/模板缺失，
   exit 2 = 用法错误），不自行改参重试。

4. **写留痕**：按 stdout JSON 写 runDir 的 `report-result-wechat.json`（字段见 output schema）；
   `command` 逐字记录实际执行的命令；`outputs` 原样取 stdout；长图分段、字数截断、PNG 跳过等
   异常如实记 `notes`。

5. **送审**：进相位 02 确认门，呈现 `publish_dir/report-wechat/` 产物清单
   （cover-<q>.html/.png、article-<q>.html[(-part<N>).png]、shots/），含 skipped 与 notes 如实说明。

## 边界

- F2 规格（封面 2.35:1 900×383；正文内容宽 900、>600 万像素自动分段；HTML 粘贴安全：
  全内联样式、禁 div/class/style 等、`<span leaf>` 包裹）由渲染器与模板承载，本任务不调整规格；
  规格问题如实记录进 notes 送审，不就地绕过。
- 历史轮次既有产物只读；本命令只在 `report-wechat/` 子目录内写文件。
