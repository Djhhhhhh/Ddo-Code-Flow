# task-14 — UI Pipeline Tab：SVG 节点图 + 拖拽 + 连线 + 合并审批

## 目标
本次工作量最大的模块：以原生 SVG + DOM 实现 `pipeline.png` 风格的可视化 DAG 编辑器，覆盖 spec §3.4 + plan §9.3.2 的全部交互。

## 范围
- `index.html` 中 Pipeline Tab 容器
- `app.js` 中 Pipeline Tab 的渲染、拖拽、连线、删除、合并审批、SVG 边路径计算
- `styles.css` 中 `.stage-lane` / `.atom-node` / `.dag-edge` / `.dag-arrow` 样式

## 依赖
- task-11（骨架与样式 token）
- task-12（state + DAG 校验器）

## 关联验收点
- G7.3 全组（渲染、stage 拖拽、节点拖入、连线、删除、合并审批、环路高亮）
- G6.4：DAG 无环静态校验视觉化（Save 按钮变灰 + 红线高亮）
- G8：视觉与 DESIGN.md token 一致；卡片 12px 圆角 + hairline 边框 + 无阴影；确认门用反色高亮**且每张视图最多 1 个**

## 步骤
1. **布局**：每个 stage 渲染为一个 `.stage-lane`（dotted hairline-strong 边框 + rounded-lg）；stage 左上角显示 stage 名（heading-md）与 description（body-sm in `--color-body`）。
2. **节点**：stage 内部以 flex/grid 排布 `.atom-node` 卡片：标题（heading-sm）+ description（body-sm in body 色）+ 右上角 `×` 删除按钮 + 底边一个"连线锚点"圆点。
3. **SVG 层**：在 Tab 容器内放一个全宽的 `<svg>`，使用绝对定位覆盖在节点之上；节点的 DOM 矩形通过 `getBoundingClientRect()` 计算位置；SVG `<path>` 用贝塞尔或直线 + 末端 `<marker>` 三角箭头表达 `nodes[name].next` 边。
4. **拖拽 stage**：原生 `dragstart/dragover/drop`；释放后重排 `state.config.pipeline` 并触发重渲染。
5. **拖入新节点**：右侧抽屉显示当前未在该 stage 的可用 atom-task 列表（从 state.scannedAtoms 中筛选）；拖入后写入该 stage 的 `nodes[name] = { next: [], parallelApprove: false }` 并 push 到 `entry` 末尾。
6. **连线**：点击源节点的"连线锚点" → 节点高亮 → 再点目标节点的连线锚点 → 在 `nodes[source].next` 中加入 `target`；按 Esc 取消。
7. **删除节点**：点击 `×` 后：
   - 删除 `nodes[name]`；
   - 删除 `entry` 中的引用；
   - 遍历 `nodes[*].next` 移除指向被删节点的引用。
8. **合并审批**：在 Tab 顶栏放一个 "Toggle parallelApprove for selected" 按钮；按住 Shift 多选节点，点击该按钮把 `parallelApprove` 同步置 true/false；视觉上把这些节点框成同一虚线"审批批次"框。
9. **环路高亮**：每次编辑后调用 `dag.js` 检查；若有环：把环路上所有边路径 `stroke` 改为 `#ff0000`（仅错误态用到红色），并把全局 Save 按钮置为 `btn-disabled`。
10. **stage 描述编辑**：双击 stage 标题进入 inline edit 模式（contenteditable），失焦时落入 `state.config.pipeline[].description`。

## 产物
- Pipeline Tab 完整可用版本
