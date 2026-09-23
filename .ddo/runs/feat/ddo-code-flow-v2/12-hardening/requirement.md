# 工作项 12 · hardening — 完整度审计收口：自包含修复 + standard 预设 + 工程卫生

> 状态：**已实现（D1–D4，2026-09-24；全量 78 用例全绿，plan v1.1）**

关联：
- 完整度审计（2026-09-24，会话内完成）：核心闭环可用（dogfooding 验证），无阻塞缺陷；本工作项收口用户圈定的四项
- [../02-index-structure/plan.md](../02-index-structure/plan.md) v1.5 —— `dirs` 字段本轮扩展 `tasksDir`
- [../10-bootstrap/requirement.md](../10-bootstrap/requirement.md) —— 自定义链场景（A1 的触发面）

## 需求输入（2026-09-24，用户，审计反馈四条）

1. **A1 修一下**：自定义链不自包含——`run start --tasks-dir <自定义目录>` 启动后 state 不记录 tasksDir，
   后续 `next`/`exec`/`validate`/`rollback` 缺省读 skillRoot 的 atom-tasks（自定义任务不存在 →
   `phaseType()` ENOENT 裸崩）；`resume`/`status` 生成的 availableCommands 也不带 `--tasks-dir`。
2. **A2 提供标准版预设流水线**：预设库只有 basic（5 阶段），00-overview 权威链（10 阶段）无预设可触达。
3. **A3 先保持数据存储即可**：`list history` 查询面不做（jsonl + `~/.ddo/history/<runId>/` 归档已就位，
   数据不丢；查询面挂账，真实需要再立项）。
4. **小问题评估变更范围，不大就一起修**：C 档卫生项（package.json / CI / 死枚举 / 04 O4 过时行）。

## 审计结论（背景，2026-09-24）

- 真缺陷（文档化流程会咬人）：**0 个**——A1 属未文档化场景（project-local 任务目录）的边界，
  用户圈定修复（防御性收口，成本一行字段 + 缺省链）。
- 降级记录：A2 是内容缺口非缺陷；A3 是功能挂账非数据缺口；全链 E2E 自动化范围大，**本轮不做**。

## 已确认决策（2026-09-24，用户指令）

| # | 决策 | 依据 |
|---|---|---|
| D1 | A1 修法 = `state.dirs.tasksDir`（可选绝对路径）；命令取值优先级 **flag > state > skillRoot 缺省**；历史 state 无此字段容错回落 | 用户指令 1 |
| D2 | standard 预设 = 00-overview 权威链 10 阶段线性（requirement → spec → plan → test-plan → tasking → coding → verification → review → reporting → reflection），与 2026-09-22 用户对齐的流程图一致，不新造结构 | 用户指令 2 |
| D3 | A3 只保持数据存储（现状已满足，零改动）；`list history` 挂账 | 用户指令 3 |
| D4 | 卫生包范围 = package.json（engines/test 脚本）+ PR/issue 模版（bug/feature）+ 死枚举收敛（skipped/rework/waiting-remote-gate 移除，无写入方无消费方）+ 04 O4 关闭（11 轮已定 runDir）；CI 不做（快速迭代期，提交前本地跑绿）；全链 E2E 不做 | 用户指令 4 + 修订（CI 移除 / 模版新增，2026-09-24） |

## 变更记录

| 版本 | 日期 | 说明 |
|---|---|---|
| v0.1 | 2026-09-24 | 立项：审计反馈四条录入，D1–D4 随用户指令定版 |
| v1.0 | 2026-09-24 | 实现完成：D1 tasksDir 三级取值（六消费方）；D2 standard 预设（10 阶段）；D3 零改动确认；D4 卫生包（package.json + CI + 枚举收敛 + 04 O4 关闭）。细节见 [plan.md](./plan.md) v1.1 |
