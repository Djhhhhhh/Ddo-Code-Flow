# task-16 — UI 浏览器兼容兜底与错误反馈打磨

## 目标
在不支持 File System Access API 的浏览器（Firefox / Safari / 旧 Chromium）中，UI 仍可使用"导入/导出 config.json"的退化通路；同时统一全局错误提示样式。

## 范围
- `app.js` 中兼容性检测与退化交互
- `index.html` 中对应 DOM
- `styles.css` 中错误条 / 提示条样式

## 依赖
- task-12（兼容兜底骨架已在 task-12 中起步，本任务负责打磨）

## 关联验收点
- G7.5：兼容性兜底
- G7.1：拒绝授权时 UI 不挂死并给出引导

## 步骤
1. **特性检测**：页面启动时检测 `window.showDirectoryPicker`。
   - 不支持 → 顶栏把 "Open folder" 替换为 "Import config.json" 与 "Export config.json"。
   - Import：`<input type="file" accept=".json">`，读取后注入 `state.config`。
   - Export：把 `state.config` 序列化为 Blob → `URL.createObjectURL` → 触发下载。
   - 同时显示一条 banner：当前为兼容模式，无法读写 atom-tasks 目录，原子任务 Tab 切换到 "Manual list" 模式（仅展示 config.json 中已引用的 atom-task）。
2. **错误反馈**：
   - 在顶栏正下方放一个 `.banner` 容器；三种态：info / warn / error。
   - 校验失败 / DAG 成环 / 文件读写异常都通过此 banner 展示，文案明确（中英文皆可，与既有页面一致）。
3. **授权被拒**：用户点 "Open folder" 后取消 / 拒绝 → 显示 `info` banner "未选择 skill 目录，部分功能不可用"，但页面其余 UI 不挂死。
4. **保存成功反馈**：Save 成功后 banner 显示 1.5s 的 `info` "已保存到 config.json"，自动消失。

## 产物
- `app.js` 完整兼容路径
- `styles.css` 新增 `.banner` 系列样式
