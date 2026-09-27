# task-02 CLI 命令面与决议前置校验

## 目标

注册 gate present / gate interact / guide 三命令；next 与 rollback 接入呈现前置校验；status/resume 的 gateOptions 换同源派生。

## 涉及文件

- tools/cli.js

## 执行步骤

1. REGISTRY 注册：
   - `gate present --state <p> [--tasks-dir]`：openGates → 物化隐式门写回 state → 盖 presentedAt（同一时刻戳）→ 输出 presentPayload；无开门 exit 1 + stderr 指引。
   - `gate interact --state <p> --option <name> [--note <t>] [--stage <id>] [--tasks-dir]`：开门集中定位（多门须 --stage）；校验 option ∈ 有效 in-phase 选项集（静态∪动态，命令型明确报错指引走声明命令）；追加 interactions[]；输出 {recorded}。
   - `guide [--workflows-dir] [--tasks-dir]`：输出冷启动三问 payload（问目标 freeText、问模式内嵌 listWorkflows 预设+自定义、问类型常用枚举+自定义说明）；无状态无副作用。
2. runNext 改造（保持既有语义，仅插入校验）：
   - 无 --decision 拦截路：stderr 指引改为「先 gate present 呈现后决议」，gates 数据换 openGates 同源（含动态）。
   - 有 --decision：既有校验（未知决议/in-phase 拒绝/非推进拒绝）之后、推进之前，对全部开门校验 isPresentationValid；无效 → exit 1 + stderr「门选项在最近交互后未重新呈现（或从未呈现）——先跑 gate present」+ renderGateOptions 清单；stdout {blocked:'gate-unpresented', gates}。
3. runRollback 改造：目标 stage 自身存在开门（gate && !decision 且该位置 ∈ currentStage human 相位）时校验 isPresentationValid，无效 → exit 1 + 同上指引；其余回滚路径不校验。
4. statusView（status 与 resume --run-id 共用）gateOptions 换 openGates 派生（输出字段名不变，值含动态选项）。

## 完成标准

- gate present/guide 可执行且输出契约形态正确（详细断言由 task-05 测试覆盖）。
- next/rollback 未呈现决议被拦、补呈现后成功。
