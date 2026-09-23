# task-01 · layout.js——分层布局纯函数

> 目标：实现 plan.md「算法设计」的完整布局算法（唯一非平凡逻辑），零依赖纯函数。

## 涉及文件
- `layout.js`（新增）

## 执行步骤
1. 导出 `layout(stages)`：输入 `{id, dependOn[]}[]`，输出 `{positions: Map, edges: [{from,to,polyline}], crossings, layers}`；
2. 最长路径分层（源点第 1 层）→ barycenter 层内排序（下行/上行各 2 轮）→ 层内均分 x、层间固定 y；
3. 边路由：相邻层走廊直线（同走廊按 source 序横向错开）；跨层边正交折线；
4. 线段相交自检（O(E²) 逐对，折线分段判断），`crossings` 计入返回值；
5. 断言不变量：positions 覆盖全部节点、edges 与 dependOn 一一对应；单节点居中；空输入抛错。

## 完成标准
- `node -e` 冒烟：构造 spec→plan→coding 线性链 + 一个双分支 DAG，均 crossings=0；
- 环输入抛错信息可读。
