# task-03: 协议解析

- 关联验收点：G9（DEC-4）
- 依赖：task-01
- 状态：pending

## 目标

实现三种协议的路径解析，修正原调研文档 §4 的 `run://→artifactDir` 笔误。

## 涉及文件

- `scripts/runtime/lib/protocol.js`（新增）

## 实现要点

- `skill://X` → `path.join(skillRoot, X)`
- `project://X` → `path.join(projectRoot, X)`（X 通常含 `.ddo/…`，见原 doc §4 示例 `project://.ddo/hooks/x.js`；不可再拼 `.ddo` 前缀以免双重 `.ddo`）
- `run://X` → `path.join(worktreePath, X)`（X 已含 `.ddo/runs/...`，不可再拼 artifactDir，避免双重 `.ddo/runs`）
- 未知前缀 → exit 2 用法错误
- 内部用 `path.join()`，不手拼分隔符。

## 验收

- [ ] cmd: node --test scripts/runtime/test/protocol.test.js（去 skip 后全绿）
