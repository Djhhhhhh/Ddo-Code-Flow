# Task 09: 多模型评审扇出

> 关联验收点：G6（多模型评审扇出）

## 目标

实现多模型评审扇出：支持 models[] 参数，按列表逐个委派 subagent 独立评审，父会话合并报告。

## 变更文件

- `atom-tasks/review/review.md`（更新）

## 具体改动

### 1. 更新 review.md

新增 models option：
```yaml
options:
  - name: models
    type: array
    items: { type: string }
    default: []
    description: "模型列表（多模型评审扇出）"
```

指令部分新增：
```
IF models 非空:
  reviews = []
  FOR EACH model IN models:
    review = 委派 subagent 使用 model 执行评审
    reviews.append(review)
  合并评审报告：
    - 简单拼接：每个 review 独立一段，标注模型名
    - 共识提取：所有 review 都提到的问题标记为"高置信度"
    - 冲突标记：仅一个 review 提到的问题标记为"待确认"
  输出合并评审报告
ELSE:
  在主会话内联执行评审
```

### 2. 合并策略

- 简单拼接：每个 review 独立一段，标注模型名
- 共识提取：所有 review 都提到的问题标记为"高置信度"
- 冲突标记：仅一个 review 提到的问题标记为"待确认"
- 不做投票/加权（过度设计）

## 约束

- 每个 subagent 只回结论级摘要
- 父会话合并为一份评审报告
- 模型数量不受限，取决于网关上注册了多少模型
- 向后兼容：models 为空时行为不变
