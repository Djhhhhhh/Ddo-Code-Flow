# task-01 数据读取与图模型构建

## 目标

实现 `visualize.js` 的数据层：读取 `~/.ddo/index.json` 发现运行中 run，逐 run 解析 `.state.json`，构建渲染用内存模型（RunEntry / StageView / Graph）。对应 Plan DEC-1/DEC-2、spec FR-1/FR-2。

## 涉及文件

- `visualize.js`（新增，数据读取部分）

## 执行步骤

1. 解析 CLI 参数：`--out <path>`（缺省 `ddo-visual.html`）、`--home <ddoHome>`（缺省 `~/.ddo`）；
2. 读 `<home>/index.json`：`{ <runKey>: { statePath, ... } }` 映射；文件缺失 → 空运行列表（空态）；
3. 逐 statePath 读 `.state.json`，容错提取：`runId / title / currentStage / stages / startedAt / dirs`；文件缺失或 JSON 损坏 → 该 run 记 `error`，不阻断；
4. 构建图模型：阶段主链节点序列 + 每阶段相位/门子节点；门节点仅 `gate.opened` 时生成。

## 完成标准

- 空索引与损坏 state 均不崩溃，按容错语义记录；
- 对本沙箱当前运行中 run 能读出 runId、阶段链与 currentStage。
