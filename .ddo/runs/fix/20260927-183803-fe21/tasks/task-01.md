# task-01 交互留痕数据层与门派生 lib

## 目标

建立结构闭环的数据与派生基础：门实例留痕字段（presentedAt / interactions[]）的结构校验，以及同源门派生 lib（openGates 物化/组装、payload/dispatch 构建、呈现有效性判定、选项渲染）。

## 涉及文件

- tools/lib/gate.js（新增）
- tools/lib/state.js（assertGate 扩展）

## 执行步骤

1. state.js#assertGate 增补可选字段校验：presentedAt（ISO 字符串）、interactions[]（逐元素 option 非空字符串 / at ISO 字符串 / note 可选字符串）。
2. 新建 tools/lib/gate.js：
   - `openGates(state, tasksDir)`：遍历 currentStage 的 human 相位取开门位置；无 gate 对象时按相位声明 buildGate 物化选项（不写回 state——写回由 present 命令做）；装载 `<task>.js` 的 `present({phase, state, statePath, config})` 钩子（MODULE_NOT_FOUND 容错同 assemble.js；钩子内部错误硬失败），动态选项逐项校验 INV-2（action 恒 in-phase、name 过 DECISION_RE、不与静态重名）后并入。
   - `presentPayload(state, statePath, tasksDir)`：组装 `{gates:[{stage,phase,options:[{name,desc,action,dispatch}]}], hint}`；dispatch：命令型经 fillState 补全 --state，in-phase 给「gate interact --state <p> --option <name>，处理后重新 gate present」。
   - `isPresentationValid(gate)`：presentedAt 缺失→invalid(never)；<=openedAt→invalid(stale-open)；任一 interactions[i].at >= presentedAt→invalid(interacted)；否则 valid。ISO 字符串字典序比较。
   - `renderGateOptions(gates)`：自 cli.js#renderOptions 迁移（含动态选项同形渲染）。
3. cli.js 中原 renderOptions 改为从 lib/gate.js 引入（本任务只迁移不改语义，行为不变）。

## 完成标准

- node --test tools/tests/ 全绿（纯迁移无行为变化）。
- assertGate 对非法 interactions/presentedAt 抛错（可经后继任务测试覆盖）。
