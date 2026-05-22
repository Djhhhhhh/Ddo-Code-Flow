# task-02 — 编写默认 config.json

## 目标
基于 task-01 的 schema，落地一份**符合 schema、含 12 阶段 DAG 拓扑、每个 stage 与 atom-task 都有 description** 的默认 `config.json`。

## 范围
- 写 `skills/ddo-swe/config.json`

## 依赖
- task-01（schema 必须先就位以便自检）

## 关联验收点（test-plan.md）
- G2 全组（config.json 合法性、字段齐全、12 阶段顺序、stage.description 非空、`atomTasks` 为 DAG 对象、review 与 done 为空 DAG）。

## 步骤
1. 直接以 plan §4.1 的 jsonc 示例为骨架，把注释去掉，输出合法 JSON。
2. 每个 stage 的 `description` 沿用 plan §4.1 已给出的中文描述。
3. `base.contextPaths` 默认为 `["AGENTS.md","README.md","product.md"]`。
4. `base.confirmationGates` 默认为 `["specification","planning","test-planning","reflection"]`。
5. `base.respGenerator` 默认为 `{ "maxLength": 32, "case": "kebab", "stripStopwords": true }`。
6. `atomTaskOverrides` 默认为空对象 `{}`。
7. 用 task-01 的 `config.schema.json` 校验，必须通过。
8. 用一个简易 DAG 无环检查脚本（或心算）逐 stage 校验：所有 stage 默认是线性单节点，天然无环。

## 产物
- `skills/ddo-swe/config.json`
