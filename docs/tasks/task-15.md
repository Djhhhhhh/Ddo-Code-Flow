# task-15 — UI Atom-tasks Tab：扫描 + 开关 + Add to stage

## 目标
实现"列出所有 atom-task + 启用/禁用开关 + 未使用时一键加入流水线"的核心功能（对应你的需求 5）。

## 范围
- `index.html` 中 Atom-tasks Tab 容器
- `app.js` 中扫描逻辑、卡片渲染、开关写入、Add-to-stage 写入
- `styles.css` 复用现有 token

## 依赖
- task-11 / task-12（骨架 + state）
- task-04 ~ task-10（必须有至少几个 atom-task 子目录可被扫描）

## 关联验收点
- G7.4 全组（扫描、in pipeline 标志、开关、Add to stage 一键加入、不修改 atom-task 自身 JSON）
- G10：解耦原则（开关与拓扑变更都落 config.json）

## 步骤
1. **扫描**：
   - 进入 Tab 自动触发；并提供顶部 "Scan atom-tasks/" `btn-secondary`。
   - 通过 directory handle 遍历 `atom-tasks/*/` 子目录，跳过 `_schema/`；读取每个子目录下与目录同名的 `<name>.json`（找不到则把该 atom-task 标为 "broken: missing <name>.json"）。
   - 把结果写入 `state.scannedAtoms = [{ name, description, stage, enabled, ... }]`。
2. **卡片渲染**：每张 `.atom-node` 风格卡片显示：
   - name（heading-sm）
   - description（body-sm in body 色）
   - 一行 meta：`stage: <stage>` + `in pipeline: ✓/✗`
   - 右侧 ENABLED/DISABLED pill 开关（启用 = `btn-primary` 风格，禁用 = `btn-disabled` 风格）
3. **in pipeline 判定**：遍历 `state.config.pipeline[*].atomTasks.nodes` 看 name 是否出现。
   - 出现 → 显示 ✓，点击文字跳转到 Pipeline Tab 并高亮该节点（用一个事件 + 滚动 + 边框临时反色 1.5s）。
   - 未出现 → 显示 ✗，并在卡片底部显示 `Add to <stage> stage ▼` 下拉（默认值取 atom-task JSON 的 stage 字段）+ 一个 "Add" `btn-primary` 按钮。
4. **Add to stage 动作**：
   - 把 name 加入 `state.config.pipeline[stage=<选择>].atomTasks.nodes`，初始 `next: []`、`parallelApprove: false`；
   - 同时 push 到该 stage 的 `entry` 末尾；
   - 切到 Pipeline Tab 并触发高亮新节点。
5. **开关动作**：写 `state.config.atomTaskOverrides[name].enabled`；**不**修改 `atom-tasks/<name>/<name>.json`。
6. **断裂状态**：如果某 atom-task 在 config.json 中被引用但磁盘上找不到，扫描结果里仍列出但标 `broken`，并在 Pipeline Tab 对应节点画红边。

## 产物
- Atom-tasks Tab 完整可用版本
