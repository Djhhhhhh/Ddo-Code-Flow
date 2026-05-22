# task-11 — UI 骨架：index.html + styles.css 设计 token 实现

## 目标
建立 UI 入口页面与样式系统：把 DESIGN.md 的全部 token（colors / typography / spacing / shapes / components）实现为可复用的 CSS 变量与类。**只画骨架，不实现任何功能**。

## 范围
- `skills/ddo-swe/ui/index.html`
- `skills/ddo-swe/ui/styles.css`
- `skills/ddo-swe/ui/app.js`（仅占位的空模块，供后续 task 填充）

## 依赖
无（可与 task-01 并行起步）。

## 关联验收点
- G1：ui 目录与三文件存在。
- G7.1：页面可加载，无 404 / 控制台报错。
- G8 全组：所有视觉 token 对齐 DESIGN.md；无 node_modules / package.json。

## 步骤
1. `styles.css`：
   - 把 DESIGN.md 的 colors、typography、spacing、rounded、组件全部映射成 CSS 自定义属性（`--color-canvas`, `--color-primary`, `--font-display-lg`, `--rounded-full` 等）。
   - 实现 `.btn-primary` / `.btn-secondary` / `.btn-disabled` / `.search-pill` / `.text-input` / `.terminal-card` 等组件类。
   - 实现 `.stage-lane`（dotted 边框 + rounded-lg + hairline-strong）与 `.atom-node`（hairline border + rounded-lg + 24px padding）两个本 UI 专属类。
   - 字体声明遵循 DESIGN.md：SF Pro Rounded → system-ui fallback；body 用 ui-sans-serif；code 用 ui-monospace。
2. `index.html`：
   - 顶栏：`display-lg` 标题 "ddo-swe" + 右侧三个按钮 [Open folder] [Reload] [Save]（占位无逻辑）。
   - Tab pill 组：`( Base ) ( Pipeline ) ( Atom-tasks )` 切换器，使用 `search-pill` 风格；点击切换 active class。
   - 三个 Tab 容器 div，内部各放一个 placeholder。
   - 引入 `styles.css` 与 `app.js`。
3. `app.js`：
   - 仅包含 Tab 切换的最小 JS（点击切换 `active` class），其余留 `// TODO: implemented in task-NN` 占位。
4. 自检：
   - 直接 `file://` 协议打开 `index.html`，三 Tab 可切换，控制台无报错。
   - 严禁出现 `node_modules/` 或 `package.json`。

## 产物
- `index.html` / `styles.css` / `app.js`
