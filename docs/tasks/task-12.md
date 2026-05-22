# task-12 — UI 通信层：File System Access API + schema/DAG 校验器

## 目标
在 `app.js` 中实现"目录授权 → 读 config.json → 校验 → 内存态 → 写回"的核心数据通路；以及 schema 校验 + DAG 无环检查（轻量自实现，零依赖）。

## 范围
- 在 `skills/ddo-swe/ui/app.js` 中新增模块：
  - `fs.js` 角色：File System Access API 封装（pick directory / read file / write file）
  - `schema.js` 角色：轻量 JSON Schema 校验（仅支持 type / required / enum / pattern / items / properties）
  - `dag.js` 角色：DAG 无环检查
  - `state.js` 角色：全局 in-memory state（加载的 config + 扫描到的 atom-task list）

> 实现方式由开发者自选：可以是单文件分 namespace，也可以拆多个 JS 用 `<script>` 顺序加载。

## 依赖
- task-01（schema 文件）
- task-02（默认 config.json 用于联调）
- task-11（HTML 骨架与按钮要存在以挂载逻辑）

## 关联验收点
- G2：DAG 无环校验生效；旧格式自动迁移。
- G7.1：Open folder 触发目录选择器并显示路径。
- G7.5：兼容性兜底（在不支持 File System Access API 的浏览器中给出提示并提供下载/上传通路）。

## 步骤
1. 实现 `pickSkillDirectory()`：调用 `window.showDirectoryPicker`；保存 directory handle 到 state；顶栏右侧显示目录名。
2. 实现 `readJSON(handle, relPath)` / `writeJSON(handle, relPath, obj)`，相对 skill 目录。
3. 在 directory 授权后立即：
   - 读 `config.json` 与 `config.schema.json`；
   - 用 `schema.js` 校验；失败则在顶栏下方显示错误条；
   - 用 `dag.js` 对每个 stage 的 `atomTasks` 做无环 + 引用存在性检查；
   - 把字符串数组旧格式自动迁移为 DAG（plan §4.4 向后兼容），迁移后弹一条 banner "config schema upgraded"。
4. 实现 Save 按钮：
   - 序列化 state.config → 重新校验 → 写盘；
   - 校验失败则按钮变 `btn-disabled`，并在出错字段上加 1px 红边框。
5. 实现 Reload 按钮：丢弃 in-memory 变更，重读磁盘。
6. 浏览器兼容兜底：
   - 检测 `window.showDirectoryPicker` 是否存在；不存在则在 Open folder 按钮位置改为 "Import config.json" 与 "Export config.json"，提供 input[type=file] 与 download anchor 的退化通路。

## 产物
- `app.js`（增量补充）
