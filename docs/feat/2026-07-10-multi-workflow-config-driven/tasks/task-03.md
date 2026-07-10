# Task 03: 重写 config.json 为 v3 索引结构

> 关联验收点：G2（config.json 结构与 Schema 校验）、G4（Workflow 选择逻辑）

## 目标

将 `config.json` 从 v2（单 pipeline）改造为 v3（workflow 索引），保留 base 和 atomTaskOverrides，移除顶层 pipeline 字段。

## 变更文件

- `config.json`

## 具体改动

### 1. 升级 version 为 "3.0.0"

### 2. 保留 base 不变

`targetDir`、`contextPaths`、`contextOptional`、`respGenerator`、`metrics` 保持原值。

### 3. 移除 base.confirmationGates

confirmationGates 下沉到各 workflow JSON 文件中，不再在根 config 的 base 中定义。

### 4. 移除顶层 pipeline 字段

旧 pipeline 内容已迁移到 `workflows/standard.json`（task-02）。

### 5. 新增 workflows 索引

```jsonc
"workflows": {
  "default": "standard",
  "selection": {
    "allowUserOverride": true,
    "argumentNames": ["workflow", "mode", "profile"],
    "rules": [
      { "workflow": "lightweight", "matchAny": ["docs", "文档", "调研", "小修"] },
      { "workflow": "guarded", "matchAny": ["安全", "数据迁移", "公开接口", "性能", "并发"] },
      { "workflow": "standard", "fallback": true }
    ]
  },
  "items": [
    { "id": "lightweight", "name": "Lightweight", "path": "workflows/lightweight.json" },
    { "id": "standard", "name": "Standard", "path": "workflows/standard.json" },
    { "id": "guarded", "name": "Guarded", "path": "workflows/guarded.json" }
  ]
}
```

### 6. 保留 atomTaskOverrides

全局 atomTaskOverrides 保持为空 `{}`（各 workflow 自带 override）。

## 约束

- 不得保留顶层 `pipeline` 字段。
- `workflows.default` 必须引用 `workflows.items` 中存在的 id。
- `workflows.selection.rules` 最后一条必须是 fallback。
- base 中其他字段（targetDir、respGenerator 等）不得修改。
