# {{ Project Name }} Plan

> 基于已确认的 `spec.md` 做技术决策：定 schema、定通信方式、定运行时模型、定关键算法、定取舍。
> 不写代码，但对每个开放问题给出唯一确定答案。
> 用户确认后方可进入 Test-Planning。

---

## 1. 决策原则

| # | 原则 | 落地体现 |
|---|------|----------|
| P-1 | {{ principle }} | {{ how it shows up }} |
| P-2 | {{ principle }} | {{ how it shows up }} |

---

## 2. 整体架构

```
{{ ascii architecture diagram }}
```

关键事实：
- {{ fact-1 }}
- {{ fact-2 }}

---

## 3. 目录与命名（最终定版）

```
{{ filesystem tree }}
```

---

## 4. 核心 Schema（必填，若适用）

### 4.1 {{ Schema name }}

```jsonc
{{ schema example }}
```

### 4.2 字段语义约束

- **`{{ field }}`**：{{ semantics }}

### 4.3 校验

- {{ validation rule }}

---

## 5. 关键算法 / 流程

### 5.1 {{ algorithm name }}

{{ pseudocode or step list }}

---

## 6. 错误处理与回退

| 触发条件 | 行为 |
|---|---|
| {{ trigger }} | {{ behaviour }} |

---

## 7. 风险与权衡

| # | 风险 | 描述 | 处置 |
|---|---|------|------|
| R-1 | {{ risk title }} | {{ description }} | {{ mitigation }} |

---

## 8. 实施次序（高层路线，供 Tasking 拆分参考）

1. {{ phase }}
2. {{ phase }}

---

## 9. 与 spec 的开放问题对应表

| spec Open Question | plan 中的落地 |
|---|---|
| Q-1 {{ question }} | {{ section }} |
| Q-2 {{ question }} | {{ section }} |

---

## 10. 用户确认

请确认以下任一选项：

- ✅ **同意**：本 plan 符合预期，可进入 **Test-Planning** 阶段生成 `test-plan.md`。
- ❌ **修改**：请在下方/对话中列出需要调整的章节与意见，AI 将基于反馈重新生成本文档。
