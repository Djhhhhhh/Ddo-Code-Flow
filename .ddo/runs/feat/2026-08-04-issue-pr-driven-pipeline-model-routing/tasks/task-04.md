# Task 04: issue-driven.json 工作流定义

> 关联验收点：G1（Issue 触发与认领）、G2（远端确认门）、G7（向后兼容性）

## 目标

创建 `issue-driven.json` 工作流定义，组装完整 DAG，引用所有新 atom-task。

## 变更文件

- `workflows/issue-driven.json`（新建）

## 具体改动

### 1. 创建 issue-driven.json

```jsonc
{
  "$schema": "../config.schema.json#/$defs/workflowDefinition",
  "id": "issue-driven",
  "version": "1.0.0",
  "name": "Issue Driven",
  "description": "Issue/PR 驱动开发流水线：认领 issue → 远端确认门 → 交付 PR。",
  "descriptionEn": "Issue/PR driven pipeline: fetch issue → remote gates → deliver PR.",
  "confirmationGates": [],  // 远端确认门替代本地确认门
  "pipeline": [
    // context → requirement（含 issue-fetch）→ spec → remote-gate-spec →
    // plan → remote-gate-plan → test-plan → remote-gate-test-plan →
    // tasking → coding → verification → delivery-doc → create-pr → done
  ],
  "atomTaskOverrides": {
    "test-plan": { "enabled": true, "tdd": true }
  }
}
```

### 2. DAG 结构

```
context
  └→ issue-fetch
      └→ requirement
          └→ git-worktree
              └→ spec
                  └→ remote-gate-spec
                      └→ plan
                          └→ remote-gate-plan
                              └→ test-plan
                                  └→ remote-gate-test-plan
                                      └→ tasking
                                          └→ coding
                                              └→ verification
                                                  └→ delivery-doc
                                                      └→ create-pr
                                                          └→ done
```

### 3. 确认门说明

- `confirmationGates: []`：不使用本地确认门
- 远端确认门由 DAG 中的 `remote-gate-*` 节点承载
- 每个远端门节点是幂等、可重入的

## 约束

- DAG 不能有环
- 每个节点引用的 atom-task 必须存在
- 远端门节点必须在对应产物节点之后
- 向后兼容：现有工作流不受影响
