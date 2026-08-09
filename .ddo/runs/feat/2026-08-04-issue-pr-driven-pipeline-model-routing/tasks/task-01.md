# Task 01: Label 协议定义 + config.schema.json 更新

> 关联验收点：G1（Issue 触发与认领）、G7（向后兼容性）

## 目标

定义 `ddo:` 前缀的 label 词汇表，更新 `config.schema.json` 支持 issue-driven 工作流索引和模型路由配置。

## 变更文件

- `config.schema.json`
- `config.json`

## 具体改动

### 1. 在 config.schema.json 中新增 issue-driven 相关定义

在 `$defs` 中新增：
- `labelProtocol`：定义 `ddo:` 前缀 label 词汇表的 schema
- `modelRouting`：定义 `model` 保留键的 schema（string 或 string[]）

### 2. 更新 atomTaskOverrides schema

允许 `model` 键出现在 `atomTaskOverrides` 中：
```jsonc
"atomTaskOverrides": {
  "type": "object",
  "additionalProperties": {
    "type": "object",
    "properties": {
      "enabled": { "type": "boolean" },
      "model": {
        "oneOf": [
          { "type": "string" },
          { "type": "array", "items": { "type": "string" } }
        ]
      }
    }
  }
}
```

### 3. 更新 config.json

在 `workflows.items` 中新增 issue-driven 工作流索引：
```jsonc
{ "id": "issue-driven", "name": "Issue Driven", "path": "workflows/issue-driven.json" }
```

## 约束

- 不得删除现有 schema 定义（向后兼容）
- `model` 键为保留键，不参与普通 options 合并
- label 词汇表为封闭集合，不可自定义新增
