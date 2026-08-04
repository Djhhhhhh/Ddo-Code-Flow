# Context Summary

> 读取项目基础上下文，构建后续阶段所需的背景信息。

## 已加载来源

| 来源 | 摘要 |
|---|---|
| README.md | ddo-code-flow 是可定制化 AI 编程流水线 skill，12 阶段流水线、atom-task 可热插拔、配套 Studio 可视化配置页。当前版本 v2.0.0（MD 化改造）。 |
| config.json | v3 结构，3 个 workflow（lightweight / standard / guarded），targetDir=`..`，metrics 默认关闭。 |
| config.schema.json | 定义 config 与 workflow 的 JSON Schema，含 stageEnum 12 个阶段、workflowDefinition 定义。 |
| workflows/*.json | lightweight（跳过 test-plan/tasking）、standard（完整流水线）、guarded（启用 review 阶段）。 |
| atom-tasks/ | 12 个原子任务目录：context、requirement、git-worktree、spec、plan、test-plan、tasking、coding、verification、review、reporting、reflection。 |

## 上下文缺失

| 来源 | 原因 |
|---|---|
| AGENTS.md | 文件不存在（config.base.contextPaths 为空，此项为默认输入但缺失） |
