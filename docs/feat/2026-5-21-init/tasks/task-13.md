# task-13 — UI Base Tab：编辑基础配置

## 目标
实现 Base Tab 的全部表单控件，绑定到 `state.config.base`，可正确读写。

## 范围
- `index.html` 中 Base Tab 容器的 DOM 填充
- `app.js` 中 Base Tab 的渲染与数据绑定逻辑
- `styles.css` 复用现有 token，必要时新增局部 class（如表单 row）

## 依赖
- task-11（骨架）
- task-12（state + 读写 + 校验）

## 关联验收点
- G7.2：Base Tab 显示与保存

## 步骤
1. 表单字段：
   - `targetDir` —— `text-input` pill
   - `contextPaths` —— 行内 pill chip 列表 + `[× 删除]` + `[+ Add path]` `btn-secondary`
   - `contextOptional` —— 一对互斥 `btn-secondary`，选中态切换到 `btn-primary`
   - `respGenerator.maxLength` —— number input pill
   - `respGenerator.case` —— select pill，仅枚举 `kebab` / `snake` / `camel`
   - `respGenerator.stripStopwords` —— 开关 pill
2. 所有输入实时写入 `state.config.base`；Save 按钮调用 task-12 的写盘逻辑。
3. 控件样式严格使用现有 token，不引入新色板。
4. 自检：
   - 修改 `contextPaths` 后保存，重新打开 UI 与查看磁盘 `config.json` 都能看到变更。

## 产物
- Base Tab DOM + JS 渲染逻辑
