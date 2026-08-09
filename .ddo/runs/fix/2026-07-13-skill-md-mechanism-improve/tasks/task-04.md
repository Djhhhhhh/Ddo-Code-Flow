# Task 04: 文档版本归档与跨阶段回滚

> 关联验收点：G7（文档版本归档）、G8（跨阶段回滚机制）

## 目标

在 SKILL.md 中新增文档版本归档机制（_del 目录）和跨阶段回滚机制。

## 修改文件

- `SKILL.md`（主修改文件）

## 具体改动

### 1. 新增文档版本归档 section

在 SKILL.md 中新增 section 描述 _del 目录机制：

- git-worktree 创建工作目录时同步创建 `_del` 目录
- 归档时机：确认门否决后重新生成时、跨阶段回滚时
- 归档文件命名：`<原文件名>.<ISO 8601>.md`
- _del 目录中的文件仅用于 review 阶段对比

### 2. 新增跨阶段回滚 section

在 SKILL.md 中新增 section 描述回滚机制：

**回滚判断流程**：
```
用户否决 plan（带反馈）
    → Agent 分析反馈
    → 仅涉及技术决策 → 在 plan 阶段重新生成
    → 涉及 spec 层面 → 回滚到 spec → 更新 spec → 用户确认 → 重新生成 plan → 用户确认
    → 不明确 → 询问用户
```

**回滚判断标准**：
- 需要回滚到 spec：增删 FR、修改 AC、调整范围、用户说"spec 不对"
- 不需要回滚：更换技术方案、调整实施次序、用户说"换个实现方式"

**回滚后 .state.json 状态变更**：
- currentStage 回退到目标阶段
- 目标阶段及下游 stages.status 清除
- 记录 rollback-triggered 事件

**history 示例**：包含 rollback-analyzed 和 rollback-triggered 事件的完整示例。

### 3. 在 SKILL.md 中添加 "Persist state" 部分的补充说明

在 Step 3 的 "Persist state" 部分补充：
- 回滚时的 .state.json 更新规则
- 归档时先 copy 到 _del 再覆盖

## 验证

- [ ] SKILL.md 中包含 "_del" 目录相关描述
- [ ] SKILL.md 中包含归档命名格式 `<原文件名>.<ISO 8601>.md`
- [ ] SKILL.md 中包含跨阶段回滚判断标准
- [ ] SKILL.md 中包含 rollback-triggered 事件的 history 示例
