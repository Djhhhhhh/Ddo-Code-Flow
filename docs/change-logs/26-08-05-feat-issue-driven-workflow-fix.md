# 变更日志

**提交信息**: feat(pipeline): 修复 issue-driven 工作流 + 参数标准化 `--key value`
**分支**: main
**日期**: 2026-08-05
**作者**: Djhhh

## 变更文件
- .claude/settings.json (added)
- .claude/settings.local.json (added)
- .gitignore (modified)
- SKILL.md (modified)
- atom-tasks/create-pr/create-pr.md (modified)
- atom-tasks/issue-fetch/issue-fetch.md (modified)
- atom-tasks/remote-gate/remote-gate.md (modified)
- config.json (modified)
- config.schema.json (modified)
- workflows/issue-driven.json (modified)

## 统计
- 新增文件: 2
- 修改文件: 8
- 删除文件: 0
- 代码行数: +235 / -53

## 描述

### Bug 修复
1. **issueRef 无法传递** — issue-fetch 改为自动扫描 ddo:trigger 标签的 issue
2. **remote-gate-\* 节点名不匹配** — 新增 `taskRef` 字段，节点可引用其他 atom-task
3. **issueNumber 无法跨任务传递** — 通过 `.state.json.issueContext` 共享
4. **remote-gate 不支持本地模式** — 新增 `localMode` 选项，跳过 GitHub 轮询直接放行
5. **confirmationGates 为空** — issue-driven 补充确认门配置

### 新功能
- **`--key value` 参数格式** — `/Ddo-Code-Flow --model issue` 触发 issue-driven 工作流
- **taskRef 机制** — DAG 节点可通过 `taskRef` 引用其他 atom-task
- **node options** — 节点级选项覆盖 atom-task 默认值
- **io 覆盖** — 节点级 input 映射覆盖 atom-task 默认 input
- **state 共享** — atom-task 通过 `.state.json` 传递上下文
- **allowedTools** — 项目级 Claude Code 权限配置，自动放行 pipeline 命令
