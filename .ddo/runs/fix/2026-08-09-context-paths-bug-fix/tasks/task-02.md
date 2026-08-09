# Task-02: 修改 context.md

## 标题

修改 context.md 添加 contextPaths 定位说明

## 关联验收点

- G1: contextPaths 文档澄清 (AC-1, FR-1)

## 变更文件

- atom-tasks/context/context.md

## 变更内容

### 1. 添加 contextPaths 定位说明（在约束之前）

**当前内容**:
```
> 读取项目基础上下文（AGENTS.md + 有效配置中的 contextPaths）并汇总为 context-summary 角色。
> 缺失项不阻断流水线，但记录到执行报告中。产物在 worktree 建立前交由 runtime 延迟登记。

## 指令

读取项目根目录的 AGENTS.md（若存在）以及 runtime 注入的 contextPaths。对于每个缺失的输入，将其记录到「上下文缺失」列表中。生成 context-summary 产物，包含两个 section：「已加载来源」（文件路径 + 一行摘要）和「上下文缺失」（声明了但实际不存在的文件列表）。contextPaths 中的路径相对于本次目标项目的 `projectRoot` 解析；不得相对于 worktree 目标目录解析。

## 约束
```

**修改为**:
```
> 读取项目基础上下文（AGENTS.md + 有效配置中的 contextPaths）并汇总为 context-summary 角色。
> 缺失项不阻断流水线，但记录到执行报告中。产物在 worktree 建立前交由 runtime 延迟登记。

## 指令

读取项目根目录的 AGENTS.md（若存在）以及 runtime 注入的 contextPaths。对于每个缺失的输入，将其记录到「上下文缺失」列表中。生成 context-summary 产物，包含两个 section：「已加载来源」（文件路径 + 一行摘要）和「上下文缺失」（声明了但实际不存在的文件列表）。contextPaths 中的路径相对于本次目标项目的 `projectRoot` 解析；不得相对于 worktree 目标目录解析。

## contextPaths 定位说明

`contextPaths` 是**项目级基线上下文**，对项目内每一次 run 都加载同一份内容。它适用于：
- 项目架构文档、AGENTS.md 等跨需求稳定的参考资料
- 团队规范、代码风格指南等项目级约束

**不适用于**按需求变化的上下文（如某次需求的调研报告、issue 正文等）。按需求变化的上下文应通过以下通道注入：
- `issue-context` 角色（由 `issue-fetch` atom-task 产出）：用于 issue 驱动的工作流
- `--context <path>` 运行参数：用于临时追加本次 run 的上下文路径（不修改项目配置）

## 约束
```

## 验收标准

- [ ] cmd: grep -q "项目级基线上下文" atom-tasks/context/context.md
- [ ] cmd: grep -q "跨需求稳定" atom-tasks/context/context.md
- [ ] cmd: grep -q "不适用于.*按需求变化" atom-tasks/context/context.md
