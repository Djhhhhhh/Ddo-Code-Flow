# task-03 SVG/HTML 生成与 CLI 收口

## 目标

实现渲染输出：将布局结果拼接为内联 SVG 并生成静态 `ddo-visual.html`；stdout 打印摘要（run 数、输出路径、交叉计数）。对应 spec FR-2/FR-3、AC-1/AC-2。

## 涉及文件

- `visualize.js`（新增，渲染与输出部分）
- `ddo-visual.html`（运行产物）

## 执行步骤

1. SVG 拼接：节点矩形 + 标签文本（转义）、边 path（主链直线 / 通道折线）；当前阶段节点高亮样式；门节点独立形状与决议标注；
2. HTML 模板：内联 CSS + `<svg>`，含生成时间与数据来源说明；空态时输出「no running runs」空态页；
3. stdout 摘要：`runs: <n>`、`output: <path>`、`crossings: <n>`；
4. 幂等：重复运行覆盖旧 HTML。

## 完成标准

- 生成的 HTML 含 `<svg>`、runId 文本、当前位置标识（G2 验收项可过）；
- stdout 摘要格式固定（G1/G3 验收项可 grep）。
