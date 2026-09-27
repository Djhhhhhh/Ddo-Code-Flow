# task-04 协议文档同步（SKILL.md + 四个门任务 prompt）

## 目标

把呈现义务从散文改为机械规则：跑 gate present → 转述 payload → 按 dispatch 处理 → in-phase 先 gate interact 再行为处理 → 完成后重新 gate present。

## 涉及文件

- SKILL.md
- atom-tasks/spec/prompt.md、atom-tasks/plan/prompt.md、atom-tasks/test-plan/prompt.md、atom-tasks/reflection/prompt.md

## 执行步骤

1. SKILL.md：
   - 核心契约 4 补「呈现协议状态化：呈现/交互留痕 + 决议前置校验（结构拦截）」；
   - 冷启动改为「跑 guide，按 payload 逐问转述」；
   - 驱动 run ③ 与确认门协议段改写：开门后先 gate present；用户选择按 dispatch；in-phase 经 gate interact 记录后处理，处理完重新 gate present（结构会拦未重新呈现的决议）；
   - 中断恢复协议补 resume 后同样先 gate present 再等选择；
   - 诚实边界段更新：漏问/漏 re-ask 已结构化，防伪造决议仍留后续。
2. 四个 prompt 的确认门相位：「读 state 的 stages.X.gate.options…」段替换为「跑 gate present 取 payload 原样转述；选项集以 payload 为准（含动态回答BQ-N）；in-phase 选择先 gate interact --option <name> 记录再按行为定义处理，处理完成后重新 gate present 送审」。保留各自行为定义（修改/提问/归档语义不变），BQ 动态生成散文段删除（改由 payload 提供）。

## 完成标准

- 四 prompt + SKILL 的呈现义务无「自行拼呈现」残留（G5 人工抽查项的可执行基础）。
