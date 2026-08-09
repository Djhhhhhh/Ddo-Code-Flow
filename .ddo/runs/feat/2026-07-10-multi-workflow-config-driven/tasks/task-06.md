# Task 06: 更新 Studio UI — studio.js

> 关联验收点：G7（UI 切换预览）、G8（UI 保存一致性）

## 目标

更新 `studio.js`，使其能加载 workflows 索引、渲染 workflow 切换控件、切换后重新绘制 DAG 预览，并在保存时分别写回 config.json 和对应 workflow JSON。

## 变更文件

- `ui/studio.js`

## 具体改动

### 1. 加载 workflows

修改初始化逻辑：
- 读取 config.json 后，解析 `workflows.items` 数组。
- 对每个 item，通过 File System Access API 读取 `path` 指向的 workflow JSON。
- 存储为 `loadedWorkflows` map（id → workflow object）。
- 设置 `activeWorkflowId = config.workflows.default`。

### 2. 填充 workflow select

- 从 `workflows.items` 生成 `<option>` 列表填充 `#workflow-select`。
- 默认选中 `activeWorkflowId`。
- 显示当前 workflow 的 `description` 到 `#workflow-description`。

### 3. 切换预览

- 监听 `#workflow-select` 的 `change` 事件。
- 切换时更新 `activeWorkflowId`。
- 调用现有的 `renderPipeline()` / `renderDAG()` 函数，传入新 workflow 的 `pipeline` 数据。
- 更新 `#workflow-description` 文本。
- 更新右侧 Inspector 中的 atom-task override 视图（如有）。

### 4. 保存逻辑

修改保存逻辑：
- 保存时将全局配置（base、atomTaskOverrides、workflows 索引）写回 config.json。
- 将当前 activeWorkflow 的 pipeline、confirmationGates、atomTaskOverrides 写回对应的 workflow JSON 文件（通过 `workflows.items` 中的 `path`）。
- 如果用户修改了 atom-task 开关，写入 workflow 级 `atomTaskOverrides`（不写全局）。

### 5. 跨文件校验（保存前）

- 校验 workflow DAG 无环。
- 校验 workflow 引用的 atom-task 存在。
- 校验失败则显示错误、禁用保存。

## 约束

- 不得破坏现有的 config.json 编辑能力（base 字段编辑仍正常）。
- workflow 切换为预览+编辑模式，非只读预览。
- 保存时必须分别持久化 config.json 和 workflow JSON，不得只更新内存状态。
- 不得引入外部依赖。
