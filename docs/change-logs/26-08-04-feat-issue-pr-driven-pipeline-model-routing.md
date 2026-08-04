# 变更日志

**提交信息**: feat(pipeline): Issue/PR 驱动开发流水线 + 节点级模型路由
**分支**: feat/2026-08-04-issue-pr-driven-pipeline-model-routing
**日期**: 2026-08-04
**作者**: Djhhh

## 变更文件

### 新增文件
- atom-tasks/create-pr/create-pr.md (added)
- atom-tasks/create-pr/create-pr.output.schema.json (added)
- atom-tasks/delivery-doc/delivery-doc.md (added)
- atom-tasks/delivery-doc/delivery-doc.output.schema.json (added)
- atom-tasks/issue-fetch/issue-fetch.md (added)
- atom-tasks/issue-fetch/issue-fetch.output.schema.json (added)
- atom-tasks/remote-gate/remote-gate.md (added)
- atom-tasks/remote-gate/remote-gate.output.schema.json (added)
- scripts/gh-watcher.sh (added)
- workflows/issue-driven.json (added)
- docs/feat/2026-08-04-issue-pr-driven-pipeline-model-routing/ (added)

### 修改文件
- SKILL.md (modified)
- atom-tasks/coding/coding.md (modified)
- atom-tasks/plan/plan.md (modified)
- atom-tasks/plan/plan.output.schema.json (modified)
- atom-tasks/review/review.md (modified)
- atom-tasks/spec/spec.md (modified)
- atom-tasks/spec/spec.output.schema.json (modified)
- atom-tasks/verification/verification.md (modified)
- config.json (modified)
- config.schema.json (modified)

## 统计
- 新增文件: 23
- 修改文件: 10
- 删除文件: 0
- 代码行数: +4409 / -241

## 描述

为 Ddo-Code-Flow 新增两项独立能力：

### 能力 A：Issue/PR 驱动工作流
- `ddo:` 前缀 label 协议（trigger/in-progress/pending-review/approved/changes-requested/failed/completed/suspended）
- `issue-fetch` 原子任务：认领锁 + 拉取 issue 内容 + 完整性检查
- `remote-gate` 原子任务：幂等、可重入的远端确认门，支持 Monitor 自动感知信号变化
- `delivery-doc` + `create-pr` 原子任务：交付文档 + draft PR 闭环
- `issue-driven.json` 工作流定义：完整的 issue 驱动开发流程
- `gh-watcher.sh` 轮询脚本：双模式巡检（扫描新 issue + 等待门信号）

### 能力 B：节点级模型路由
- `model` 配置键：支持档位别名（opus/sonnet/haiku/fable）和完整模型名双路径
- subagent 委派实现：主会话模型不可切换的约束下工作
- 多模型评审扇出：`models[]` 参数支持多个模型独立评审并合并报告
- 优先级：workflow 级 > config 全局 > atom-task 默认 > 继承

### 向后兼容性
- 现有工作流（standard/guarded/lightweight）未修改
- 模型路由未配置时回退为继承模式
- issue-driven 工作流作为新增选项，不影响现有流程
