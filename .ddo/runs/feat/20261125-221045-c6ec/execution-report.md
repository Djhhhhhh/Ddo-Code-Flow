# 执行报告 — run 20261125-221045-c6ec

> 汇总各阶段产物与验证结果的完整执行报告。

## 运行元数据

- runId: 20261125-221045-c6ec
- title: list/guide/run start 缺省合并解析 ~/.ddo 用户本地注册的自定义流程（sources.js，加性、冲突 fail-fast、不遮蔽内置）
- startedAt: 2026-11-25T22:10:45.929+08:00
- workflow: basic（requirement → spec → plan → coding → reporting）
- currentStage: reporting:01（收尾中）
- 执行位置：worktree `/Users/djhhh/work_area/Ddo-Code-Flow-feat-ddo-local-sources`（分支 `feat/ddo-local-sources`，基线 main@27e89cb）

## 用户需求（原文）

用户以功能提议（issue 模板，labels: enhancement）触发本次 run，原文全文见 `requirement.md` 的「原始需求」节（照录未改写）。核心诉求：`list workflows`、`guide`、`run start` 的预设解析缺省合并检查 `~/.ddo/workflows/` 与 `~/.ddo/atom-tasks/`；合并语义为加性、同名冲突 fail-fast、不遮蔽内置预设；未部署 `~/.ddo` 的机器行为与现状完全一致。

## 各阶段产物

| 阶段 | 状态 | 产物 |
|---|---|---|
| requirement | ✅ done | requirement.md |
| spec | ✅ done | spec.md（BQ-1 已决议写回：profiles 不纳入） |
| plan | ✅ done | plan.md + plans/01-merge-resolution-impl-notes.md |
| coding | ✅ done | 代码变更：tools/lib/sources.js（新增）、tools/tests/sources.test.js（新增）、tools/cli.js、tools/lib/{workflow,assemble,subflow,gate,deps}.js、SKILL.md |
| reporting | 🔄 running | execution-report.md |

## 验证摘要

### 统计

`node --test tests/*.test.js`：**184 passed / 0 failed**（177 项既有回归 + 7 项新增 sources 用例）。覆盖：合并列出与 source 标注（AC-2/AC-3）、本地预设按名启动并完成 exec/validate/next 全循环混引内置+本地任务（AC-1）、预设同名与任务同名双类冲突 fail-fast 含两路径（AC-4）、空注册环境与现状基线一致及显式 flag 密闭性（AC-5）、guide mode 选项一步命中（FR-2）。

### 修复记录

- 第一轮回归暴露 `list.test.js` 断言失败：phaseContext 的任务缺失错误丢失「可用任务见 list tasks」指引 → 已修复（消息带查找范围与指引）。
- sources 全循环用例暴露两处未接线直读点（gate.js openGates/present 钩子、deps.js readDependencies），导致 `next` 对本地任务 ENOENT → 已改经 sources 解析并复测通过。

## 决策日志

state v2 无 history 字段，事件流原样引用自 run 目录 `.usage.jsonl`（关键条目摘录，未删改）：

```json
{"seq":7,"event":"interacted","stage":"spec","phase":"02","option":"回答BQ-1","note":"用户决议：profiles 不纳入缺省自动发现，保持纯文件引用、引擎不感知"}
{"seq":9,"event":"decision","command":"next","stage":"spec","option":"同意"}
{"seq":15,"event":"interacted","stage":"plan","phase":"02","option":"提问","note":"用户问：哪些问题需要决策？理解本需求就是为 list 添加参数"}
{"seq":17,"event":"decision","command":"next","stage":"plan","option":"同意"}
{"seq":22,"event":"decision","command":"next","stage":"coding","option":"同意"}
```

## 核心文档

- [requirement.md](requirement.md) — 用户原始需求照录
- [spec.md](spec.md) — Alignment Spec（已批准，含 BQ-1 决议）
- [plan.md](plan.md) — 技术 Plan revision 1（已批准；split 模式）
- [plans/01-merge-resolution-impl-notes.md](plans/01-merge-resolution-impl-notes.md) — 实现注记（调用点清单/错误文案/测试组织）
- test-plan.md：本链（basic）无该阶段，不适用

## 遗留事项

- 真机 AC-1 验收：本机 `~/.ddo` 注册样例缺失（plan BASE-9），「新会话输入 ones-d 零搜索启动」需用户重建 ones 注册后人工确认；功能面已由夹具测试达成。
- 引擎契约张力（plan phase 01 output dirs 强制 `plans/` 非空 vs schema single 模式「不创建 plans/」）：建议另立 run 修正。
