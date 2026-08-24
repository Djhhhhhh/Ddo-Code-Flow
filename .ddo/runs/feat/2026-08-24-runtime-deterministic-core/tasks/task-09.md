# task-09: gate + advance-stage

- 关联验收点：G8（AC-8）
- 依赖：task-06
- 状态：pending

## 目标

实现确认门与阶段推进，把「终态硬检查」用退出码表达。

## 涉及文件

- `scripts/runtime/lib/gate.js`（新增）
- `scripts/runtime/lib/advance.js`（新增）

## 实现要点

- `gate`：approved 放行；rejected 归档旧版到 `_del` + 追加 `gate-rejected` + 标 rework-pending；pending(77) 留待轮询。
- `advance-stage`：终态硬检查——阶段全 done/合法跳过、门全批准、无 running/failed、无 pending；全满足才写 `currentStage`/`stages`，否则 exit 1 不推进。

## 验收

- [ ] cmd: node scripts/runtime/ddo.js advance-stage --state <未满足终态的 state.json> 返回 exit 1 且不推进 currentStage
- [ ] cmd: node --test scripts/runtime/test/advance-stage.test.js（去 skip 后全绿）
