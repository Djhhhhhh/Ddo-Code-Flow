# task-02: 最小 JSON Schema 子集校验器

- 关联验收点：G9（AC-9，DEC-3）
- 依赖：task-01
- 状态：pending

## 目标

实现零依赖的 draft-2020-12 子集校验器，覆盖本仓库 schema 实际用到的关键字；未知关键字忽略（不报错），以保证对现有 schema 全部放行。

## 涉及文件

- `scripts/runtime/lib/jsonschema.js`（新增）

## 实现要点

- 支持：`type`（含联合数组）、`required`、`properties`、`additionalProperties`、`$ref`（局部 `#/$defs/...`）、`enum`、`const`、`pattern`、`minLength`、`minItems`、`items`、`oneOf`、`format`（仅 `date-time` 轻量正则）。
- 导出 `validate(schema, data) -> { valid, errors[] }`。
- 用全部现有 schema（state.schema.json / config.schema.json / atom-task-md.schema.json / output-schema.schema.json / artifact-catalog.schema.json）做快照测试，确保不误拦。

## 验收

- [ ] cmd: node --test scripts/runtime/test/jsonschema.test.js（去 skip 后全绿）
