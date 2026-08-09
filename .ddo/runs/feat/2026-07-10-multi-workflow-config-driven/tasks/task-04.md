# Task 04: 更新 SKILL.md

> 关联验收点：G5（渐进式加载说明）、G6（配置驱动说明）

## 目标

更新 `SKILL.md`，使其以 config.json 为唯一事实来源，描述 workflow 解析、参数覆盖、规则匹配、默认回退和渐进式加载逻辑。

## 变更文件

- `SKILL.md`

## 具体改动

### 1. Step 1 — Load and validate 重写

- 读取 config.json 和 config.schema.json。
- 校验 config.json 的 v3 结构（workflows 索引存在、default 有效、items 非空）。
- 如果 config.json 仍是 v2（含顶层 pipeline、无 workflows），执行自动迁移：
  - 将 pipeline + base.confirmationGates + atomTaskOverrides 写入 `workflows/standard.json`。
  - 将 config.json 升级为 v3 索引结构。
  - 提示用户已完成自动迁移。
- 对每个 workflow JSON 执行：文件存在性校验、JSON 解析校验、DAG 无环校验。
- 校验 workflows.default 引用有效。

### 2. 新增 Workflow 解析步骤

在 Step 2 之前新增 workflow 解析逻辑：
- 读取 config.json。
- 如果用户参数中包含 `workflow=<id>` / `mode=<id>` / `profile=<id>` 且 `allowUserOverride` 为 true，使用该 id。
- 否则按 `workflows.selection.rules` 顺序检查 `matchAny` 关键词是否命中用户需求文本。
- 若无命中，使用 `fallback` 规则。
- 若仍无结果，使用 `workflows.default`。
- 从 `workflows.items` 加载对应的 workflow JSON。
- 如果 `.state.json` 已存在且含 `workflowId`，优先使用该 workflow 恢复。

### 3. Step 3 — Execute the pipeline 渐进式说明

明确以下渐进式加载行为：
- runtime 启动只读取 config.json、config.schema.json 和目标 workflow JSON。
- 进入某个 stage 时才读取该 stage 的 atom-task 定义。
- 进入某个 node 时才读取该 node 的 .md、output schema 和声明的 inputs。
- override 合并优先级：workflow 级 > config 全局级 > atom-task 自身默认值。
- confirmationGates 从 workflow JSON 读取（不再依赖根 base）。

### 4. 更新 Inputs 和路径说明

- SKILL.md 的 Inputs section 更新：config.json 描述改为"workflow 索引 + 全局配置"。
- 新增 `workflows/*.json` 作为输入。

## 约束

- 不得硬编码具体的 workflow 名称或 stage 组合——一切来自配置。
- 不得删除现有的 Step 2（Resolve target directory）和产物目录结构说明。
- 渐进式加载描述必须足够具体，让执行 agent 能按描述操作。
