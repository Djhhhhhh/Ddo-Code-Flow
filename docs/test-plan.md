# ddo-swe Test Plan

> 本文档把已确认的 `docs/spec.md` 的 8 条 AC + `docs/plan.md` 的关键决策点，
> 拆分为**可勾选的 checklist**。Verification 阶段 agent 会逐条核对：
>
> - `- [ ] cmd: <shell>` —— 机器执行，exit code = 0 视为通过；输出/错误写入 `verification.log`。
> - `- [ ] human: <描述>` —— 人工核对，由用户在终端确认勾选。
>
> 每个 group 末尾的"通过判据"是该组 AC 的高层目标；checklist 是其拆解。
> 需用户确认本 test-plan 是否符合预期后，方可进入下一阶段（Tasking）。
>
> 路径约定：
> - `<skill>` = `skills/ddo-swe/`
> - `<run>` = 一次冒烟运行的 run 工作目录 `<target>/YYYY-MM-DD-<desp>/`

---

## G1. Skill 自身骨架与文件存在性

> 对应 spec §4.1。

- [ ] cmd: `test -f <skill>/SKILL.md`
- [ ] cmd: `test -f <skill>/config.json`
- [ ] cmd: `test -f <skill>/config.schema.json`
- [ ] cmd: `test -d <skill>/atom-tasks`
- [ ] cmd: `test -d <skill>/atom-tasks/_schema`
- [ ] cmd: `test -f <skill>/atom-tasks/_schema/atom-task.schema.json`
- [ ] cmd: `test -d <skill>/ui`
- [ ] cmd: `test -f <skill>/ui/index.html`
- [ ] cmd: `test -f <skill>/ui/styles.css`
- [ ] cmd: `test -f <skill>/ui/app.js`
- [ ] cmd: `test -f <skill>/docs/requirement.md && test -f <skill>/docs/spec.md && test -f <skill>/docs/plan.md && test -f <skill>/docs/test-plan.md`
- [ ] cmd: `! test -d <skill>/templates`  ← 顶级 `templates/` 必须不存在（spec §FR-AT-3）

**通过判据**：Skill 自身目录结构与 plan §3.1 完全一致；无遗漏文件、无遗留旧 `templates/` 目录。

---

## G2. `config.json` Schema 与默认值

> 对应 spec AC-4 / AC-5 与 plan §4。

- [ ] cmd: `node -e "JSON.parse(require('fs').readFileSync('<skill>/config.json','utf8'))"` （或等价命令：python `json.load`）
- [ ] cmd: `node -e "JSON.parse(require('fs').readFileSync('<skill>/config.schema.json','utf8'))"`
- [ ] human: `config.json` 必须包含顶层字段：`version` / `base` / `pipeline` / `atomTaskOverrides`。
- [ ] human: `base` 含字段：`targetDir` / `contextPaths`（数组）/ `contextOptional`（布尔）/ `respGenerator` / `confirmationGates`（数组）。
- [ ] human: `base.confirmationGates` 至少含 `["specification","planning","test-planning","reflection"]`。
- [ ] human: `pipeline` 长度 = 12，且顺序为 context → requirement → specification → planning → test-planning → tasking → coding → verification → review → reporting → reflection → done。
- [ ] human: 每个 `pipeline[i]` 必须有 **非空** 的 `description` 字段（plan 修订点：stage 加 description）。
- [ ] human: 每个 `pipeline[i].atomTasks` 是 **对象**，含 `entry`（数组）和 `nodes`（对象），即 DAG 结构而非字符串数组（plan §4.4）。
- [ ] human: `pipeline[stage=review].atomTasks.entry == []` 且 `nodes == {}`（默认 noop，spec §FR-REV-1）。
- [ ] human: `pipeline[stage=done].atomTasks.entry == []` 且 `nodes == {}`。
- [ ] human: 把任一 stage 的 `atomTasks` 改为字符串数组旧格式后重新加载，UI/Agent 能自动迁移为 DAG 结构并提示用户（plan §4.4 向后兼容）。
- [ ] human: 故意把 `nodes.A.next=["B"]` 与 `nodes.B.next=["A"]` 构造环路，schema/DAG 校验报错且 UI Save 按钮变灰。

**通过判据**：`config.json` 合法、字段齐全、DAG 拓扑结构生效、无环校验生效、旧格式可自动迁移。

---

## G3. Atom-task Schema 与默认实现

> 对应 spec §3.3 / §FR-AT-1~7 与 plan §5。

### G3.1 每个默认 atom-task 子目录与 JSON 存在

- [ ] cmd: `test -d <skill>/atom-tasks/context && test -f <skill>/atom-tasks/context/context.json`
- [ ] cmd: `test -d <skill>/atom-tasks/requirement && test -f <skill>/atom-tasks/requirement/requirement.json`
- [ ] cmd: `test -d <skill>/atom-tasks/spec && test -f <skill>/atom-tasks/spec/spec.json && test -f <skill>/atom-tasks/spec/spec_template.md`
- [ ] cmd: `test -d <skill>/atom-tasks/plan && test -f <skill>/atom-tasks/plan/plan.json && test -f <skill>/atom-tasks/plan/plan_template.md`
- [ ] cmd: `test -d <skill>/atom-tasks/test-plan && test -f <skill>/atom-tasks/test-plan/test-plan.json && test -f <skill>/atom-tasks/test-plan/test-plan_template.md`
- [ ] cmd: `test -d <skill>/atom-tasks/tasking && test -f <skill>/atom-tasks/tasking/tasking.json && test -f <skill>/atom-tasks/tasking/task_template.md`
- [ ] cmd: `test -d <skill>/atom-tasks/coding && test -f <skill>/atom-tasks/coding/coding.json`
- [ ] cmd: `test -d <skill>/atom-tasks/verification && test -f <skill>/atom-tasks/verification/verification.json && test -f <skill>/atom-tasks/verification/verification_template.md`
- [ ] cmd: `test -d <skill>/atom-tasks/review && test -f <skill>/atom-tasks/review/review.json && test -f <skill>/atom-tasks/review/check-list.md`
- [ ] cmd: `test -d <skill>/atom-tasks/reporting && test -f <skill>/atom-tasks/reporting/reporting.json && test -f <skill>/atom-tasks/reporting/execution-report_template.md`
- [ ] cmd: `test -d <skill>/atom-tasks/reflection && test -f <skill>/atom-tasks/reflection/reflection.json && test -f <skill>/atom-tasks/reflection/reflection-report_template.md`

### G3.2 每个 atom-task JSON 字段合规

- [ ] human: 每个 atom-task JSON 含必填字段：`name` / `version` / `stage` / `description` / `enabled` / `io` / `prompt` / `confirmation` / `concurrency` / `timeoutSec`。
- [ ] human: `description` 字段**非空**且为人类可读句子（plan 修订点：atom-task 加 description）。
- [ ] human: `name` 字段等于其所在目录名（强一致）。
- [ ] human: `io.inputs[*].ref` / `io.outputs[*].ref` 使用 `skill://` 或 `run://` 前缀（plan §5.2 URI 协议）。
- [ ] human: 模板文件（`*_template.md`、`check-list.md`）只出现在各自 atom-task 子目录下，**不**出现在顶级 `templates/`。

### G3.3 新增 atom-task 的最小动作（AC-5）

- [ ] human: 新建 `<skill>/atom-tasks/demo-new/demo-new.json` 含合法字段，并在 `config.json` 的某 stage 的 `nodes` 中引用；Agent 重新加载后能识别并能在 UI Atom-tasks Tab 看到 `in pipeline ✓`。
- [ ] human: 上一步操作过程中**未修改** SKILL.md / agent 主体代码（spec §FR-AT-7）。

**通过判据**：所有默认 atom-task 子目录就位；schema 字段齐全；可热插拔新 atom-task。

---

## G4. Pipeline 端到端冒烟（AC-1）

> 准备一份最小化 `requirement.md`（例如"实现一个把字符串反转的函数"）放到 `<target>/requirement.md`，启动 ddo-swe skill。

### G4.1 Run 目录与状态机

- [ ] human: Agent 在 `<target>/` 下创建 `YYYY-MM-DD-<desp>/` 目录（4 位年；plan §6）。
- [ ] cmd: `test -d <run>`
- [ ] cmd: `test -f <run>/.state.json`
- [ ] human: `<run>/.state.json` 含 `runId` / `createdAt` / `currentStage` / `stages` / `history` 字段（plan §7）。

### G4.2 各阶段产物（spec §4.2）

- [ ] cmd: `test -f <run>/spec.md`
- [ ] cmd: `test -f <run>/plan.md`
- [ ] cmd: `test -f <run>/test-plan.md`
- [ ] cmd: `test -d <run>/tasks`
- [ ] cmd: `ls <run>/tasks/task-*.md | head -1`  ← 至少存在 `task-01.md`
- [ ] cmd: `test -f <run>/tasks/task-group.json`  ← 位于 `tasks/` **内部**（spec §FR-TASK-3 修订点）
- [ ] cmd: `! test -f <run>/task-group.json`  ← 严禁出现在 `tasks/` 同级
- [ ] cmd: `test -f <run>/verification.log`
- [ ] cmd: `test -f <run>/execution-report.md`
- [ ] cmd: `test -f <run>/reflection-report.md`

### G4.3 task-group.json 合规

- [ ] cmd: `node -e "JSON.parse(require('fs').readFileSync('<run>/tasks/task-group.json','utf8'))"`
- [ ] human: `task-group.json` 含字段 `tasks[].id` / `tasks[].file` / `tasks[].dependsOn`；可选 `parallelGroups`（plan §5.3）。
- [ ] human: `tasks[*].file` 指向的 task-*.md 文件均存在。
- [ ] human: `dependsOn` 引用的 id 全部存在于 `tasks` 数组中，无悬挂引用。

### G4.4 execution-report 与 reflection-report 内容

- [ ] human: `execution-report.md` 至少包含：本次需求摘要、各 stage 的产物清单、Verification 结果摘要、缺失上下文清单（若有）。
- [ ] human: `reflection-report.md` 至少包含：未完结的 TODO / 后续建议 / 本次 run 经验。

**通过判据**：12 阶段全部跑完、所有产物按 spec §4.2 落盘到位、`task-group.json` 在 `tasks/` 内部。

---

## G5. 确认门与回退（AC-2 / AC-3）

> 对应 spec §FR-P4 / §FR-P5 / plan §8。

### G5.1 四个确认门必须实际停下

- [ ] human: Specification 阶段产出 `spec.md` 后，agent 显式输出"请确认 spec.md"并**停下**等待。
- [ ] human: Planning 阶段产出 `plan.md` 后，agent 显式输出"请确认 plan.md"并停下等待。
- [ ] human: Test-Planning 阶段产出 `test-plan.md` 后，agent 显式输出"请确认 test-plan.md"并停下等待。
- [ ] human: Reflection 阶段产出 `reflection-report.md` 后，agent 显式输出"请确认 reflection-report.md"并停下等待。

### G5.2 否决路径

- [ ] human: 在 Specification 确认门回复"修改：把 FR-X 改成 Y"后，agent 重新生成 `spec.md`，旧版本进入 `.state.json.history` 审计轨。
- [ ] human: 在 Planning 确认门回复"修改：…"后，同样可成功回退重生。
- [ ] human: 在 Test-Planning 确认门回复"修改：…"后，同样可成功回退重生。
- [ ] human: `.state.json.stages[<stage>].confirmation` 字段在 `pending → rejected → pending → approved` 路径上正确流转。

### G5.3 Verification 失败回退（AC-3）

- [ ] human: 故意在 `test-plan.md` 中加入一项一定失败的 `cmd: false` 条目；Verification 阶段判定失败 → agent 回到 Coding 重做或新增 task。
- [ ] human: Coding 修复后再次 Verification，能通过原失败项与所有其它项；`verification.log` 末尾出现 `ALL PASSED`。

**通过判据**：四个确认门可停可回退；Verification 失败能正确回到 Coding 直到全过。

---

## G6. DAG 拓扑、并行执行与合并审批

> 对应你本次 plan 升级点：`atomTasks` 改为 DAG + `parallelApprove`。

### G6.1 同一 stage 内并行节点

- [ ] human: 构造一个 stage，其 `atomTasks.entry = ["A","B"]`，`A.next=[]`、`B.next=[]`；Agent 在同一批次内输出 A 与 B 的产物（plan §11 的 batched outputs）。
- [ ] human: `.state.json.stages[<stage>]` 能反映 A、B 两节点的独立状态。

### G6.2 合并审批 parallelApprove

- [ ] human: 把上一步中 A、B 两节点的 `parallelApprove` 都置 `true`；Agent **只弹出一次**确认请求，请求中同时包含 A 与 B 的产物。
- [ ] human: 用户一次"同意" → A、B 同时进入 `approved`；用户"修改：仅 A 有问题" → 只重跑 A，B 保持已通过状态。

### G6.3 atom-task 禁用从图中移除

- [ ] human: 在 `config.atomTaskOverrides` 中把 A 设为 `enabled=false`；同一 stage 重新执行时跳过 A，但其归属 stage 仍执行（spec §FR-AT-6）。
- [ ] human: 当 stage 的 `entry` 中所有节点都被禁用，agent 跳过整个 stage 且 `.state.json.stages[<stage>].status = "skipped"`。

### G6.4 DAG 无环静态校验

- [ ] human: 在 `config.json` 中手写 `nodes.A.next=["B"]` + `nodes.B.next=["A"]`，UI Save 按钮变灰且 agent 启动时报错并终止（plan §4.3 / §4.4）。

**通过判据**：DAG 拓扑生效；并行节点正确批次化；`parallelApprove` 实现一次合并审批；禁用与无环校验生效。

---

## G7. UI 三 Tab 功能（AC-6 / AC-7）

> 对应 spec §3.4 与 plan §9。打开 `<skill>/ui/index.html` 进行验证。

### G7.1 加载与授权

- [ ] human: 双击 `index.html` 或拖入 Chromium 系浏览器后页面可加载，无 404 / 控制台报错。
- [ ] human: 点击 "Open folder" 触发目录选择器，选择 `<skill>/` 后顶栏右侧显示当前路径。
- [ ] human: 拒绝授权时 UI 给出可读的引导文字，不挂死。

### G7.2 Base Tab（编辑基础配置）

- [ ] human: Base Tab 显示 `targetDir` / `contextPaths` / `contextOptional` / `respGenerator` 四组控件。
- [ ] human: 添加一项 `contextPaths` 后点 Save，重新打开 UI 看到该项仍在；磁盘上的 `config.json` 真的被改写。

### G7.3 Pipeline Tab（流水线可视化编排）

- [ ] human: 页面以 **泳道 + 节点 + 箭头** 的方式渲染（视觉对齐 `docs/pipeline.png`）；每个 stage 显示其 `description`，每个 atom-task 节点显示其 `description`。
- [ ] human: 拖动 stage 顺序后保存，`config.pipeline` 数组顺序对应变化。
- [ ] human: 从右侧 atom-task 抽屉拖一个节点进入泳道，该 atom-task 出现在对应 stage 的 `nodes` 中，且自动追加到 `entry` 末尾。
- [ ] human: 点击两个节点的"连线锚点"成功在它们之间画出箭头，且 `nodes[upstream].next` 包含下游 name。
- [ ] human: 删除节点后，所有指向它的 `next` 引用同步清理（无悬挂边）。
- [ ] human: 勾选 "合并审批" 后，所选节点的 `parallelApprove` 同步置 `true`，UI 视觉上把它们框成同一审批批次。
- [ ] human: 构造一个环后 Save 按钮变 `{component.button-disabled}`，环路边线以红色 1px 高亮。

### G7.4 Atom-tasks Tab（扫描 + 开关 + 加入流程，对应你的需求 5）

- [ ] human: 进入 Atom-tasks Tab 自动扫描 `<skill>/atom-tasks/*/`；点击 "Scan atom-tasks/" 可强制刷新。
- [ ] human: 扫描结果列出所有 atom-task 的卡片：name / description / 声明的 stage / `in pipeline ✓ or ✗`。
- [ ] human: 对一个已 `in pipeline ✓` 的 atom-task，切换 ENABLED/DISABLED 后 `config.atomTaskOverrides[name].enabled` 同步变更；流水线下次运行时该开关生效。
- [ ] human: 对一个 `in pipeline ✗` 的 atom-task（例如新增的 `review-checklist`），卡片上显示 "Add to <stage> stage" 下拉，默认值取该 atom-task JSON 的 `stage`；点击确认后该 atom-task 被加入对应 stage 的 `nodes` 与 `entry` 末尾，UI 自动跳到 Pipeline Tab 并高亮新加入的节点。
- [ ] human: 上述加入过程**不修改** atom-task 自身的 JSON 文件（开关与拓扑变更都落在 `config.json`）。

### G7.5 浏览器兼容性兜底

- [ ] human: 在不支持 File System Access API 的浏览器（如 Firefox / Safari）下打开，UI 显示明确提示并提供"下载 config.json / 上传 config.json"的兜底交互（plan §9.1）。

**通过判据**：三 Tab 全部可用；DAG 拖拽与连线工作；"加入流程"动作正确写入 config.json；浏览器兼容兜底存在。

---

## G8. UI 设计语言对齐 `DESIGN.md`（你的需求 4）

> 对应 plan §9.2 的 token 映射表。逐项核对样式。

- [ ] human: 页面背景为纯 `#ffffff`（`{colors.canvas}`），无渐变、无装饰背景。
- [ ] human: 主要按钮（Save / Open folder）为黑色实心 pill：背景 `#000000`（`{colors.primary}`），文字 `#ffffff`，圆角 9999px（`{rounded.full}`）。
- [ ] human: 次按钮（如 + Add path / Scan atom-tasks/）为白底黑字 + 1px hairline 边框，`{rounded.full}`。
- [ ] human: 顶栏标题使用 `{typography.display-lg}`（30px / 500）SF Pro Rounded（或其 fallback）。
- [ ] human: Tab 切换条为 `{component.search-pill}` 同款形状（`{rounded.full}` + `{colors.surface-soft}` 底）。
- [ ] human: atom-task 节点卡片：`{rounded.lg}` 12px 圆角 + 1px `{colors.hairline}` 边框，**无阴影**。
- [ ] human: stage 泳道：dotted 1px 边框 `{colors.hairline-strong}` + `{rounded.lg}`。
- [ ] human: 节点副标题（description）使用 `{typography.body-sm}`（14px / 400），颜色 `{colors.body}` `#737373`。
- [ ] human: 确认门 / 当前 stage 高亮仅使用一次反色 `{colors.surface-dark}`（`#171717`）+ `{colors.on-dark}` 文字（**每张视图最多 1 个高亮**，参考 DESIGN.md 的 pricing-card-dark 用法）。
- [ ] human: 启用/禁用开关：启用态 = 黑色 pill，禁用态 = 灰底 pill（`{colors.surface-soft}` + `{colors.mute}` 文字）。
- [ ] human: 段落间距使用 `{spacing.section}`（88px）；卡片内 padding `{spacing.xl}`（24px）。
- [ ] human: 整页未引入 react-flow / drawflow / 任意 npm 依赖（plan §9.5）；查看 `<skill>/ui/` 仅含 `index.html` / `styles.css` / `app.js`。
- [ ] cmd: `! test -e <skill>/ui/node_modules`  ← 严禁出现 node_modules
- [ ] cmd: `! test -e <skill>/ui/package.json`  ← 严禁出现 package.json

**通过判据**：UI 视觉与 DESIGN.md tokens 一一对应；无新视觉 token；无任何打包/运行时依赖。

---

## G9. 跨会话恢复与状态机一致性（plan §7）

- [ ] human: 在 `Coding` 阶段中途手动结束 agent 会话；重启会话后，agent 第一步读取 `<run>/.state.json`，自动跳到 `currentStage = coding` 并续跑剩余 task。
- [ ] human: 续跑过程中已完成的 task 不被重新执行；新会话写入 `.state.json.history` 一条 `resumed` 记录。
- [ ] human: 同一目标目录下已存在同名 `YYYY-MM-DD-<desp>/`，agent 自动追加 `-2`/`-3` 序号（plan §12 R-5）。

**通过判据**：会话中断不破坏状态机；run 命名碰撞有兜底。

---

## G10. 解耦原则验证（AC-4）

> 对应 spec §C-1 与 plan §P-2。

- [ ] human: 把 `pipeline[stage=specification].atomTasks.nodes` 中的 `"spec"` 替换为一个完全不同的 atom-task `"spec-v2"`（已新建对应子目录），重新跑流水线行为相应改变。
- [ ] human: 上一步操作过程中**未修改** `SKILL.md`、`config.schema.json`、`ui/*`、其它任意 atom-task JSON 文件——仅改动 `config.json` 与新增的 `atom-tasks/spec-v2/`。
- [ ] cmd: `git diff --name-only HEAD~1 HEAD | grep -E "(SKILL\.md|config\.schema\.json|ui/)" | wc -l`  ← 期望输出 `0`

**通过判据**：流水线行为可仅靠改 `config.json` + 新增 atom-task 子目录改变；任何核心代码与 schema 都不会被触碰。

---

## G11. 文档完整性

- [ ] human: `<skill>/docs/spec.md`、`<skill>/docs/plan.md`、`<skill>/docs/test-plan.md` 三份文档都已存在且通过用户确认（`.state.json.history` 各有 `approved` 记录）。
- [ ] human: 本次 run 的 `execution-report.md` 中显式引用了上述三份文档。

**通过判据**：三份核心 markdown 文档齐全且已审批。

---

## 12. 最终验收

> 当 G1 ~ G11 的全部 checklist 通过时，本次 run 进入"全部通过"状态，agent 在 `verification.log` 末尾写入 `ALL PASSED` 后进入 Review 阶段。

- [ ] human: G1 ~ G11 所有项目均勾选完成。
- [ ] cmd: `tail -n 1 <run>/verification.log | grep -q "ALL PASSED"`

---

## 13. 用户确认

请确认以下任一选项：

- ✅ **同意**：本 test-plan 符合预期，可进入 **Tasking** 阶段生成 `tasks/task-*.md` 与 `tasks/task-group.json`。
- ❌ **修改**：请在下方/对话中列出需要调整的 group / 条目编号与意见，AI 将基于反馈重新生成本文档。
