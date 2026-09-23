# task-02 · visualize.js——主程序（解析 + 渲染 + 写盘）

> 目标：串联数据源到产物：读 index.json → 逐 run 解析 state → 调 layout → 生成单文件 HTML。

## 涉及文件
- `visualize.js`（新增）；依赖 `layout.js`（task-01）

## 执行步骤
1. `--home`（缺省 DDO_HOME 或 ~/.ddo）读 index.json；不存在 → stderr 人话提示 exit 1；
2. statePath 失效条目 → 记入 stale 跳过；有效则解析 runId/title/stages/gate/currentStage（未知字段忽略）；
3. 每 run 调 `layout()` 得坐标与折线 → 字符串模板渲染 SVG（rect 节点 + 状态配色 + 当前位置/开门标记 + path 连线）；
4. 组装单文件 HTML（内联 CSS，无 JS 依赖）；页面顶部标注 crossings>0 的原因（若出现）；
5. `--out` 写盘（缺省 ./ddo-visual.html）；stdout 输出 JSON 摘要 `{runs, stale, output, crossings}`；四通道契约（stdout JSON / stderr 人话 / exit 0·1）。

## 完成标准
- test-plan G1 两条 cmd 项通过；本 run 自身出现在产物中。
