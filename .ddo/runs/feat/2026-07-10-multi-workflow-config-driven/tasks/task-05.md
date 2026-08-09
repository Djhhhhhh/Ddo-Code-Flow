# Task 05: 更新 Studio UI — index.html + styles.css

> 关联验收点：G7（UI Workflow 切换控件）

## 目标

在 Studio UI 的中间 topology 面板 `panel__head` 区域新增 workflow 切换下拉控件，并添加对应样式。

## 变更文件

- `ui/index.html`
- `ui/styles.css`

## 具体改动

### 1. ui/index.html — panel__head 新增 workflow select

在中间 topology 面板的 `panel__head`（或等效的面板头部区域）中新增：

```html
<div class="workflow-switcher">
  <label for="workflow-select">Workflow:</label>
  <select id="workflow-select">
    <!-- 动态填充，来自 config.workflows.items -->
  </select>
  <span id="workflow-description" class="workflow-desc"></span>
</div>
```

### 2. ui/styles.css — workflow switcher 样式

新增 `.workflow-switcher` 样式：
- 内联 flex 布局，与 panel__head 其他控件对齐
- select 下拉样式与现有 UI 风格一致
- `.workflow-desc` 显示当前 workflow 的 description，灰色小字

## 约束

- 不得引入外部 CSS 框架或 JS 库（保持零依赖）。
- UI 交互保持本地静态页面可用（file:// 协议）。
- workflow select 的选项数据由 studio.js 动态填充（本 task 只搭结构）。
- 不得删除现有的 panel__head 内容（如 stage 信息等）。
