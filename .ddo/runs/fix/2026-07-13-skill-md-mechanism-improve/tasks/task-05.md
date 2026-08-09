# Task 05: 全文检查与最终验证

> 关联验收点：G1-G8 全部

## 目标

对 SKILL.md 进行全文检查，确保所有改动一致、无遗漏。

## 修改文件

- `SKILL.md`（检查，必要时微调）

## 检查清单

### 结构检查
- [ ] 步骤编号连续唯一（Step 1 ~ Step 5），无重复无跳号
- [ ] 路径解析规则表只出现一次（在 Step 3 开头）
- [ ] 无残留的旧 Step 2.7/2.8 内容

### 字段检查
- [ ] .state.json 初始化模板包含 workflowId、configPath、workflowPath、historyMeta
- [ ] historyMeta 包含 version、eventTypes、feedbackFormat、feedbackScope、rules
- [ ] eventTypes 列表包含 15 种事件（含 rollback-analyzed、rollback-triggered）

### 逻辑检查
- [ ] Step 1 不再遍历 workflows.items[] 做全量校验
- [ ] Step 2 包含 workflow JSON 加载 + schema 校验 + DAG 检查
- [ ] Step 2 不再有 Resume override 和 Record workflowId
- [ ] 恢复逻辑集中在 Step 3 一个连续段落中
- [ ] 直接恢复流程描述完整
- [ ] _del 目录机制描述完整
- [ ] 跨阶段回滚机制描述完整

### 示例检查
- [ ] history 示例中 feedback 格式为"第x轮反馈：（反馈具体内容）"
- [ ] 回滚 history 示例包含 rollback-analyzed 和 rollback-triggered 事件

## 验证

- [ ] 所有 test-plan.md 中的 cmd 检查项均可通过
- [ ] 所有 human 检查项均可通过目视检查
