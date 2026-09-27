# 交互协议结构闭环 测试计划

> 基于已确认的 spec.md 生成的验收测试 checklist（tdd=false，不生成测试桩；测试于 coding 阶段随实现产出）。

## G1. 统一呈现 payload（静态+动态+同源）

### Checklist

- [ ] cmd: node --test tools/tests/present.test.js

### 通过标准

gate present 输出含静态选项与 dispatch 指引；spec 门动态选项（回答BQ-N）由钩子现算进 payload；next 拦截输出与 payload 同源（AC-1）。

## G2. 呈现留痕与决议前置校验

### Checklist

- [ ] cmd: node --test tools/tests/present.test.js
- [ ] cmd: node --test tools/tests/gate.test.js

### 通过标准

未呈现决议被拦（exit 1 + 指引）；补呈现后成功且 state 留 presentedAt 与 decision/closedAt；present→interact→决议被拦→重新呈现后成功（re-ask 闭环）；未呈现 rollback（门决议载体）被拦、非门回滚不受影响（AC-2/AC-3/AC-4）。

## G3. 冷启动与 resume 形态统一

### Checklist

- [ ] cmd: node --test tools/tests/present.test.js
- [ ] cmd: node --test tools/tests/resume.test.js

### 通过标准

guide 输出冷启动三问 payload（问模式选项内嵌预设+自定义）；resume --run-id 的 gateOptions 与 present payload 选项一致（含动态）（AC-6/AC-7）。

## G4. 全量回归

### Checklist

- [ ] cmd: node --test tools/tests/

### 通过标准

既有测试（含决议前补 present 的更新）全部通过，无契约变更外的意外红。

## G5. 协议机械性人工抽查

### Checklist

- [ ] human: 阅读 SKILL.md 与 atom-tasks/{spec,plan,test-plan,reflection}/prompt.md 的确认门相位，确认呈现义务全部为「跑 gate present → 转述 payload → gate interact 记录」，无「读 state 自行拼呈现」散文残留
- [ ] human: 下一次 dogfooding run 开门时观察：agent 呈现的选项与 gate present payload 一致，in-phase 交互后结构强制重新呈现

### 通过标准

两处人工检查均确认协议可机械执行（AC-5）。
