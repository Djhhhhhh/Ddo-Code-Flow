# 上下文摘要

> 自动生成自项目上下文扫描。

## 已加载来源

| 文件路径 | 摘要 |
|---|---|
| README.md | ddo-code-flow 是可定制化的 AI 编程流水线 skill，12 阶段流水线 + atom-task DAG 编排 + Studio UI 可视化配置。当前版本 2.0.0（MD 化改造）。 |
| config.json | 当前为单 pipeline 结构，包含 12 个 stage（context → done），每个 stage 内含 atomTasks DAG。atomTaskOverrides 控制 review（禁用）、test-plan（TDD 启用）。 |
| config.schema.json | JSON Schema 定义 config.json 结构：version + base + pipeline + atomTaskOverrides。pipeline 为数组，每项含 stage/description/atomTasks。 |
| SKILL.md | skill 执行说明：指令型 runtime，读 config → 校验 → resolve targetDir → 执行 pipeline stages → 渐进式加载 atom-task → 产物写入 worktree。 |

## 上下文缺失

- AGENTS.md（声明但不存在）
