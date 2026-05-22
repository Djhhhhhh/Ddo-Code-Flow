# task-{{ NN }} — {{ short title }}

## 目标
{{ One sentence describing what this task achieves. }}

## 范围
- {{ file or area touched }}
- {{ file or area touched }}

## 依赖
- {{ task-NN (or "无" if none) }}

## 关联验收点（test-plan.md）
- {{ G-N: short description }}
- {{ G-N: short description }}

## 步骤
1. {{ step }}
2. {{ step }}
3. {{ step }}

## 产物
- {{ produced file path }}
- {{ produced file path }}

---

<!--
task-group.json schema reminder (must live at tasks/task-group.json):

{
  "version": "1.0.0",
  "tasks": [
    { "id": "task-01", "file": "task-01.md", "title": "...", "dependsOn": [] },
    { "id": "task-02", "file": "task-02.md", "title": "...", "dependsOn": ["task-01"] }
  ],
  "parallelGroups": [
    ["task-01"],
    ["task-02"]
  ]
}

- `parallelGroups` is optional. When present, it is the authoritative batch schedule.
- When absent, agent topologically sorts via dependsOn and treats same-layer tasks as one batch.
-->
