# Reflection Report — ddo-swe bootstrap run

## 1. 未完结项（Open items）

源码层无遗留 TODO / FIXME / XXX 标记。下列条目属于"按设计延后到运行时"的项，
不是缺陷，但需要在第一次真实 run 中被实地验证 / 完成。

- [ ] `test-plan` G4 — 用一份最小 `requirement.md` 在真实目标项目里完整跑一遍 12 阶段，
  实际产出 `<target>/YYYY-MM-DD-<desp>/` 工作目录与里面的全部产物（spec / plan /
  test-plan / tasks / verification.log / execution-report / reflection-report）。
- [ ] `test-plan` G5 — 在该真实 run 中**实际**触发一次确认门否决、一次 Verification
  失败回退到 Coding 重做，核对 `.state.json.history` 记录正确。
- [ ] `test-plan` G6 动态部分 — 构造一个 stage 内并行节点 + `parallelApprove=true`
  的场景（例如同一阶段挂两个 review atom-task），跑一次合并审批，验证 agent 真的把
  两个产物合成一次请求展示给用户。
- [ ] `test-plan` G7 视觉/交互项 — 用 Chromium 系浏览器打开 `ui/index.html`：
  - Open folder 授权 → 加载 config.json → Save / Reload 三个动作往返。
  - Pipeline Tab：从抽屉拖一个 atom-task 进入泳道；点击两个 anchor 画一条 edge；
    构造一个环验证 Save 按钮变灰 + 红线高亮；勾选 parallelApprove。
  - Atom-tasks Tab：扫描；切换 ENABLED/DISABLED；对一个 `in pipeline ✗` 的
    atom-task 点 "Add to stage" 验证一键加入。
- [ ] `test-plan` G7.5 兼容兜底 — 在 Firefox 或 Safari 打开 UI，验证导入 / 导出退化通路可用。
- [ ] `test-plan` G9 — 在 Coding 阶段中途结束 agent 会话，再次进入时验证从 `.state.json`
  续跑。

## 2. 推荐后续动作（Follow-ups）

- **F-1**：写一个最小化的"hello world reverseString"目标项目作为 ddo-swe 的官方 demo，
  作为 task-17 端到端冒烟的标准 fixture。
- **F-2**：考虑给 `verification` atom-task 增加一个轻量的 dry-run 选项，让用户可在
  Specification 阶段就预览 test-plan 的 `cmd:` 条目能否在目标项目里跑通，避免到
  Verification 阶段才发现 cmd 写得有误。
- **F-3**：UI 当前 `<desp>` 编辑放在 Base Tab；可考虑在 Pipeline Tab 的 stage 标题旁
  显示当前 run 的 desp 预览，让用户在编辑流水线时直观感受到。
- **F-4**：`atom-tasks/_schema/atom-task.schema.json` 是 atom-task 的硬契约。未来如果出现
  field 增删，需要给 schema 增加 `version` 字段并实现迁移逻辑（目前最低成本设计就是
  保持 schema 向后兼容、不破坏存量 atom-task）。
- **F-5**：跨 stage 连线目前在 Pipeline Tab 被禁掉（同 stage 内才能连线）；如果将来需要
  描述"stage A 的输出能直接喂给 stage C 的入口"这种跨阶段拓扑，可以在 `config.pipeline[]`
  外再引入一层 cross-stage edges 字段。

## 3. 本次 run 经验（Lessons learned）

- **指令型 runtime 的自举（bootstrap）特别敏感**：本次 spec/plan/test-plan/tasks 都是
  AI 在产出，而最终 Coding 阶段又是 AI 在按 SKILL.md 执行——文档与运行时高度耦合。
  把 "SKILL.md 描述如何读 config 并执行，不内嵌业务" 作为硬约束，避免了递归歧义。
- **DAG 比线性数组贵不少**：在 spec 里写"atomTasks: 数组"只用一行；plan 里升级为 DAG 后，
  schema、UI 拖拽、合并审批、无环校验都要随动。值得，但要让用户清楚价格。
- **零依赖 UI 是值得的**：UI 仅用原生 HTML+CSS+JS，1155 行 app.js 撑起三个 Tab + DAG 编辑器 +
  FS API + schema 校验，整体 ~60KB 文本。和引入 react-flow 之类框架相比，调试与替换的
  成本反而更低。
- **"未使用就提示加入"这个交互**：用户在第 5 次修订时提出的，看似小功能，实际把"扫描 →
  覆盖层开关 → 加入流水线"三个动作连成一条直觉链路，比让用户手工去编辑 config.json 顺手很多。

## 4. 与原始 requirement 的偏差

无重大偏差。两点微调已在 spec/plan 中显式记录：

- `<desp>` 目录名规则从原始描述的 `yy-mm-dd-<desp>` 改为 `YYYY-MM-DD-<desp>`（4 位年），
  避免世纪歧义、改善 ISO 排序友好性。已在 plan §6 记录，并在 spec §4.2 的目录树中保留
  `yy-mm-dd-<desp>` 作为示意（明确标注最终以 plan 决议为准）。
- `templates/` 从顶级目录移到各 atom-task 子目录内部（来自 spec 修订一）；这是对用户原始
  描述"原子任务的附属产品"的更精确落地。

---

## 5. 用户确认

请确认以下任一选项：

- ✅ **同意**：本 reflection 符合预期，可标记本次 run 为 **Done**。
- ❌ **修改**：请在下方/对话中列出需要调整的条目与意见，AI 将基于反馈重新生成本文档。
