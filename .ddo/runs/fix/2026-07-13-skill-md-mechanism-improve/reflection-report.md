# Ddo-Code-Flow SKILL.md 机制完善 复盘报告

> 本次 run 的未完结项、推荐后续动作与经验教训。

---

## 1. 未完结项

无。本次修改不涉及业务代码，SKILL.md 中无 TODO/FIXME/XXX 标记。

---

## 2. 推荐后续动作

| # | 任务 | 优先级 | 说明 |
|---|---|---|---|
| 1 | 同步更新 config.schema.json | 中 | 当前 config.schema.json 的 `base` 仍要求 `confirmationGates` 字段，但 v3 已将其下沉到 workflow 级别。应更新 schema 以匹配 v3 结构。 |
| 2 | 更新 SKILL.md 中的 .state.json 示例 | 低 | SKILL.md 的 "Outputs to maintain" section 中的 .state.json 示例可能需要更新以反映新字段。 |
| 3 | 为 historyMeta 添加 schema 校验 | 低 | 考虑在 config.schema.json 或单独的 schema 中定义 historyMeta 的结构约束。 |
| 4 | 测试跨阶段回滚的实际执行 | 中 | 当前回滚机制是文档级定义，需要在实际 run 中验证 agent 是否正确执行回滚判断和状态变更。 |
| 5 | 更新 README.md | 低 | README.md 中的配置示例仍使用 v2 格式（含 `confirmationGates` 和 `pipeline`），应更新为 v3。 |

---

## 3. 经验教训

| # | 教训 | 应用 |
|---|---|---|
| 1 | 用户反馈可能涉及上游文档变更，需要跨阶段回滚机制 | 在设计确认门时，应考虑反馈的影响范围判断 |
| 2 | .state.json 作为自包含恢复文件，需要包含足够的路径信息 | 新增 configPath/workflowPath 字段，使 .state.json 可独立恢复 |
| 3 | history 作为工作流记忆，需要结构化的编写规则 | 新增 historyMeta 字段，将规则持久化到 .state.json 中 |
| 4 | 文档版本归档（_del 目录）为 review 提供对比依据 | 在确认门否决时自动归档，便于追溯变更历史 |

---

## 4. 用户确认

请确认以下任一选项：

- ✅ **同意**：本次 run 完成，进入 **Done** 阶段。
- ❌ **修改**：请列出需要调整的内容。
