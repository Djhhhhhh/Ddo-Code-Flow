# task-06: applyMutation 写守卫 + init-state/find-resumable

- 关联验收点：G4（AC-4，FR-GUARD-6）
- 依赖：task-02, task-03
- 状态：pending

## 目标

实现唯一写入口 `applyMutation(state, patch, writer)`，把 `x-ddo-writer` 从注释变成拦截器；并实现 state 初始化与恢复。

## 涉及文件

- `scripts/runtime/lib/state.js`（新增）

## 实现要点

- 启动时读 `state.schema.json` 建 `field → writer` 表（来自 `x-ddo-writer`）。
- 写入校验：patch 顶层字段不在 schema（`additionalProperties:false`）→ exit 1；`fieldOwner[field] != writer` → exit 1。
- 通过后合并 + 原子落盘。
- `init-state`：授权写初始骨架（含 null 的 git-worktree 字段，bootstrap 例外）；`find-resumable`：扫 `*/.ddo/runs/*/*/.state.json`，按锚点匹配（currentStage≠done + projectRoot + worktreePath 存在），多候选 → exit 1 求选择。

## 验收

- [ ] cmd: node --test scripts/runtime/test/apply-mutation.test.js（去 skip 后全绿）
