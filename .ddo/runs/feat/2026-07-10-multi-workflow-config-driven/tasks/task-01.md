# Task 01: 更新 config.schema.json

> 关联验收点：G2（config.json 结构与 Schema 校验）、G3（DAG 无环校验）

## 目标

更新 `config.schema.json`，使其同时支持 v3 索引结构和旧 pipeline 兼容，并新增 `workflowDefinition` 子 schema。

## 变更文件

- `config.schema.json`

## 具体改动

### 1. 调整根 schema 的 required 字段

将 `pipeline` 从 `required` 中移除，改为 `["version", "base", "atomTaskOverrides"]`。

### 2. 新增 `workflows` 属性定义

```jsonc
"workflows": {
  "type": "object",
  "required": ["default", "items"],
  "properties": {
    "default": { "type": "string", "minLength": 1 },
    "selection": {
      "type": "object",
      "required": ["allowUserOverride", "argumentNames", "rules"],
      "properties": {
        "allowUserOverride": { "type": "boolean" },
        "argumentNames": { "type": "array", "items": { "type": "string" } },
        "rules": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["workflow"],
            "properties": {
              "workflow": { "type": "string" },
              "matchAny": { "type": "array", "items": { "type": "string" } },
              "fallback": { "type": "boolean" }
            }
          }
        }
      }
    },
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "name", "path"],
        "properties": {
          "id": { "type": "string", "pattern": "^[a-z0-9][a-z0-9-]*$" },
          "name": { "type": "string", "minLength": 1 },
          "path": { "type": "string", "minLength": 1 }
        }
      }
    }
  }
}
```

### 3. 保留 `pipeline` 定义（可选）

`pipeline` 属性定义不变，但从 required 中移除，使其成为可选字段。

### 4. 新增 `$defs.workflowDefinition` 子 schema

在 `$defs` 中新增 `workflowDefinition`，供 workflow JSON 文件引用。结构与现有 pipeline item 类似，但额外包含 `id`、`version`、`name`、`description`、`confirmationGates` 顶层字段。

## 约束

- 不得删除旧 `pipeline` 的 schema 定义（向后兼容）。
- `$defs.stageEnum` 保持不变。
- `workflowDefinition` 的 `pipeline` items 结构必须与现有 pipeline items 结构一致（复用同一 schema）。
