# task-07: next-node

- 关联验收点：G7（AC-7）
- 依赖：task-03, task-05
- 状态：pending

## 目标

实现 Kahn 拓扑选批、角色注入与 options 合并，输出自包含指令。

## 涉及文件

- `scripts/runtime/lib/nodes.js`（新增）

## 实现要点

- 入度 0 节点为一批；`parallelApprove`/`parallelWith`/`parallelGroups` 决定同层并行。
- 解析 `consumes` 从 `.state.json.artifacts` 取 path，替换 `{{inputs.<role>}}`。
- 合并 options：workflow override > config override > node options > atom-task 默认。
- 输出自包含指令到 stdout（JSON 或预计算 prompt 文本）。

## 验收

- [ ] cmd: node scripts/runtime/ddo.js next-node --state <state.json> 输出中 `{{inputs.*}}` 已替换、options 已合并
- [ ] cmd: node --test scripts/runtime/test/next-node.test.js（去 skip 后全绿）
