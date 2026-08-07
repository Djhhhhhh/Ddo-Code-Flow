---
name: review
version: "4.0.0"
enabled: false
timeoutSec: 0
concurrency:
  parallelizable: false
confirmation:
  rejectAction: regenerate-with-feedback
consumes:
  - role: tasks-dir
    required: false
produces:
  - role: review-report
    kind: markdown
    primary: true
outputSchemaRef: "skill://atom-tasks/review/review-report.output.schema.json"
options:
  - key: models
    type: array
    items: { type: string }
    default: []
    label: "Models"
    description: "模型列表（多模型评审扇出，空=单模型评审）"
  - key: model
    type: string
    default: "inherit"
    label: "Model"
    description: "单模型评审时的模型值"
---

# review

> 占位的代码/文档复审 atom-task。默认 enabled=false；启用后会以 sub-agent 的方式逐条核对内置复审清单，并产出 review-report。

## 指令

生成一个 sub-agent（或将自己视为 sub-agent），逐条遍历内置复审清单。对每个条目，对照 `.state.json.worktreePath` 中的代码和 runtime 注入的文档产物进行评估。将 review-report 写入磁盘，每个 checklist 条目一个 section：`## <条目>` 后跟结论（通过/不通过/不适用）和备注。

### 多模型评审扇出（options.models）

当 `options.models` 非空时，执行多模型评审：

```
reviews = []
FOR EACH model IN models:
  review = 委派 subagent 使用 model 执行评审
  reviews.append({ model: model, review: review })

合并评审报告：
  1. 简单拼接：每个 review 独立一段，标注模型名
  2. 共识提取：所有 review 都提到的问题标记为"高置信度"
  3. 冲突标记：仅一个 review 提到的问题标记为"待确认"

输出合并评审报告到 review-report
```

当 `options.models` 为空时，使用 `options.model` 执行单模型评审（行为与现状一致）。

## 约束

- 不得在此阶段编辑源代码；仅做 review。
- 要具体：引用文件路径和行号来锚定发现。
- 如果 checklist 为空或所有条目都是不适用，写「无适用条目」并继续。
