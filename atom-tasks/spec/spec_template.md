# {{ Project Name }} Specification

> AI 基于 `requirement.md` 与 `context-summary.md` 对需求的规约化理解。
> 仅描述 What / Why 与验收标准；技术方案见 `plan.md`。
> 用户确认本 spec 是否符合预期后，方可进入下一阶段（Planning）。

---

## 1. 项目概述

### 1.1 项目名称
{{ project-name }}

### 1.2 一句话定义
{{ one-line definition }}

### 1.3 设计意图
- {{ intent-1 }}
- {{ intent-2 }}

---

## 2. 术语表（Glossary）

| 术语 | 定义 |
|---|---|
| {{ term }} | {{ definition }} |

---

## 3. 功能需求（Functional Requirements）

### 3.1 {{ module/group name }}

- **FR-{{XXX}}-1**：{{ requirement }}
- **FR-{{XXX}}-2**：{{ requirement }}

### 3.2 {{ another module }}

- **FR-{{YYY}}-1**：{{ requirement }}

---

## 4. 产物与目录结构（What gets created）

```
{{ filesystem tree }}
```

---

## 5. 关键流程

```
{{ ascii / pseudo flow diagram }}
```

---

## 6. 约束与原则

- **C-1**：{{ constraint }}
- **C-2**：{{ constraint }}

---

## 7. 验收标准（Acceptance Criteria）

> spec 层的高层验收点，后续在 `test-plan.md` 中细化为 checklist。

- **AC-1**：{{ acceptance criterion }}
- **AC-2**：{{ acceptance criterion }}

---

## 8. 非功能需求（Non-Functional）

- **NFR-1**：{{ nfr }}
- **NFR-2**：{{ nfr }}

---

## 9. 范围说明（In / Out of Scope）

### In Scope
- {{ in-scope item }}

### Out of Scope
- {{ out-of-scope item }}

---

## 10. 开放问题（Open Questions，待 Plan 阶段决策）

- **Q-1**：{{ open question }} —— 留给 `plan.md`。
- **Q-2**：{{ open question }} —— 留给 `plan.md`。

---

## 11. 用户确认

请确认以下任一选项：

- ✅ **同意**：本 spec 符合预期，可进入 **Planning** 阶段生成 `plan.md`。
- ❌ **修改**：请在下方/对话中列出需要调整的条款编号与意见，AI 将基于反馈重新生成本文档。
