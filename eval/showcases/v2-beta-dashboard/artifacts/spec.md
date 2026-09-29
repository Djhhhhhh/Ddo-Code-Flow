# Ddo Index Dashboard Showcase Spec

> 本文档用于确认 agent 是否正确理解用户关于「在 eval 新建 showcase 演示 ddo-code-flow 流程，case 为基于 ~/.ddo/index.json 的开发中需求 dashboard」的需求。

---

## 对齐摘要

- 用户目标：以「支持本项目的 dashboard」为 case，在 eval/ 产出一次完整演示 ddo-code-flow 流水线的 showcase。
- 期望交付：① 静态单文件 HTML 形态的 dashboard（浏览器直接打开），读取 `~/.ddo/index.json` 索引当前机器正在开发的需求；② dashboard 代码作为 eval/runs/ 下独立沙箱项目开发；③ eval/ 下按既有约定归档的 showcase 材料。
- 关键边界：dashboard 只读消费全局索引，不改造流水线机制本身；不展示已结束 run 的历史归档。
- 当前状态：BQ-1、BQ-2 已由用户回答并写回，无未解决阻塞问题，等待批准。

---

## 用户目标

- 在 eval/ 新建一个 showcase，用于演示当前项目（ddo-code-flow）的完整流程。
- case 定位：创建一个支持本项目的 dashboard。
- dashboard 机制：通过用户根目录下的 `~/.ddo/index.json` 文件索引当前机器中正在开发的需求。

---

## 范围与非目标

### In Scope

- 创建静态单文件 HTML 形态的 dashboard：读取 `~/.ddo/index.json`，展示当前机器中正在开发（运行中）的需求及其基本状态，浏览器直接打开即用。
- dashboard 代码作为 eval/runs/ 下的独立沙箱项目开发（演示用途，showcase 归档后可整体删除）。
- 在 eval/ 产出一个新 showcase：按项目既有约定归档本次 run 的演示材料（评估结论 + 时间线）。

### Non-goals

- 不展示已结束 run 的历史归档（`~/.ddo/history/`）——用户只要求「正在开发的需求」。
- 不修改 ddo-code-flow 流水线机制本身（tools / atom-tasks / workflows 不因 dashboard 变更）。
- dashboard 对全局索引只读，不执行任何流水线写操作（推进 / 回滚 / 决议）。
- dashboard 不作为本仓库正式工具交付（不进 tools/、不走独立 PR 合入——归属为演示沙箱项目）。

---

## 需求对齐

| ID | Agent 对需求的理解 | 来源 | 成功结果 |
|---|---|---|---|
| FR-SHOWCASE-1 | 在 eval/ 新建一个 showcase，按项目既有归档约定完整呈现本次 run 演示 ddo-code-flow 流程的过程材料。 | 用户原始要求 + 项目事实（eval/README.md 约定） | AC-2 |
| FR-DASH-1 | 交付一个支持 ddo-code-flow 项目的 dashboard，形态为静态单文件 HTML（浏览器直接打开即用，无服务依赖）。 | 用户原始要求 + 用户修订（回答 BQ-1） | AC-1, AC-3 |
| FR-DASH-2 | dashboard 通过读取 `~/.ddo/index.json` 获得当前机器中正在开发的需求索引。 | 用户原始要求 | AC-1 |
| FR-DASH-3 | dashboard 以用户可查看的方式列出正在开发的需求及其基本状态信息。 | 用户原始要求 | AC-1 |
| FR-DASH-4 | dashboard 代码作为 eval/runs/ 下的独立沙箱项目开发，showcase 归档后可整体删除。 | 用户修订（回答 BQ-2） | AC-3 |

---

## 约束与保留术语

- 保留用户术语：`showcase`、`dashboard`、`~/.ddo/index.json`、`正在开发的需求`。
- 项目事实约束：`~/.ddo` 为 DDO_HOME 缺省目录，`index.json` 是运行中 run 的全局索引指针（项目 SKILL.md 定义）。
- 项目事实约束：showcase 归档遵循 eval/README.md 既有流程（沙箱产物 + history 归档 + ASSESSMENT.md + timeline.md）。

---

## 解释与假设

| 类型 | 内容 | 依据或原因 | 若错误的影响 |
|---|---|---|---|
| Interpretation | 「支持这个项目的 dashboard」= 面向 ddo-code-flow 的开发态势展示工具（读取其全局索引呈现运行中需求），而非改造流水线机制。 | 用户后半句明确机制为「通过 index.json 索引」，展示与消费是 dashboard 本义。 | 若用户期望改造流水线本身，范围与交付物完全不同。 |
| Assumption | 「正在开发的需求」= `~/.ddo/index.json` 中登记的运行中 run。 | 项目事实：index.json 为运行中指针，历史在 history/。 | 若用户还期望历史需求，范围扩大——已收窄进 Non-goals，可在确认时提出。 |

---

## 对齐变化摘要

| 变更类型 | ID | 修改前 | 修改后 | 依据 |
|---|---|---|---|---|
| 修改 | FR-DASH-1 | 交付 dashboard，形态按 BQ-1 确认结果落实 | 形态确定为静态单文件 HTML（浏览器直接打开即用，无服务依赖） | 用户修订：回答 BQ-1 |
| 新增 | FR-DASH-4 | — | dashboard 代码作为 eval/runs/ 下独立沙箱项目开发，归档后可整体删除 | 用户修订：回答 BQ-2 |
| 新增 | AC-3 | — | eval/runs/ 沙箱项目目录中存在可打开的静态单文件 dashboard | 用户修订：回答 BQ-1 / BQ-2 |
| 已解决 | BQ-1 | 待确认：交付形态 | 静态单文件 HTML | 用户回答（2026-09-29） |
| 已解决 | BQ-2 | 待确认：代码归属 | eval/runs/ 沙箱项目 | 用户回答（2026-09-29） |

---

## 留给 Planning

- **PD-1**：静态单文件 HTML 如何获取 `~/.ddo/index.json` 数据——浏览器 `file://` 下 fetch 本地文件受限，需在「启动脚本将数据注入 HTML / 页面内手动选择文件 / 生成时内嵌数据快照」等方案中决策。
- **PD-2**：`index.json` 的解析与容错细节（文件缺失 / 内容为空 / 格式异常时的呈现）。
- **PD-3**：展示的信息字段与布局细节（从 index.json 与 run 状态中选取哪些列）。
- **PD-4**：数据更新方式（打开时读取一次 / 手动刷新 / 重新生成）。

---

## 成功结果

| ID | 用户可观察的结果 | Validates | 来源 |
|---|---|---|---|
| AC-1 | 用户用浏览器打开 dashboard 单文件后，能看到当前机器上运行中的 run 列表（含本次 showcase run 自身）及其基本状态（如 runId、标题、类型、当前阶段）。 | FR-DASH-1, FR-DASH-2, FR-DASH-3 | 用户原始要求 + 用户修订（BQ-1） |
| AC-2 | run finish 后，eval/showcases/ 下存在本次 run 的完整归档材料（含评估结论与时间线）。 | FR-SHOWCASE-1 | 用户原始要求 + 项目事实 |
| AC-3 | eval/runs/ 下的独立沙箱项目目录中存在可直接打开的静态单文件 dashboard（该项目目录归档后可整体删除）。 | FR-DASH-1, FR-DASH-4 | 用户修订（BQ-1 / BQ-2） |

---

## 用户确认

当前无未解决 BQ，可以批准。用户可以：

- ✅ **同意**：批准当前 spec，进入 Planning。
- ❌ **修改：<反馈>**：修改当前 spec，展示变化后重新确认。
- ❓ **提问：<问题>**：仅答疑；如需据此改动，必须随后明确选择 `修改`。
