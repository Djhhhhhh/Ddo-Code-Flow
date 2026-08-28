# 上下文摘要

> 自动生成自项目上下文扫描。

## 已加载来源

| 文件路径 | 摘要 |
|---|---|
| CLAUDE.md | 项目指令入口，标题「Ddo-Code-Flow Repository Rules」，通过 @引用加载 .claude/rules/v4-responsibility-boundaries.md。 |
| .claude/rules/v4-responsibility-boundaries.md | v4 职责边界规则：定义 atom-task / workflow / config / runtime 四层职责矩阵；硬规则包括新 atom-task frontmatter 须通过 atom-task-md.schema.json 校验、新产物角色须先登记 atom-tasks/artifacts.json、新 .state.json 顶层字段须在 state.schema.json 声明唯一 x-ddo-writer、指令经 {{inputs.<role>}} 消费上游、确认门仅在 workflow JSON、运行产物位于 .ddo/runs/<type>/<dateDescription>/、worktree 位于 worktreeDir、运行期禁写 skillRoot、禁改 .gitignore；附变更前自检清单（角色可达性测试、状态字段归属测试、配置与文档同步、禁止 legacy run://docs 路径）。 |

## 上下文缺失

- AGENTS.md（atom-task 声明的项目根上下文文件，实际不存在；本项目以 CLAUDE.md 承载同等职责）
