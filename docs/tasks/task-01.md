# task-01 — 编写 config.schema.json 与 atom-task.schema.json

## 目标
建立两份 JSON Schema 文件，作为后续 config.json、所有 atom-task JSON、以及 UI 校验器的**唯一真相源**。

## 范围
- 写 `skills/ddo-swe/config.schema.json`
- 写 `skills/ddo-swe/atom-tasks/_schema/atom-task.schema.json`

## 依赖
无（首发任务）。

## 关联验收点（test-plan.md）
- G1：`config.schema.json` / `_schema/atom-task.schema.json` 存在性。
- G2：`config.json` 顶层字段、`pipeline[].description` 非空、`atomTasks` 为对象（DAG）、DAG 无环。
- G3.2：atom-task JSON 必填字段、`description` 非空、`name == 目录名`、URI 协议前缀。

## 步骤
1. 用 JSON Schema Draft 2020-12 撰写 `config.schema.json`：
   - 顶层 `version` / `base` / `pipeline` / `atomTaskOverrides` 全部必填。
   - `base` 含 `targetDir` / `contextPaths`（array）/ `contextOptional`（boolean）/ `respGenerator` 对象 / `confirmationGates`（array, 至少含四个确认门枚举）。
   - `pipeline` 是 array，长度 = 12；每项含 `stage`（枚举：12 个 stage）/ `description`（非空字符串）/ `atomTasks`（对象，含 `entry` array、`nodes` 对象；`nodes[*]` 含 `next` array 与 `parallelApprove` boolean）。
   - `atomTaskOverrides` 是对象，value 形如 `{ "enabled": boolean }`。
   - 在 schema 中加 `$comment` 字段说明"DAG 无环由静态校验脚本/UI 检查器额外验证"。
2. 撰写 `atom-task.schema.json`：
   - 必填字段 `name`（string）/ `version`（semver string）/ `stage`（枚举同上）/ `description`（非空 string）/ `enabled`（boolean）/ `io`（object，含 `inputs` 与 `outputs` 数组）/ `prompt`（object）/ `confirmation`（object，含 `required` 与 `rejectAction`）/ `concurrency`（object，含 `parallelizable`）/ `timeoutSec`（integer ≥ 0）。
   - `io.inputs[*].ref` 与 `io.outputs[*].ref` 用 `pattern: "^(skill|run)://"`。
3. 对两份 schema 用任何在线 JSON Schema validator（或 `ajv compile`）做一次自检，确保 schema 本身合法。

## 产物
- `skills/ddo-swe/config.schema.json`
- `skills/ddo-swe/atom-tasks/_schema/atom-task.schema.json`
