# Ddo-Code-Flow SKILL.md 机制完善 测试计划

> 基于已确认的 spec.md 生成的验收测试 checklist。每条验收项标记为 cmd（自动化）或 human（手动）。

## G1. 步骤编号与结构修复

- [ ] cmd: grep -c "^### Step [0-9]" SKILL.md | test $(cat) -eq 5
- [ ] cmd: grep "^### Step" SKILL.md | sort | uniq -d | test $(wc -l) -eq 0
- [ ] human: 检查 SKILL.md 全文，确认 Step 1~5 编号连续，无重复，无跳号
- [ ] cmd: grep -c "路径解析规则" SKILL.md | test $(cat) -le 1
- [ ] human: 确认路径解析规则表只在 Step 3 中出现一次

通过标准：SKILL.md 步骤编号连续唯一（Step 1~5），路径解析表只出现一次。

## G2. .state.json 初始化模板增强

- [ ] cmd: grep -q '"workflowId"' SKILL.md
- [ ] cmd: grep -q '"configPath"' SKILL.md
- [ ] cmd: grep -q '"workflowPath"' SKILL.md
- [ ] cmd: grep -q '"historyMeta"' SKILL.md
- [ ] human: 检查 SKILL.md 中 .state.json 初始化模板，确认包含 workflowId、configPath、workflowPath、historyMeta 四个字段

通过标准：.state.json 初始化模板包含所有新增字段。

## G3. Step 1 验证范围收窄

- [ ] cmd: grep -A 20 "Step 1" SKILL.md | grep -q "workflows.items" && echo "still validates all workflows" || true
- [ ] human: 检查 Step 1，确认不再遍历 workflows.items[] 做全量 workflow 校验
- [ ] human: 检查 Step 1，确认仅保留 config.json schema 校验和引用完整性检查
- [ ] human: 检查 Step 2，确认包含目标 workflow JSON 加载、schema 校验、DAG 无环检查

通过标准：Step 1 只做引用检查，Step 2 在解析出目标后才加载和校验 workflow JSON。

## G4. 恢复逻辑整合

- [ ] human: 检查 Step 3，确认 .state.json 搜索、workflowId 覆盖、恢复逻辑集中在一个连续段落中
- [ ] human: 确认 Step 2 中不再有 Resume override（原 Step 2.7）和 Record workflowId（原 Step 2.8）
- [ ] human: 确认恢复逻辑包含：搜索 .state.json → 读取 → workflowId 覆盖 → 校验一致性 → resume

通过标准：恢复逻辑从 Step 2+3 两处整合到 Step 3 一处，无遗漏。

## G5. history 事件日志规范

- [ ] cmd: grep -c "gate-pending\|gate-approved\|gate-rejected\|rollback-triggered\|rollback-analyzed" SKILL.md | test $(cat) -ge 5
- [ ] human: 检查 SKILL.md 中定义了 history 事件类型集合（至少 15 种事件）
- [ ] human: 确认 history 条目结构包含 note、feedback、target 三个可选字段的定义
- [ ] human: 确认 feedback 字段格式定义为"第x轮反馈：（反馈具体内容）"
- [ ] human: 确认有确认门完整事件链的示例（gate-pending → gate-rejected → 重新生成 → gate-approved）
- [ ] cmd: grep -q "historyMeta" SKILL.md
- [ ] human: 确认 historyMeta 包含 version、eventTypes、feedbackFormat、feedbackScope、rules 字段

通过标准：SKILL.md 中定义了完整的 history 事件日志规范，含事件类型、条目结构、historyMeta。

## G6. 通过 .state.json 直接恢复工作流

- [ ] human: 检查 SKILL.md 中描述了通过 .state.json 直接恢复工作流的流程
- [ ] human: 确认恢复流程包含：读 .state.json → 读 configPath → 读 workflowPath → 校验一致性 → 继续执行
- [ ] human: 确认直接恢复时不需要重新执行 Step 1 和 Step 2

通过标准：SKILL.md 支持通过 .state.json 路径直接恢复工作流。

## G7. 文档版本归档（_del 目录）

- [ ] human: 检查 SKILL.md 中 git-worktree 原子任务指令包含创建 _del 目录的步骤
- [ ] human: 确认 _del 目录位于 .state.json 同级目录下
- [ ] human: 确认归档文件命名格式为 `<原文件名>.<ISO 8601>.md`
- [ ] human: 确认归档时机定义：确认门否决后重新生成时归档，跨阶段回滚时归档

通过标准：SKILL.md 定义了 _del 目录创建和文档归档机制。

## G8. 跨阶段回滚机制

- [ ] human: 检查 SKILL.md 中定义了确认门跨阶段回滚的判断标准
- [ ] human: 确认回滚判断标准包含：增删 FR、修改 AC、调整范围 → 回滚到 spec
- [ ] human: 确认回滚后 .state.json 状态变更：currentStage 回退、下游 stages 清除
- [ ] human: 确认有回滚场景的 history 示例（含 rollback-analyzed 和 rollback-triggered 事件）
- [ ] human: 确认回滚后重新经过的阶段必须重新走确认门

通过标准：SKILL.md 定义了完整的跨阶段回滚机制。

## 最终验证

- [ ] cmd: tail -n 1 verification.log | grep -q "ALL PASSED"
