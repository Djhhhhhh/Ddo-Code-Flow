# task-05: validate-dag + select-workflow

- 关联验收点：G5（AC-5）
- 依赖：task-03, task-04
- 状态：pending

## 目标

实现工作流选择与 DAG 角色可达性校验，把「缺 required consume / 环 / 重复同 run 生产者」拦在退出码里。

## 涉及文件

- `scripts/runtime/lib/workflow.js`（新增）

## 实现要点

- `select-workflow`：`--model` 显式 > `selection.rules` 匹配（model 值 → 需求文本）> fallback；返回 `{workflowId, runType, workflowPath}`。
- `validate-dag`：按 stage 顺序 + 节点拓扑序遍历，维护 `produced` 集合；每个 role 必须存在于 `artifacts.json`；`required:true` consume 必须已在 `produced`，例外 `stage-artifact` 与显式读 state fallback 的 role；环 → exit 1。

## 验收

- [ ] cmd: node scripts/runtime/ddo.js validate-dag --workflow workflows/guarded.json 返回 exit 0
- [ ] cmd: node --test scripts/runtime/test/validate-dag.test.js（去 skip 后全绿）
